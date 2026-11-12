-- VISTOON 0002: row-level security. Default deny; every grant below is deliberate.

-- Helpers read the caller's identity from the JWT, never from client input.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where user_id = auth.uid()), false)
$$;
-- Admin WRITES additionally require an MFA-verified session (JWT aal2).
create function public.is_admin_mfa() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;
revoke all on function public.is_admin(), public.is_admin_mfa() from public, anon;
grant execute on function public.is_admin(), public.is_admin_mfa() to authenticated;

-- Start from nothing: anon gets no access at all; authenticated gets only what is granted below.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.assets         enable row level security;
alter table public.scripts        enable row level security;
alter table public.script_versions enable row level security;
alter table public.dna_collections enable row level security;
alter table public.dna_transcripts enable row level security;
alter table public.dna_findings   enable row level security;
alter table public.styles         enable row level security;
alter table public.style_versions enable row level security;
alter table public.render_jobs    enable row level security;
alter table public.job_events     enable row level security;
alter table public.outputs        enable row level security;
alter table public.usage_events   enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.audit_log      enable row level security;

-- profiles: read own (admin reads all); users may change ONLY display_name. Role is immutable from the client.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- projects: full CRUD on own rows.
grant select, insert, update, delete on public.projects to authenticated;
create policy projects_all on public.projects for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- assets: own rows; may only attach to own project. (Rows are created after server-side upload validation.)
grant select, insert, update, delete on public.assets to authenticated;
create policy assets_all on public.assets for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())));

-- scripts / versions: own rows; parent must also be own.
grant select, insert, update, delete on public.scripts, public.script_versions to authenticated;
create policy scripts_all on public.scripts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create policy script_versions_all on public.script_versions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.scripts s where s.id = script_id and s.user_id = auth.uid()));

-- DNA: own rows; parent collection must be own.
grant select, insert, update, delete on public.dna_collections, public.dna_transcripts, public.dna_findings to authenticated;
create policy dna_collections_all on public.dna_collections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dna_transcripts_all on public.dna_transcripts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.dna_collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy dna_findings_all on public.dna_findings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.dna_collections c where c.id = collection_id and c.user_id = auth.uid()));

-- styles: users see only PUBLISHED; admins see all; writes need admin + MFA.
grant select, insert, update, delete on public.styles, public.style_versions to authenticated;
create policy styles_select on public.styles for select to authenticated using (status = 'published' or public.is_admin());
create policy styles_write on public.styles for all to authenticated using (public.is_admin_mfa()) with check (public.is_admin_mfa());
create policy style_versions_select on public.style_versions for select to authenticated
  using (public.is_admin() or exists (select 1 from public.styles s where s.id = style_id and s.status = 'published'));
create policy style_versions_write on public.style_versions for all to authenticated using (public.is_admin_mfa()) with check (public.is_admin_mfa());

-- Render pipeline tables: users can READ their own. They can never write: jobs are created and updated
-- only by server code with the service-role key after validation, quota and ownership checks.
grant select on public.render_jobs, public.job_events, public.outputs, public.usage_events, public.subscriptions to authenticated;
create policy render_jobs_select on public.render_jobs for select to authenticated using (user_id = auth.uid());
create policy job_events_select   on public.job_events   for select to authenticated using (user_id = auth.uid());
create policy outputs_select      on public.outputs      for select to authenticated using (user_id = auth.uid());
create policy usage_events_select on public.usage_events for select to authenticated using (user_id = auth.uid());
create policy subscriptions_select on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- Audit log: admins read; nobody writes from the client (server writes with service role).
grant select on public.audit_log to authenticated;
create policy audit_log_select on public.audit_log for select to authenticated using (public.is_admin());

-- Future tables must not be auto-exposed to API roles.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
