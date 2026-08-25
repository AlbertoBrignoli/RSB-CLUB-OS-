-- ============================================================
-- RSB CLUB OS — 0004 SEED
-- AUVI → Real San Basilio, stagione, RBAC, tipi, canali, template
-- ============================================================

insert into public.organizations (id, name, slug)
values ('a0000000-0000-4000-8000-000000000001', 'AUVI', 'auvi');

insert into public.clubs (id, organization_id, name, short_name, slug, colors)
values ('c0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001',
        'Real San Basilio', 'RSB', 'real-san-basilio',
        '{"primary":"#8B1E2D","accent":"#D4A94E"}'::jsonb);

insert into public.seasons (club_id, name, start_date, end_date, is_current)
values ('c0000000-0000-4000-8000-000000000001', '2026/27', '2026-08-01', '2027-06-30', true);

insert into public.competitions (club_id, name) values
  ('c0000000-0000-4000-8000-000000000001', 'Campionato'),
  ('c0000000-0000-4000-8000-000000000001', 'Coppa'),
  ('c0000000-0000-4000-8000-000000000001', 'Amichevole');

-- ---------- PERMISSIONS ----------

insert into public.permissions (key, description) values
  ('players.manage',  'Creare e modificare giocatori e rosa'),
  ('matches.manage',  'Creare e modificare partite, risultati ed eventi'),
  ('content.create',  'Creare contenuti'),
  ('content.edit',    'Modificare contenuti, caption, calendario e programmazione'),
  ('content.approve', 'Approvare contenuti'),
  ('content.delete',  'Eliminare contenuti'),
  ('graphics.request','Richiedere grafiche'),
  ('graphics.produce','Lavorare grafiche: versioni e stato produzione'),
  ('graphics.approve','Approvare grafiche'),
  ('media.upload',    'Caricare media'),
  ('media.manage',    'Gestire ed eliminare media'),
  ('tasks.create',    'Creare task'),
  ('tasks.manage',    'Gestire, assegnare ed eliminare task'),
  ('comments.create', 'Commentare'),
  ('reports.view',    'Vedere report e KPI'),
  ('users.manage',    'Gestire utenti, ruoli e permessi'),
  ('settings.manage', 'Gestire impostazioni del club');

-- ---------- ROLES ----------

insert into public.roles (id, club_id, slug, name, description, is_system) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'super_admin',          'Super Admin AUVI',      'Accesso completo alla piattaforma', true),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'project_manager',      'Project Manager',       'Responsabile operativo del progetto', true),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'social_media_manager', 'Social Media Manager',  'Contenuti, caption, calendario editoriale', true),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'graphic_designer',     'Graphic Designer',      'Produzione grafiche', true),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'advisor',              'Advisor',               'Supervisione e approvazioni', true),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'super_advisor',        'Super Advisor',         'Supervisione generale', true);

-- Super Admin: tutto
insert into public.role_permissions (role_id, permission_key)
select 'b0000000-0000-4000-8000-000000000001', key from public.permissions;

-- Project Manager: tutto tranne utenti/impostazioni
insert into public.role_permissions (role_id, permission_key)
select 'b0000000-0000-4000-8000-000000000002', key from public.permissions
where key not in ('users.manage', 'settings.manage');

-- Social Media Manager
insert into public.role_permissions (role_id, permission_key) values
  ('b0000000-0000-4000-8000-000000000003', 'content.create'),
  ('b0000000-0000-4000-8000-000000000003', 'content.edit'),
  ('b0000000-0000-4000-8000-000000000003', 'graphics.request'),
  ('b0000000-0000-4000-8000-000000000003', 'media.upload'),
  ('b0000000-0000-4000-8000-000000000003', 'tasks.create'),
  ('b0000000-0000-4000-8000-000000000003', 'comments.create'),
  ('b0000000-0000-4000-8000-000000000003', 'reports.view');

-- Graphic Designer (vale anche per il secondo designer: stesso ruolo, altro utente)
insert into public.role_permissions (role_id, permission_key) values
  ('b0000000-0000-4000-8000-000000000004', 'graphics.produce'),
  ('b0000000-0000-4000-8000-000000000004', 'media.upload'),
  ('b0000000-0000-4000-8000-000000000004', 'tasks.create'),
  ('b0000000-0000-4000-8000-000000000004', 'comments.create');

-- Advisor
insert into public.role_permissions (role_id, permission_key) values
  ('b0000000-0000-4000-8000-000000000005', 'content.approve'),
  ('b0000000-0000-4000-8000-000000000005', 'comments.create'),
  ('b0000000-0000-4000-8000-000000000005', 'reports.view');

