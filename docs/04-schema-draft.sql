-- VISTOON schema draft v0 (PostgreSQL / Supabase). DRAFT: not applied anywhere. Migrations start on Day 4.
-- Rule: every user-owned table has user_id and a row-level-security policy "user_id = auth.uid()".

create type job_state as enum ('queued','aligning_audio','planning','storyboarding','awaiting_review',
  'rendering','mixing','mastering','quality_checking','completed','failed','cancelled');
create type style_status as enum ('draft','needs_review','testing','verified','published');
create type app_role as enum ('user','admin');

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text, role app_role not null default 'user', created_at timestamptz default now());

create table projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles,
  name text not null, format text check (format in ('shorts','long')), language text check (language in ('en','hinglish','hi')),
  ratio text, archived_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());

create table assets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles,
  project_id uuid references projects on delete cascade, kind text not null check (kind in ('voiceover','reference','output','still')),
  storage_key text not null, mime text not null, bytes bigint not null, sha256 text,
  rights_confirmed boolean not null default false, created_at timestamptz default now());

create table scripts (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles,
  project_id uuid not null references projects on delete cascade, created_at timestamptz default now());
create table script_versions (
  id uuid primary key default gen_random_uuid(), script_id uuid not null references scripts on delete cascade,
  body text not null, count_type text check (count_type in ('words','chars')), target_count int, actual_count int,
  counter_policy text not null,            -- documented counting convention (Day 9)
  scores jsonb, created_at timestamptz default now());

create table dna_collections (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles, name text not null);
create table dna_transcripts (id uuid primary key default gen_random_uuid(), collection_id uuid not null references dna_collections on delete cascade, body text not null);
create table dna_findings (
  id uuid primary key default gen_random_uuid(), collection_id uuid not null references dna_collections on delete cascade,
  label text not null check (label in ('CORE_PATTERN','HIGH_PERFORMER_ASSOCIATION','CONTEXT_DEPENDENT','RARE_TECHNIQUE','UNVERIFIED_HYPOTHESIS')),
  technique text not null, evidence jsonb not null,        -- transcript ids + quoted spans; a finding without evidence is rejected
  sample_count int not null, confidence text);

create table styles (id uuid primary key default gen_random_uuid(), name text not null, category text, status style_status not null default 'draft');
create table style_versions (
  id uuid primary key default gen_random_uuid(), style_id uuid not null references styles, version text not null,
  adapter text not null, package_sha256 text not null, capabilities jsonb not null,
  verified_at timestamptz, verified_job_id uuid, unique (style_id, version));   -- 'verified' requires an isolated test render

create table render_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles,
  project_id uuid not null references projects, style_version_id uuid not null references style_versions,
  script_version_id uuid not null references script_versions, state job_state not null default 'queued',
  progress int default 0 check (progress between 0 and 100), attempt int default 0, heartbeat_at timestamptz,
  request jsonb not null, error text, created_at timestamptz default now(), finished_at timestamptz);
create table job_events (id bigserial primary key, job_id uuid not null references render_jobs on delete cascade, state job_state, message text, at timestamptz default now());
create table outputs (id uuid primary key default gen_random_uuid(), job_id uuid not null references render_jobs, asset_id uuid not null references assets,
  seconds numeric, width int, height int, qa jsonb not null, tool_versions jsonb);

create table usage_events (id bigserial primary key, user_id uuid not null references profiles, kind text not null, quantity numeric not null, cost_usd numeric, at timestamptz default now());
create table subscriptions (user_id uuid primary key references profiles, plan text not null default 'free', status text, provider_customer_id text, current_period_end timestamptz);
create table audit_log (id bigserial primary key, actor uuid, action text not null, target text, meta jsonb, at timestamptz default now());

-- RLS (to be written per table on Day 4), e.g.:
-- alter table projects enable row level security;
-- create policy own_rows on projects using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Admin-only tables (styles write, audit_log) are writable only through server code that checks role = 'admin'.
