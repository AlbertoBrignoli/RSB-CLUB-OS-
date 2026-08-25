-- ============================================================
-- RSB CLUB OS — 0008 LIVE & FORMATION
-- Modalità live (parziali, eventi rapidi) + lavagnetta formazione
-- ============================================================

alter table public.matches add column formation text;
alter table public.matches add column ht_our_score int;
alter table public.matches add column ht_opponent_score int;

alter table public.match_lineup add column slot int;

alter type public.match_event_type add value if not exists 'penalty_saved';
