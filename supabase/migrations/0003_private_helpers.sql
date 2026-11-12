-- VISTOON 0003: keep helper functions out of the public REST API (found by the Supabase security advisor).
-- Trigger function: nobody needs to call it; the trigger still fires.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Move RLS helpers to a schema the API does not expose. Policies follow the functions (they depend on OIDs).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.is_admin() set schema private;
alter function public.is_admin_mfa() set schema private;
-- Re-create the MFA helper so its body points at the moved function.
create or replace function private.is_admin_mfa() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() and coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;
revoke all on function private.is_admin(), private.is_admin_mfa() from public, anon;
grant execute on function private.is_admin(), private.is_admin_mfa() to authenticated;
