-- ============================================================
-- RSB CLUB OS — 0002 DOMAIN
-- players, matches, media, content, graphics, tasks,
-- comments, notifications, activity_log, templates
-- ============================================================

create type public.player_position as enum ('GK','DF','MF','FW');
create type public.player_status as enum ('available','injured','suspended','unavailable');
create type public.match_status as enum ('upcoming','live','finished','postponed','cancelled');
create type public.match_event_type as enum ('goal','own_goal','assist','yellow_card','red_card','sub_in','sub_out','penalty_scored','penalty_missed');
create type public.media_kind as enum ('photo','video','graphic','document');
create type public.content_status as enum ('idea','planned','copy','graphic_requested','in_production','review','approved','scheduled','published','cancelled');
create type public.graphic_status as enum ('requested','todo','in_progress','review','approved','published');
create type public.task_status as enum ('todo','in_progress','review','done','blocked');
create type public.priority_level as enum ('low','medium','high','urgent');
create type public.entity_kind as enum ('content','graphic','task','match','player','media');
create type public.notification_type as enum ('mention','task_assigned','graphic_assigned','graphic_ready','content_review','content_approved','deadline','upcoming_match','media_uploaded','status_change');

-- ---------- LOOKUP (estensibili per club, non hardcoded) ----------

create table public.content_types (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  slug text not null,
  name text not null,
  sort int not null default 0,
  is_active boolean not null default true,
  unique (club_id, slug)
);

create table public.social_channels (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  slug text not null,
  name text not null,
  sort int not null default 0,
  is_active boolean not null default true,
  unique (club_id, slug)
);

-- ---------- PLAYERS ----------

create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  shirt_number int,
  position public.player_position not null default 'MF',
  role_detail text,
  birth_date date,
  birth_place text,
  nationality text,
  foot text check (foot in ('left','right','both')),
  height_cm int,
  weight_kg int,
  phone text,
  email text,
  instagram text,
  tiktok text,
  socials jsonb not null default '{}'::jsonb,
  photo_url text,
  status public.player_status not null default 'available',
  status_note text,
  custom_fields jsonb not null default '{}'::jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_club_idx on public.players (club_id);
create trigger players_touch before update on public.players for each row execute function public.set_updated_at();

-- ---------- MATCHES ----------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  competition_id uuid references public.competitions(id) on delete set null,
  opponent text not null,
  opponent_logo_url text,
  is_home boolean not null default true,
  kickoff_at timestamptz not null,
  venue text,
  matchday text,
  status public.match_status not null default 'upcoming',
  our_score int,
  opponent_score int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matches_club_idx on public.matches (club_id, kickoff_at);
create trigger matches_touch before update on public.matches for each row execute function public.set_updated_at();

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  type public.match_event_type not null,
  player_id uuid references public.players(id) on delete set null,
  minute int,
  note text,
  created_at timestamptz not null default now()
);
create index match_events_match_idx on public.match_events (match_id);

create table public.match_lineup (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  is_starting boolean not null default true,
  primary key (match_id, player_id)
);

-- ---------- MEDIA ----------

create table public.media (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null default '',
  kind public.media_kind not null default 'photo',
  category text,
  tags text[] not null default '{}',
  storage_path text,
  url text,
  thumb_url text,
  match_id uuid references public.matches(id) on delete set null,
  content_id uuid, -- fk aggiunta dopo la creazione di content
  author_id uuid references public.profiles(id) on delete set null,
  taken_at date,
  notes text,
  created_at timestamptz not null default now()
);
create index media_club_idx on public.media (club_id, created_at desc);
create index media_match_idx on public.media (match_id);

