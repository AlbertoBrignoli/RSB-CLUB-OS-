-- ============================================================
-- RSB CLUB OS — 0003 FUNCTIONS
-- bootstrap primo admin, inviti, match content automation, storage
-- ============================================================

-- Primo utente che accede diventa Super Admin del club seed (una tantum).
create or replace function public.bootstrap_first_admin()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_club uuid;
  v_role uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.memberships) then
    return null; -- già inizializzato
  end if;
  select id into v_club from public.clubs order by created_at limit 1;
  select id into v_role from public.roles where club_id = v_club and slug = 'super_admin';
  if v_club is null or v_role is null then
    raise exception 'seed data missing';
  end if;
  insert into public.memberships (user_id, club_id, role_id)
  values (auth.uid(), v_club, v_role);
  return v_club;
end $$;

-- Aggiunge al club un utente già registrato, per email (richiede users.manage).
create or replace function public.add_member_by_email(p_club uuid, p_email text, p_role_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_role uuid;
begin
  if not public.has_perm(p_club, 'users.manage') then
    raise exception 'permission denied';
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then
    raise exception 'Nessun utente registrato con questa email. L''utente deve prima creare il proprio account.';
  end if;
  select id into v_role from public.roles where club_id = p_club and slug = p_role_slug;
  if v_role is null then
    raise exception 'Ruolo % inesistente', p_role_slug;
  end if;
  insert into public.memberships (user_id, club_id, role_id)
  values (v_user, p_club, v_role)
  on conflict (user_id, club_id) do update set role_id = excluded.role_id;
  return v_user;
end $$;

-- ============================================================
-- MATCH → CONTENT AUTOMATION
-- Genera il pacchetto editoriale della partita dai content_templates:
-- per ogni template: content + (se richiesto) graphic request + task.
-- ============================================================
create or replace function public.generate_match_pack(p_match uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_match record;
  v_tpl record;
  v_club uuid;
  v_content uuid;
  v_graphic uuid;
  v_type uuid;
  v_channel uuid;
  v_date date;
  v_time time;
  v_title text;
  v_count int := 0;
begin
  select * into v_match from public.matches where id = p_match;
  if v_match is null then
    raise exception 'match not found';
  end if;
  v_club := v_match.club_id;
  if not public.has_perm(v_club, 'content.create') then
    raise exception 'permission denied';
  end if;

  for v_tpl in
    select * from public.content_templates
    where club_id = v_club and is_match_pack
    order by sort
  loop
    v_title := v_tpl.name || ' — vs ' || v_match.opponent;

    -- niente duplicati se il pacchetto è già stato generato
    if exists (select 1 from public.content c where c.match_id = p_match and c.title = v_title) then
      continue;
    end if;

    select id into v_type from public.content_types
      where club_id = v_club and slug = v_tpl.defaults->>'content_type';
    select id into v_channel from public.social_channels
      where club_id = v_club and slug = v_tpl.defaults->>'channel';

    v_date := (v_match.kickoff_at at time zone 'Europe/Rome')::date
              + coalesce((v_tpl.defaults->>'offset_days')::int, 0);
    v_time := coalesce((v_tpl.defaults->>'publish_time')::time, '10:00'::time);

    insert into public.content
      (club_id, title, content_type_id, channel_id, status, publish_date, publish_time,
       match_id, priority, created_by, notes)
    values
      (v_club, v_title, v_type, v_channel,
       case when coalesce((v_tpl.defaults->>'needs_graphic')::boolean, false)
            then 'graphic_requested'::public.content_status
            else 'planned'::public.content_status end,
       v_date, v_time, p_match, 'high', auth.uid(), v_tpl.defaults->>'brief')
    returning id into v_content;

    if coalesce((v_tpl.defaults->>'needs_graphic')::boolean, false) then
      insert into public.graphics
        (club_id, title, content_id, match_id, requested_by, deadline, priority, status, brief)
      values
        (v_club, v_title, v_content, p_match, auth.uid(), v_date, 'high', 'requested', v_tpl.defaults->>'brief')
      returning id into v_graphic;
    end if;

    insert into public.tasks
      (club_id, title, deadline, priority, status, match_id, content_id, graphic_id, created_by)
    values
      (v_club, v_tpl.name || ' — ' || v_match.opponent, v_date, 'high', 'todo',
       p_match, v_content, v_graphic, auth.uid());

    v_graphic := null;
    v_count := v_count + 1;
  end loop;

  insert into public.activity_log (club_id, actor_id, action, entity_type, entity_id, summary)
  values (v_club, auth.uid(), 'generated', 'match', p_match,
          'Pacchetto editoriale generato (' || v_count || ' contenuti) per vs ' || v_match.opponent);

  return v_count;
end $$;

-- ============================================================
-- STORAGE — bucket unico "club-media", path: {club_id}/...
-- ============================================================
insert into storage.buckets (id, name, public)
values ('club-media', 'club-media', true)
on conflict (id) do nothing;

create policy "club media read" on storage.objects for select
  using (bucket_id = 'club-media');

create policy "club media upload" on storage.objects for insert
  with check (
    bucket_id = 'club-media'
    and public.has_perm(((storage.foldername(name))[1])::uuid, 'media.upload')
  );

create policy "club media update" on storage.objects for update
  using (
    bucket_id = 'club-media'
    and public.has_perm(((storage.foldername(name))[1])::uuid, 'media.upload')
  );

create policy "club media delete" on storage.objects for delete
  using (
    bucket_id = 'club-media'
    and public.has_perm(((storage.foldername(name))[1])::uuid, 'media.manage')
  );