-- Super Advisor
insert into public.role_permissions (role_id, permission_key) values
  ('b0000000-0000-4000-8000-000000000006', 'content.approve'),
  ('b0000000-0000-4000-8000-000000000006', 'graphics.approve'),
  ('b0000000-0000-4000-8000-000000000006', 'comments.create'),
  ('b0000000-0000-4000-8000-000000000006', 'reports.view');

-- ---------- CONTENT TYPES ----------

insert into public.content_types (club_id, slug, name, sort)
select 'c0000000-0000-4000-8000-000000000001', t.slug, t.name, t.sort
from (values
  ('match_announcement', 'Match Announcement', 1),
  ('pre_match',    'Pre Match', 2),
  ('match_day',    'Match Day', 3),
  ('starting_xi',  'Starting XI', 4),
  ('half_time',    'Half Time', 5),
  ('final_score',  'Final Score', 6),
  ('post_match',   'Post Match', 7),
  ('motm',         'Man of the Match', 8),
  ('photo_gallery','Photo Gallery', 9),
  ('highlights',   'Highlights', 10),
  ('training',     'Training', 11),
  ('player_focus', 'Player Focus', 12),
  ('birthday',     'Birthday', 13),
  ('sponsor',      'Sponsor', 14),
  ('club_news',    'Club News', 15),
  ('transfer',     'Transfer', 16),
  ('bts',          'Behind The Scenes', 17),
  ('interview',    'Interview', 18),
  ('reel',         'Reel', 19),
  ('other',        'Other', 99)
) as t(slug, name, sort);

-- ---------- SOCIAL CHANNELS ----------

insert into public.social_channels (club_id, slug, name, sort)
select 'c0000000-0000-4000-8000-000000000001', t.slug, t.name, t.sort
from (values
  ('ig_feed',  'Instagram Feed', 1),
  ('ig_story', 'Instagram Story', 2),
  ('ig_reel',  'Instagram Reel', 3),
  ('facebook', 'Facebook', 4),
  ('tiktok',   'TikTok', 5),
  ('website',  'Website', 6),
  ('other',    'Other', 99)
) as t(slug, name, sort);

-- ---------- MATCH PACK TEMPLATES ----------

insert into public.content_templates (club_id, name, slug, is_match_pack, sort, defaults)
select 'c0000000-0000-4000-8000-000000000001', t.name, t.slug, true, t.sort, t.defaults::jsonb
from (values
  ('Match Announcement', 'match_announcement', 1,
   '{"content_type":"match_announcement","channel":"ig_feed","offset_days":-3,"publish_time":"18:00","needs_graphic":true,"brief":"Annuncio partita: avversario, data, ora, stadio."}'),
  ('Pre Match', 'pre_match', 2,
   '{"content_type":"pre_match","channel":"ig_feed","offset_days":-1,"publish_time":"18:00","needs_graphic":true,"brief":"Grafica pre-partita con countdown."}'),
  ('Match Day', 'match_day', 3,
   '{"content_type":"match_day","channel":"ig_feed","offset_days":0,"publish_time":"10:00","needs_graphic":true,"brief":"Grafica Match Day del giorno partita."}'),
  ('Starting XI', 'starting_xi', 4,
   '{"content_type":"starting_xi","channel":"ig_feed","offset_days":0,"publish_time":"14:30","needs_graphic":true,"brief":"Formazione titolare ufficiale."}'),
  ('Half Time', 'half_time', 5,
   '{"content_type":"half_time","channel":"ig_story","offset_days":0,"publish_time":"16:15","needs_graphic":true,"brief":"Parziale primo tempo."}'),
  ('Final Score', 'final_score', 6,
   '{"content_type":"final_score","channel":"ig_feed","offset_days":0,"publish_time":"17:15","needs_graphic":true,"brief":"Risultato finale con marcatori."}'),
  ('Post Match', 'post_match', 7,
   '{"content_type":"post_match","channel":"ig_feed","offset_days":1,"publish_time":"10:00","needs_graphic":true,"brief":"Recap post-partita."}'),
  ('Photo Gallery', 'photo_gallery', 8,
   '{"content_type":"photo_gallery","channel":"ig_feed","offset_days":1,"publish_time":"18:00","needs_graphic":false,"brief":"Selezione migliori foto della partita."}')
) as t(name, slug, sort, defaults);
