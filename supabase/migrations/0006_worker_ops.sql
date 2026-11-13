-- VISTOON 0006 (Day 6): worker liveness + stuck-job recovery. Service-role only; no client access.

create table public.worker_status (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  info jsonb not null default '{}'
);
alter table public.worker_status enable row level security;  -- no grants, no policies: only the service role can touch it

-- Jobs a worker was running when it stopped sending heartbeats. 'awaiting_review' waits for a human, not a worker, so it is excluded.
-- Under the attempt cap the job is re-queued; at the cap it fails for good. Every change leaves a job_events row.
create function public.reap_stuck_jobs(stale_after interval, max_attempts int)
returns table (out_job_id uuid, out_owner_id uuid, out_action text)
language plpgsql security invoker set search_path = '' as $$
begin
  return query
  with stuck as (
    select j.id, j.user_id, j.attempt
    from public.render_jobs j
    where j.state in ('aligning_audio','planning','storyboarding','rendering','mixing','mastering','quality_checking')
      and coalesce(j.heartbeat_at, j.created_at) < now() - stale_after
    for update skip locked
  ), upd as (
    update public.render_jobs j
       set state = case when s.attempt + 1 >= max_attempts then 'failed'::public.job_state else 'queued'::public.job_state end,
           attempt = s.attempt + 1,
           error = case when s.attempt + 1 >= max_attempts then 'worker lost: no heartbeat, attempts exhausted' else 'worker lost: no heartbeat, re-queued' end,
           progress = case when s.attempt + 1 >= max_attempts then j.progress else 0 end,
           finished_at = case when s.attempt + 1 >= max_attempts then now() else null end,
           heartbeat_at = null
      from stuck s where j.id = s.id
    returning j.id, j.user_id, j.state
  ), ev as (
    insert into public.job_events (job_id, user_id, state, message)
    select u.id, u.user_id, u.state, 'reaper: no heartbeat from worker' from upd u
    returning job_id
  )
  select u.id, u.user_id, case when u.state = 'failed' then 'failed' else 'requeued' end from upd u;
end $$;
revoke all on function public.reap_stuck_jobs(interval, int) from public, anon, authenticated;
grant execute on function public.reap_stuck_jobs(interval, int) to service_role;

-- Read-only: jobs that have sat in 'queued' too long (queue entry probably lost). Reported, not modified.
create function public.stale_queued_jobs(older_than interval)
returns table (out_job_id uuid, out_owner_id uuid, out_queued_since timestamptz)
language sql stable security invoker set search_path = '' as $$
  select id, user_id, created_at from public.render_jobs where state = 'queued' and created_at < now() - older_than
$$;
revoke all on function public.stale_queued_jobs(interval) from public, anon, authenticated;
grant execute on function public.stale_queued_jobs(interval) to service_role;
