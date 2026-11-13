-- Day 9: version kinds, single autosave slot per script, size and count limits.
alter table public.script_versions add column kind text not null default 'generated' check (kind in ('generated','edit','autosave'));
alter table public.script_versions add constraint script_versions_body_len check (char_length(body) <= 60000);
alter table public.script_versions add constraint script_versions_target_ok check (target_count is null or target_count between 1 and 200000);
alter table public.script_versions add column updated_at timestamptz not null default now();
-- At most ONE autosave row per script: autosaves overwrite it instead of piling up as history.
create unique index script_versions_one_autosave on public.script_versions (script_id) where kind = 'autosave';
create index script_versions_script_created on public.script_versions (script_id, created_at desc);

-- Cap history per script so a client cannot fill the database with versions.
create function private.enforce_version_cap() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.script_versions where script_id = new.script_id) >= 200 then raise exception 'version_limit_reached'; end if;
  return new;
end $$;
create trigger script_versions_cap before insert on public.script_versions for each row execute function private.enforce_version_cap();

create trigger script_versions_touch before update on public.script_versions for each row execute function private.touch_updated_at();
revoke all on function private.enforce_version_cap() from public, anon, authenticated;
