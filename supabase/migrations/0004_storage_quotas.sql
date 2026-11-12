-- VISTOON 0004 (Day 5): private storage, server-only writes for assets/projects-delete, quotas.

-- 1. Asset rows describe files we have verified, so users must not write them directly
--    (a forged row could point at someone else's object or lie about size to dodge quota).
drop policy assets_all on public.assets;
revoke insert, update, delete on public.assets from authenticated;
create policy assets_select on public.assets for select to authenticated using (user_id = auth.uid());
-- Deleting a project must also delete its stored files, which only server code can do.
revoke delete on public.projects from authenticated;

alter table public.assets
  add column original_name text check (char_length(original_name) <= 200),
  add column status text not null default 'pending' check (status in ('pending','ready')),
  add column archived_at timestamptz,
  add constraint assets_storage_key_unique unique (storage_key),
  -- every object key must live under its owner's folder: "<user_id>/..."
  add constraint assets_key_owner_prefix check (storage_key like user_id::text || '/%');

-- 2. Plan limits (quota foundation).
create table public.plan_limits (
  plan text primary key,
  max_projects int not null check (max_projects >= 0),
  max_storage_bytes bigint not null check (max_storage_bytes >= 0),
  max_pending_uploads int not null default 10
);
insert into public.plan_limits values ('free', 5, 1073741824, 10), ('pro', 100, 53687091200, 10);
alter table public.subscriptions add constraint subscriptions_plan_fk foreign key (plan) references public.plan_limits (plan);
alter table public.plan_limits enable row level security;
grant select on public.plan_limits to authenticated;
create policy plan_limits_select on public.plan_limits for select to authenticated using (true);

-- 3. Quota enforcement inside the database (cannot be skipped by a bug in app code).
create function private.enforce_project_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim int; n int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1));
  select pl.max_projects into lim from public.subscriptions s join public.plan_limits pl on pl.plan = s.plan where s.user_id = new.user_id;
  select count(*) into n from public.projects where user_id = new.user_id and archived_at is null;
  if n >= coalesce(lim, 0) then raise exception 'project_limit_reached'; end if;
  return new;
end $$;
create trigger projects_limit before insert on public.projects for each row execute function private.enforce_project_limit();

create function private.enforce_asset_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim bigint; maxp int; used bigint; pend int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 2));
  select pl.max_storage_bytes, pl.max_pending_uploads into lim, maxp
    from public.subscriptions s join public.plan_limits pl on pl.plan = s.plan where s.user_id = new.user_id;
  select coalesce(sum(bytes), 0), count(*) filter (where status = 'pending') into used, pend from public.assets where user_id = new.user_id;
  if used + new.bytes > coalesce(lim, 0) then raise exception 'storage_quota_exceeded'; end if;
  if new.status = 'pending' and pend >= coalesce(maxp, 0) then raise exception 'too_many_pending_uploads'; end if;
  return new;
end $$;
create trigger assets_quota before insert on public.assets for each row execute function private.enforce_asset_quota();

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();
revoke all on function private.enforce_project_limit(), private.enforce_asset_quota(), private.touch_updated_at() from public, anon, authenticated;

-- 4. Private bucket. No policies on storage.objects = no direct client access at all:
--    every upload/download goes through our API, which issues short-lived signed URLs after ownership checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vistoon-private', 'vistoon-private', false, 52428800,
  array['audio/mpeg','audio/wav','audio/mp4','image/png','image/jpeg','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
