-- Day 7: kill switches, feature flags, role management, tamper-resistant audit log.

-- Kill switches: an engaged switch blocks the operation in the DATABASE, so no code path can bypass it.
create table public.kill_switches (
  key text primary key check (key ~ '^[a-z_]{3,40}$'),
  engaged boolean not null default false,
  reason text check (char_length(reason) <= 300),
  description text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table public.feature_flags (
  key text primary key check (key ~ '^[a-z_]{3,40}$'),
  enabled boolean not null default false,
  description text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.kill_switches enable row level security;
alter table public.feature_flags enable row level security;
-- Everyone signed in may READ (the UI shows "uploads are paused"); nobody may write from the client.
grant select on public.kill_switches, public.feature_flags to authenticated;
create policy kill_switches_select on public.kill_switches for select to authenticated using (true);
create policy feature_flags_select on public.feature_flags for select to authenticated using (true);

insert into public.kill_switches (key, description) values
 ('uploads', 'Block all new file uploads'),
 ('rendering', 'Block new render jobs'),
 ('script_generation', 'Block new AI script generation');
insert into public.feature_flags (key, enabled, description) values
 ('dna_analyzer', true, 'Script DNA Analyzer'),
 ('reference_studio', true, 'Reference Studio'),
 ('video_studio', true, 'Video Studio');

create function private.switch_engaged(k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select engaged from public.kill_switches where key = k), false)
$$;
revoke all on function private.switch_engaged(text) from public;

create function public.block_when_uploads_killed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.switch_engaged('uploads') then raise exception 'uploads_disabled'; end if;
  return new;
end $$;
create trigger assets_kill_switch before insert on public.assets for each row execute function public.block_when_uploads_killed();

create function public.block_when_rendering_killed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.switch_engaged('rendering') then raise exception 'rendering_disabled'; end if;
  return new;
end $$;
create trigger render_jobs_kill_switch before insert on public.render_jobs for each row execute function public.block_when_rendering_killed();
revoke all on function public.block_when_uploads_killed(), public.block_when_rendering_killed() from public, anon, authenticated;

-- The audit log is append-only for everyone, including the service role.
create function public.audit_log_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'audit_log_is_append_only'; end $$;
create trigger audit_log_no_change before update or delete on public.audit_log for each row execute function public.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function public.audit_log_immutable();
revoke all on function public.audit_log_immutable() from public, anon, authenticated;

-- Admin actions. Each one re-checks that the actor is an admin and writes its audit row in the same transaction.
create function public.admin_set_role(actor uuid, target uuid, new_role public.app_role) returns void
language plpgsql security invoker set search_path = '' as $$
declare old public.app_role;
begin
  if not exists (select 1 from public.profiles where user_id = actor and role = 'admin') then raise exception 'not_admin'; end if;
  if actor = target then raise exception 'cannot_change_own_role'; end if;
  select role into old from public.profiles where user_id = target for update;
  if not found then raise exception 'user_not_found'; end if;
  if old = new_role then return; end if;
  update public.profiles set role = new_role where user_id = target;
  insert into public.audit_log (actor, action, target, meta) values (actor, 'user.role', target::text, jsonb_build_object('from', old, 'to', new_role));
end $$;

create function public.admin_set_switch(actor uuid, k text, on_off boolean, why text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where user_id = actor and role = 'admin') then raise exception 'not_admin'; end if;
  if on_off and (why is null or char_length(btrim(why)) < 3) then raise exception 'reason_required'; end if;
  update public.kill_switches set engaged = on_off, reason = case when on_off then left(btrim(why), 300) else null end, updated_by = actor, updated_at = now() where key = k;
  if not found then raise exception 'unknown_switch'; end if;
  insert into public.audit_log (actor, action, target, meta) values (actor, 'killswitch.' || case when on_off then 'engage' else 'release' end, k, jsonb_build_object('reason', why));
end $$;

create function public.admin_set_flag(actor uuid, k text, on_off boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where user_id = actor and role = 'admin') then raise exception 'not_admin'; end if;
  update public.feature_flags set enabled = on_off, updated_by = actor, updated_at = now() where key = k;
  if not found then raise exception 'unknown_flag'; end if;
  insert into public.audit_log (actor, action, target, meta) values (actor, 'flag.set', k, jsonb_build_object('enabled', on_off));
end $$;

revoke all on function public.admin_set_role(uuid, uuid, public.app_role), public.admin_set_switch(uuid, text, boolean, text), public.admin_set_flag(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_role(uuid, uuid, public.app_role), public.admin_set_switch(uuid, text, boolean, text), public.admin_set_flag(uuid, text, boolean) to service_role;