create table public.media_players (
  media_id uuid not null references public.media(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (media_id, player_id)
);
create index media_players_player_idx on public.media_players (player_id);

-- ---------- CONTENT ----------

create table public.content (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  content_type_id uuid references public.content_types(id) on delete set null,
  channel_id uuid references public.social_channels(id) on delete set null,
  status public.content_status not null default 'idea',
  publish_date date,
  publish_time time,
  caption text,
  hashtags text,
  notes text,
  match_id uuid references public.matches(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  priority public.priority_level not null default 'medium',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_club_idx on public.content (club_id, publish_date);
create index content_match_idx on public.content (match_id);
create trigger content_touch before update on public.content for each row execute function public.set_updated_at();

create table public.content_players (
  content_id uuid not null references public.content(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (content_id, player_id)
);
create index content_players_player_idx on public.content_players (player_id);

alter table public.media
  add constraint media_content_fk foreign key (content_id) references public.content(id) on delete set null;

-- ---------- GRAPHICS ----------

create table public.graphics (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  content_id uuid references public.content(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  designer_id uuid references public.profiles(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  deadline date,
  priority public.priority_level not null default 'medium',
  status public.graphic_status not null default 'requested',
  brief text,
  reference_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index graphics_club_idx on public.graphics (club_id, status);
create trigger graphics_touch before update on public.graphics for each row execute function public.set_updated_at();

create table public.graphic_versions (
  id uuid primary key default gen_random_uuid(),
  graphic_id uuid not null references public.graphics(id) on delete cascade,
  label text not null,
  media_id uuid references public.media(id) on delete set null,
  file_url text,
  note text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index graphic_versions_graphic_idx on public.graphic_versions (graphic_id);

-- ---------- TASKS ----------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  deadline date,
  priority public.priority_level not null default 'medium',
  status public.task_status not null default 'todo',
  player_id uuid references public.players(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  content_id uuid references public.content(id) on delete set null,
  graphic_id uuid references public.graphics(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_club_idx on public.tasks (club_id, status);
create index tasks_owner_idx on public.tasks (owner_id);
create trigger tasks_touch before update on public.tasks for each row execute function public.set_updated_at();

create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, user_id)
);

-- ---------- COLLABORATION ----------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  entity_type public.entity_kind not null,
  entity_id uuid not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index comments_entity_idx on public.comments (entity_type, entity_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  entity_type public.entity_kind,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.activity_log (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type public.entity_kind,
  entity_id uuid,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_club_idx on public.activity_log (club_id, created_at desc);

-- ---------- CONTENT TEMPLATES ----------

create table public.content_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  slug text not null,
  is_match_pack boolean not null default false,
  defaults jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (club_id, slug)
);

-- ============================================================
-- RLS DOMINIO
-- lettura: membro del club — scrittura: permesso RBAC dedicato
-- ============================================================

alter table public.content_types enable row level security;
alter table public.social_channels enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.match_lineup enable row level security;
alter table public.media enable row level security;
alter table public.media_players enable row level security;
alter table public.content enable row level security;
alter table public.content_players enable row level security;
alter table public.graphics enable row level security;
alter table public.graphic_versions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.content_templates enable row level security;

create policy content_types_select on public.content_types for select using (public.is_member(club_id));
create policy content_types_write on public.content_types for all using (public.has_perm(club_id, 'settings.manage'));

create policy social_channels_select on public.social_channels for select using (public.is_member(club_id));
create policy social_channels_write on public.social_channels for all using (public.has_perm(club_id, 'settings.manage'));

create policy players_select on public.players for select using (public.is_member(club_id));
create policy players_write on public.players for all using (public.has_perm(club_id, 'players.manage'));

create policy matches_select on public.matches for select using (public.is_member(club_id));
create policy matches_write on public.matches for all using (public.has_perm(club_id, 'matches.manage'));

create policy match_events_select on public.match_events for select using (public.is_member(club_id));
create policy match_events_write on public.match_events for all using (public.has_perm(club_id, 'matches.manage'));

create policy match_lineup_select on public.match_lineup for select using (public.is_member(club_id));
create policy match_lineup_write on public.match_lineup for all using (public.has_perm(club_id, 'matches.manage'));

create policy media_select on public.media for select using (public.is_member(club_id));
create policy media_insert on public.media for insert with check (public.has_perm(club_id, 'media.upload'));
create policy media_update on public.media for update using (public.has_perm(club_id, 'media.upload'));
create policy media_delete on public.media for delete using (public.has_perm(club_id, 'media.manage'));

create policy media_players_select on public.media_players for select using (
  exists (select 1 from public.media m where m.id = media_id and public.is_member(m.club_id))
);
create policy media_players_write on public.media_players for all using (
  exists (select 1 from public.media m where m.id = media_id and public.has_perm(m.club_id, 'media.upload'))
);

create policy content_select on public.content for select using (public.is_member(club_id));
create policy content_insert on public.content for insert with check (public.has_perm(club_id, 'content.create'));
create policy content_update on public.content for update using (
  public.has_perm(club_id, 'content.edit') or public.has_perm(club_id, 'content.approve')
);
create policy content_delete on public.content for delete using (public.has_perm(club_id, 'content.delete'));

create policy content_players_select on public.content_players for select using (
  exists (select 1 from public.content c where c.id = content_id and public.is_member(c.club_id))
);
create policy content_players_write on public.content_players for all using (
  exists (select 1 from public.content c where c.id = content_id and public.has_perm(c.club_id, 'content.edit'))
);

create policy graphics_select on public.graphics for select using (public.is_member(club_id));
create policy graphics_insert on public.graphics for insert with check (public.has_perm(club_id, 'graphics.request'));
create policy graphics_update on public.graphics for update using (
  public.has_perm(club_id, 'graphics.produce') or public.has_perm(club_id, 'graphics.approve')
);
create policy graphics_delete on public.graphics for delete using (public.has_perm(club_id, 'graphics.approve'));

create policy graphic_versions_select on public.graphic_versions for select using (
  exists (select 1 from public.graphics g where g.id = graphic_id and public.is_member(g.club_id))
);
create policy graphic_versions_write on public.graphic_versions for all using (
  exists (select 1 from public.graphics g where g.id = graphic_id and public.has_perm(g.club_id, 'graphics.produce'))
);

create policy tasks_select on public.tasks for select using (public.is_member(club_id));
create policy tasks_insert on public.tasks for insert with check (public.has_perm(club_id, 'tasks.create'));
create policy tasks_update on public.tasks for update using (
  public.has_perm(club_id, 'tasks.manage')
  or owner_id = auth.uid()
  or exists (select 1 from public.task_assignees ta where ta.task_id = id and ta.user_id = auth.uid())
);
create policy tasks_delete on public.tasks for delete using (public.has_perm(club_id, 'tasks.manage'));

create policy task_assignees_select on public.task_assignees for select using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_member(t.club_id))
);
create policy task_assignees_write on public.task_assignees for all using (
  exists (select 1 from public.tasks t where t.id = task_id and (public.has_perm(t.club_id, 'tasks.manage') or t.owner_id = auth.uid()))
);

create policy comments_select on public.comments for select using (public.is_member(club_id));
create policy comments_insert on public.comments for insert with check (
  public.has_perm(club_id, 'comments.create') and author_id = auth.uid()
);
create policy comments_delete_own on public.comments for delete using (author_id = auth.uid());

create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert with check (public.is_member(club_id));
create policy notifications_update on public.notifications for update using (user_id = auth.uid());

create policy activity_select on public.activity_log for select using (public.is_member(club_id));
create policy activity_insert on public.activity_log for insert with check (
  public.is_member(club_id) and actor_id = auth.uid()
);

create policy templates_select on public.content_templates for select using (public.is_member(club_id));
create policy templates_write on public.content_templates for all using (public.has_perm(club_id, 'settings.manage'));
