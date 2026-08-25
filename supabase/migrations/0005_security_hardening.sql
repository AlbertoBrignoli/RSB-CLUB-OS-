-- ============================================================
-- RSB CLUB OS — 0005 SECURITY HARDENING
-- search_path fisso + revoca EXECUTE dove non serve (advisor Supabase)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- handle_new_user è solo un trigger: mai invocabile via API
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Le RPC hanno senso solo da autenticati (e verificano i permessi al loro interno)
revoke execute on function public.bootstrap_first_admin() from anon;
revoke execute on function public.add_member_by_email(uuid, text, text) from anon;
revoke execute on function public.generate_match_pack(uuid) from anon;
revoke execute on function public.is_member(uuid) from anon;
revoke execute on function public.has_perm(uuid, text) from anon;
revoke execute on function public.my_permissions(uuid) from anon;
