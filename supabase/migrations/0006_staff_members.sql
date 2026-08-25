-- ============================================================
-- RSB CLUB OS — 0006 STAFF MEMBERS
-- Staff tecnico/dirigenziale del club (tab Staff in Team)
-- ============================================================

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  role_title text not null,
  phone text,
  email text,
  photo_url text,
  notes text,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_members_club_idx on public.staff_members (club_id, sort);
create trigger staff_members_touch before update on public.staff_members
  for each row execute function public.set_updated_at();

alter table public.staff_members enable row level security;
create policy staff_select on public.staff_members for select using (public.is_member(club_id));
create policy staff_write on public.staff_members for all using (public.has_perm(club_id, 'players.manage'));
