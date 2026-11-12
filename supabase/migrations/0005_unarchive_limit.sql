-- VISTOON 0005: un-archiving a project must respect the plan's project limit too.
create trigger projects_limit_unarchive before update of archived_at on public.projects
  for each row when (old.archived_at is not null and new.archived_at is null)
  execute function private.enforce_project_limit();
