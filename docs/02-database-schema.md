# STEP 2 — Database Schema

Implementato in `supabase/migrations/` (fonte di verità). Postgres 17 su Supabase,
RLS attiva su ogni tabella. Progetto: **RSB CLUB OS** (`gjxsjqdtfsudabrvhuob`, eu-west-1).

## Tenancy & identità

| Tabella | Campi chiave | Note |
|---|---|---|
| organizations | name, slug | AUVI |
| clubs | organization_id FK, name, slug, colors jsonb, settings jsonb | multi-club ready |
| seasons | club_id FK, name, is_current | |
| competitions | club_id FK, name | |
| profiles | id = auth.users.id, full_name, avatar_url | trigger auto-create al signup |

## RBAC (data-driven, zero hardcoded)

| Tabella | Campi | Note |
|---|---|---|
| roles | club_id FK (null = template globale), slug, name | 6 ruoli seed, altri creabili |
| permissions | key PK, description | 17 chiavi |
| role_permissions | role_id × permission_key | M2M |
| memberships | user_id × club_id × role_id, unique(user,club) | l'utente appartiene al club CON un ruolo |

Funzioni security definer (niente ricorsione RLS): `is_member(club)`, `has_perm(club, perm)`,
`my_permissions(club)`, `bootstrap_first_admin()`, `add_member_by_email(club, email, role_slug)`.

## Dominio

| Tabella | FK principali | Note |
|---|---|---|
| players | club_id | anagrafica completa + socials jsonb + custom_fields jsonb + status enum |
| matches | club_id, season_id, competition_id | kickoff_at timestamptz, our_score/opponent_score, status enum |
| match_events | match_id, player_id | goal/assist/cartellini/sub, minute |
| match_lineup | match_id × player_id | is_starting |
| content_types | club_id, slug | lookup estensibile (20 seed) |
| social_channels | club_id, slug | lookup estensibile (7 seed) |
| content | club_id, content_type_id, channel_id, match_id, owner_id, reviewer_id | status enum a 10 stati, publish_date+time |
| content_players | content_id × player_id | M2M |
| media | club_id, match_id, content_id, author_id | kind enum, category, tags text[], storage_path |
| media_players | media_id × player_id | M2M |
| graphics | club_id, content_id, match_id, player_id, designer_id, requested_by | status enum a 6 stati = colonne kanban |
| graphic_versions | graphic_id, media_id, uploaded_by | V1/V2/FINAL, storico completo |
| tasks | club_id, owner_id, player_id, match_id, content_id, graphic_id | status+priority enum |
| task_assignees | task_id × user_id | collaboratori M2M |
| comments | club_id, entity_type+entity_id (polimorfico), mentions uuid[] | su content/graphic/task/match/player/media |
| notifications | club_id, user_id, type enum, entity_type+entity_id | campanella |
| activity_log | club_id, actor_id, action, entity_type+entity_id, summary, meta | audit + feed |
| content_templates | club_id, slug, is_match_pack, defaults jsonb | motore Generate Match Content |

## Enum

- content_status: idea → planned → copy → graphic_requested → in_production → review → approved → scheduled → published (+cancelled)
- graphic_status: requested → todo → in_progress → review → approved → published
- task_status: todo, in_progress, review, done, blocked · priority: low/medium/high/urgent
- player_position GK/DF/MF/FW · player_status available/injured/suspended/unavailable
- match_status upcoming/live/finished/postponed/cancelled

## RLS (pattern)

- SELECT: `is_member(club_id)` ovunque (notifications: solo proprie).
- WRITE: `has_perm(club_id, '<area>.<azione>')` — es. content insert → content.create,
  graphics update → graphics.produce OR graphics.approve, tasks update → tasks.manage OR owner OR assegnatario.
- Storage: bucket pubblico `club-media`, path `{club_id}/…`; upload/delete verificano il permesso
  sul primo segmento del path.

## Automazioni DB

- `generate_match_pack(match_id)`: crea content + graphic + task da ogni template match-pack
  (idempotente: salta i titoli già esistenti per la partita), date calcolate da kickoff ± offset_days.
- Trigger `set_updated_at` su players/matches/content/graphics/tasks.
- Trigger `handle_new_user`: profilo automatico al signup.
