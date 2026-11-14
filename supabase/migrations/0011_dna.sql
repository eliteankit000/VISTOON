-- Day 11: DNA Analyzer. Collections of transcripts, cached per-transcript observations, evidence-bearing findings, analysis runs.
alter table public.dna_collections add column description text check (char_length(description) <= 500);
alter table public.dna_collections add column updated_at timestamptz not null default now();

alter table public.dna_transcripts add column title text not null default 'Untitled' check (char_length(title) between 1 and 200);
alter table public.dna_transcripts add column language text not null default 'unknown' check (language in ('en','hi','hinglish','unknown'));
alter table public.dna_transcripts add column word_count int not null default 0 check (word_count >= 0);
alter table public.dna_transcripts add column excluded boolean not null default false;
alter table public.dna_transcripts add column high_performer boolean not null default false;
alter table public.dna_transcripts add column body_sha256 text not null default '';
alter table public.dna_transcripts add column created_at timestamptz not null default now();
alter table public.dna_transcripts add constraint dna_transcripts_body_len check (char_length(body) between 50 and 100000);
create unique index dna_transcripts_no_dupes on public.dna_transcripts (collection_id, body_sha256) where body_sha256 <> '';
create index dna_transcripts_collection on public.dna_transcripts (collection_id, created_at);

alter table public.dna_findings add column technique_key text not null default '';
alter table public.dna_findings add column explanation text not null default '' check (char_length(explanation) <= 2000);
alter table public.dna_findings add column counterexamples jsonb not null default '[]' check (jsonb_typeof(counterexamples) = 'array');
alter table public.dna_findings add column status text not null default 'proposed' check (status in ('proposed','accepted','edited','rejected'));
alter table public.dna_findings add column created_at timestamptz not null default now();
alter table public.dna_findings add column updated_at timestamptz not null default now();
create unique index dna_findings_one_per_technique on public.dna_findings (collection_id, technique_key) where technique_key <> '';

create table public.dna_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  transcript_id uuid not null references public.dna_transcripts on delete cascade,
  prompt_version text not null,
  observations jsonb not null check (jsonb_typeof(observations) = 'array'),
  created_at timestamptz not null default now(),
  unique (transcript_id, prompt_version)
);
create table public.dna_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  collection_id uuid not null references public.dna_collections on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  transcript_count int not null default 0,
  error text check (char_length(error) <= 300),
  model text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
-- Only one unfinished analysis per collection.
create unique index dna_analyses_one_active on public.dna_analyses (collection_id) where status in ('queued','running');
create index dna_analyses_collection on public.dna_analyses (collection_id, created_at desc);

alter table public.dna_observations enable row level security;
alter table public.dna_analyses enable row level security;
-- Users READ these; only the server (service role) writes them.
grant select on public.dna_observations, public.dna_analyses to authenticated;
create policy dna_observations_select on public.dna_observations for select to authenticated using (user_id = auth.uid());
create policy dna_analyses_select on public.dna_analyses for select to authenticated using (user_id = auth.uid());

-- Limits: 20 collections per user, 30 transcripts per collection.
create function private.enforce_collection_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.dna_collections where user_id = new.user_id) >= 20 then raise exception 'collection_limit_reached'; end if;
  return new;
end $$;
create function private.enforce_transcript_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.dna_transcripts where collection_id = new.collection_id) >= 30 then raise exception 'transcript_limit_reached'; end if;
  return new;
end $$;
create trigger dna_collections_limit before insert on public.dna_collections for each row execute function private.enforce_collection_limit();
create trigger dna_transcripts_limit before insert on public.dna_transcripts for each row execute function private.enforce_transcript_limit();
create trigger dna_findings_touch before update on public.dna_findings for each row execute function private.touch_updated_at();
create trigger dna_collections_touch before update on public.dna_collections for each row execute function private.touch_updated_at();
revoke all on function private.enforce_collection_limit(), private.enforce_transcript_limit() from public, anon, authenticated;
