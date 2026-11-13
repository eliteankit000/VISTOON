-- Day 10: revision chain with a hard limit of 3 rounds, enforced by the database.
alter table public.script_versions drop constraint script_versions_kind_check;
alter table public.script_versions add constraint script_versions_kind_check check (kind in ('generated','edit','autosave','revision'));
alter table public.script_versions add column revision_round int not null default 0 check (revision_round between 0 and 3);
alter table public.script_versions add column parent_id uuid references public.script_versions on delete set null;
alter table public.script_versions add constraint script_versions_revision_shape check ((kind = 'revision') = (revision_round > 0));

-- A parent must be a version of the same script, and a revision is exactly one round after its parent.
create function private.check_revision() returns trigger language plpgsql set search_path = '' as $$
declare p public.script_versions;
begin
  if new.parent_id is null then
    if new.kind = 'revision' then raise exception 'revision_needs_parent'; end if;
    return new;
  end if;
  select * into p from public.script_versions where id = new.parent_id;
  if not found or p.script_id <> new.script_id then raise exception 'invalid_parent'; end if;
  if new.kind = 'revision' and new.revision_round <> p.revision_round + 1 then raise exception 'revision_round_mismatch'; end if;
  return new;
end $$;
create trigger script_versions_revision before insert on public.script_versions for each row execute function private.check_revision();
revoke all on function private.check_revision() from public, anon, authenticated;
