-- VISTOON 0001: core schema. Version-controlled migration (Day 4).
create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'admin');
create type public.job_state as enum ('queued','aligning_audio','planning','storyboarding','awaiting_review',
  'rendering','mixing','mastering','quality_checking','completed','failed','cancelled');
create type public.style_status as enum ('draft','needs_review','testing','verified','published');

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  format text check (format in ('shorts','long')),
  language text check (language in ('en','hinglish','hi')),
  ratio text check (ratio in ('9:16','16:9','1:1')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects (user_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  project_id uuid references public.projects on delete cascade,
  kind text not null check (kind in ('voiceover','reference','output','still')),
  storage_key text not null,
  mime text not null,
  bytes bigint not null check (bytes >= 0),
  sha256 text,
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.assets (user_id);
create index on public.assets (project_id);

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.scripts (user_id);

create table public.script_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  script_id uuid not null references public.scripts on delete cascade,
  body text not null,
  count_type text check (count_type in ('words','chars')),
  target_count int,
  actual_count int,
  counter_policy text not null default 'unset',
  scores jsonb,
  created_at timestamptz not null default now()
);
create index on public.script_versions (user_id);

create table public.dna_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.dna_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  collection_id uuid not null references public.dna_collections on delete cascade,
  body text not null
);
create table public.dna_findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  collection_id uuid not null references public.dna_collections on delete cascade,
  label text not null check (label in ('CORE_PATTERN','HIGH_PERFORMER_ASSOCIATION','CONTEXT_DEPENDENT','RARE_TECHNIQUE','UNVERIFIED_HYPOTHESIS')),
  technique text not null,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) > 0),
  sample_count int not null check (sample_count > 0),
  confidence text
);
create index on public.dna_transcripts (user_id);
create index on public.dna_findings (user_id);

create table public.styles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  status public.style_status not null default 'draft',
  created_at timestamptz not null default now()
);
create table public.style_versions (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.styles on delete cascade,
  version text not null,
  adapter text not null,
  package_sha256 text not null,
  capabilities jsonb not null default '{}',
  verified_at timestamptz,
  verified_job_id uuid,
  unique (style_id, version)
);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  style_version_id uuid not null references public.style_versions,
  script_version_id uuid not null references public.script_versions,
  state public.job_state not null default 'queued',
  progress int not null default 0 check (progress between 0 and 100),
  attempt int not null default 0,
  heartbeat_at timestamptz,
  request jsonb not null,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on public.render_jobs (user_id);
create index on public.render_jobs (state, heartbeat_at);

create table public.job_events (
  id bigserial primary key,
  job_id uuid not null references public.render_jobs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  state public.job_state, message text, at timestamptz not null default now()
);
create table public.outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  job_id uuid not null references public.render_jobs on delete cascade,
  asset_id uuid not null references public.assets,
  seconds numeric, width int, height int,
  qa jsonb not null, tool_versions jsonb
);
create table public.usage_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null, quantity numeric not null, cost_usd numeric,
  at timestamptz not null default now()
);
create table public.subscriptions (
  user_id uuid primary key references public.profiles on delete cascade,
  plan text not null default 'free', status text,
  provider_customer_id text, current_period_end timestamptz
);
create table public.audit_log (
  id bigserial primary key,
  actor uuid, action text not null, target text, meta jsonb,
  at timestamptz not null default now()
);

-- Every new auth user gets a profile (role 'user') and a free subscription row.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name) values (new.id, nullif(left(new.raw_user_meta_data->>'display_name', 80), ''));
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
