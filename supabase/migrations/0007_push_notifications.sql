-- ============================================================
-- RSB CLUB OS — 0007 PUSH NOTIFICATIONS
-- Preferenze per utente + sottoscrizioni Web Push + trigger → Edge Function
-- (la versione applicata in produzione include l'anon key nel trigger)
-- ============================================================

alter table public.profiles
  add column notification_prefs jsonb not null default '{}'::jsonb;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subs_own on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create extension if not exists pg_net;

-- create or replace function public.notify_push() ... (vedi produzione)
-- create trigger notifications_push after insert on public.notifications ...
