-- Day 8: per-plan daily cap on AI script generations, reserved atomically BEFORE calling the LLM (cost control).
alter table public.plan_limits add column generations_per_day int not null default 20 check (generations_per_day >= 0);
update public.plan_limits set generations_per_day = 20 where plan = 'free';
update public.plan_limits set generations_per_day = 200 where plan = 'pro';

-- Returns the usage_event id. Raises script_generation_disabled (kill switch) or generation_limit_reached.
-- Advisory lock per user makes concurrent requests unable to slip past the cap.
create function public.reserve_script_generation(uid uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare cap int; used int; ev bigint;
begin
  if private.switch_engaged('script_generation') then raise exception 'script_generation_disabled'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gen:' || uid::text, 0));
  select pl.generations_per_day into cap from public.subscriptions s join public.plan_limits pl on pl.plan = s.plan where s.user_id = uid;
  if cap is null then raise exception 'user_not_found'; end if;
  select count(*) into used from public.usage_events where user_id = uid and kind = 'script_generation' and at > now() - interval '24 hours';
  if used >= cap then raise exception 'generation_limit_reached'; end if;
  insert into public.usage_events (user_id, kind, quantity) values (uid, 'script_generation', 1) returning id into ev;
  return ev;
end $$;
revoke all on function public.reserve_script_generation(uuid) from public, anon, authenticated;
grant execute on function public.reserve_script_generation(uuid) to service_role;
