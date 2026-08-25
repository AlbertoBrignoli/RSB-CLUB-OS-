-- ============================================================
-- RSB CLUB OS — 0001 CORE
-- Multi-tenant (organization → club → season) + RBAC data-driven
-- ============================================================

-- ---------- TENANCY ----------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  short_name text,
  slug text not null unique,
  logo_url text,
  colors jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- PROFILES ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RBAC (nessun permesso hardcoded) ----------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade, -- null = ruolo template globale
  slug text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  unique (club_id, slug)
);

create table public.permissions (
  key text primary key,
  description text
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  created_at timestamptz not null default now(),
  unique (user_id, club_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_club_idx on public.memberships (club_id);

-- ---------- HELPERS (security definer: bypassano RLS, nessuna ricorsione) ----------

create or replace function public.is_member(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and club_id = p_club
  );
$$;

create or replace function public.has_perm(p_club uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.user_id = auth.uid() and m.club_id = p_club and rp.permission_key = p_perm
  );
$$;

create or replace function public.my_permissions(p_club uuid)
returns setof text language sql stable security definer set search_path = public as $$
  select rp.permission_key
  from public.memberships m
  join public.role_permissions rp on rp.role_id = m.role_id
  where m.user_id = auth.uid() and m.club_id = p_club;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- RLS CORE ----------

alter table public.organizations enable row level security;
alter table public.clubs enable row level security;
alter table public.seasons enable row level security;
alter table public.competitions enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;

create policy org_select on public.organizations for select using (
  exists (select 1 from public.clubs c where c.organization_id = organizations.id and public.is_member(c.id))
);

create policy clubs_select on public.clubs for select using (public.is_member(id));
create policy clubs_update on public.clubs for update using (public.has_perm(id, 'settings.manage'));

create policy seasons_select on public.seasons for select using (public.is_member(club_id));
create policy seasons_write on public.seasons for all using (public.has_perm(club_id, 'settings.manage'));

create policy competitions_select on public.competitions for select using (public.is_member(club_id));
create policy competitions_write on public.competitions for all using (public.has_perm(club_id, 'matches.manage'));

-- I profili sono visibili a chi condivide almeno un club (per assegnazioni, menzioni, feed)
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.memberships m1
    join public.memberships m2 on m1.club_id = m2.club_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
create policy profiles_update_own on public.profiles for update using (id = auth.uid());

create policy roles_select on public.roles for select using (
  club_id is null or public.is_member(club_id)
);
create policy roles_write on public.roles for all using (
  club_id is not null and public.has_perm(club_id, 'users.manage')
);

create policy permissions_select on public.permissions for select using (auth.uid() is not null);

create policy role_permissions_select on public.role_permissions for select using (
  exists (select 1 from public.roles r where r.id = role_id and (r.club_id is null or public.is_member(r.club_id)))
);
create policy role_permissions_write on public.role_permissions for all using (
  exists (select 1 from public.roles r where r.id = role_id and r.club_id is not null and public.has_perm(r.club_id, 'users.manage'))
);

create policy memberships_select on public.memberships for select using (
  user_id = auth.uid() or public.is_member(club_id)
);
create policy memberships_write on public.memberships for all using (public.has_perm(club_id, 'users.manage'));
