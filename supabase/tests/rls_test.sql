-- RLS security tests. Each check RAISES on failure; the run stops at the first failure. Run via tests/run.sh.
\set ON_ERROR_STOP on
create temp table results(name text, ok boolean);
grant all on results to public;

-- Fixtures as superuser: users A, B and admin C (profiles created by the trigger).
insert into auth.users (id) values
 ('aaaaaaaa-0000-0000-0000-000000000001'),('bbbbbbbb-0000-0000-0000-000000000002'),('cccccccc-0000-0000-0000-000000000003');
update public.profiles set role = 'admin' where user_id = 'cccccccc-0000-0000-0000-000000000003';
insert into public.styles (id, name, status) values
 ('11111111-0000-0000-0000-000000000001','Pub','published'),('11111111-0000-0000-0000-000000000002','Draft','draft');

create function pg_temp.as_user(uid text, aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.check(name text, cond boolean) returns void language plpgsql as $$
begin insert into results values (name, cond); if not cond then raise exception 'FAIL: %', name; end if; end $$;
create function pg_temp.denied(name text, stmt text) returns void language plpgsql as $$
declare blocked boolean := false; n int;
begin
  begin execute stmt; get diagnostics n = row_count; blocked := (n = 0);
  exception when others then blocked := true; end;
  perform pg_temp.check(name, blocked);
end $$;
create function pg_temp.denied_msg(name text, stmt text, frag text) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin execute stmt; exception when others then ok := position(frag in sqlerrm) > 0; if not ok then raise notice 'wrong error for %: %', name, sqlerrm; end if; end;
  perform pg_temp.check(name, ok);
end $$;
grant execute on all functions in schema pg_temp to public;

-- A creates data.
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.projects (id, user_id, name) values ('22222222-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','A project');
insert into public.scripts (id, user_id, project_id) values ('33333333-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a');
select pg_temp.check('A sees own project', (select count(*) from public.projects) = 1);

-- B cannot see or change A's data.
reset role; select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.check('B sees no projects of A', (select count(*) from public.projects) = 0);
select pg_temp.denied('B cannot update A project', $$update public.projects set name='hacked' where id='22222222-0000-0000-0000-00000000000a'$$);
select pg_temp.denied('B cannot delete A project', $$delete from public.projects where id='22222222-0000-0000-0000-00000000000a'$$);
select pg_temp.denied('B cannot insert row as A', $$insert into public.projects (user_id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','x')$$);
select pg_temp.denied('B cannot attach script to A project', $$insert into public.scripts (user_id,project_id) values ('bbbbbbbb-0000-0000-0000-000000000002','22222222-0000-0000-0000-00000000000a')$$);
select pg_temp.denied('B cannot attach asset to A project', $$insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes) values ('bbbbbbbb-0000-0000-0000-000000000002','22222222-0000-0000-0000-00000000000a','voiceover','k','audio/mpeg',1)$$);

-- Privilege escalation and server-only tables.
select pg_temp.denied('B cannot make self admin', $$update public.profiles set role='admin' where user_id='bbbbbbbb-0000-0000-0000-000000000002'$$);
select pg_temp.denied('B cannot update A profile', $$update public.profiles set display_name='x' where user_id='aaaaaaaa-0000-0000-0000-000000000001'$$);
select pg_temp.check('B sees only own profile', (select count(*) from public.profiles) = 1);
select pg_temp.denied('user cannot create render job', $$insert into public.render_jobs (user_id,project_id,style_version_id,script_version_id,request) values ('bbbbbbbb-0000-0000-0000-000000000002',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'{}')$$);
select pg_temp.denied('user cannot write usage events', $$insert into public.usage_events (user_id,kind,quantity) values ('bbbbbbbb-0000-0000-0000-000000000002','x',-100)$$);
select pg_temp.denied('user cannot upgrade own plan', $$update public.subscriptions set plan='pro' where user_id='bbbbbbbb-0000-0000-0000-000000000002'$$);
select pg_temp.check('user cannot read audit log', (select count(*) from public.audit_log) = 0);

-- Styles: users see published only; cannot write.
select pg_temp.check('user sees only published styles', (select count(*) from public.styles where status <> 'published') = 0 and (select count(*) from public.styles) >= 1);
select pg_temp.denied('user cannot publish style', $$update public.styles set status='published' where id='11111111-0000-0000-0000-000000000002'$$);
select pg_temp.denied('user cannot create style', $$insert into public.styles (name) values ('evil')$$);

-- Admin: can read all styles; writes need MFA (aal2).
reset role; select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003','aal1');
select pg_temp.check('admin sees unpublished styles', (select count(*) from public.styles where status <> 'published') >= 2);
select pg_temp.denied('admin WITHOUT MFA cannot write styles', $$update public.styles set status='published' where id='11111111-0000-0000-0000-000000000002'$$);
reset role; select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003','aal2');
update public.styles set status='published' where id='11111111-0000-0000-0000-000000000002';
select pg_temp.check('admin WITH MFA can write styles', (select status from public.styles where id='11111111-0000-0000-0000-000000000002') = 'published');
select pg_temp.check('admin cannot read other users projects (not granted)', (select count(*) from public.projects) = 0);

-- Day 5: storage + quota rules.
reset role; select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.denied('user cannot insert asset row directly', $$insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes,status) values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','voiceover','aaaaaaaa-0000-0000-0000-000000000001/forged','audio/mpeg',0,'ready')$$);
select pg_temp.denied('user cannot delete own project directly', $$delete from public.projects where id='22222222-0000-0000-0000-00000000000a'$$);
select pg_temp.denied('user cannot edit plan limits', $$update public.plan_limits set max_storage_bytes = 999999999999$$);
select pg_temp.denied('user cannot read storage objects directly', $$select 1/0 from storage.objects where bucket_id='vistoon-private'$$);
select pg_temp.check('user sees zero storage objects', (select count(*) from storage.objects) = 0);
select pg_temp.denied('user cannot insert storage object directly', $$insert into storage.objects (bucket_id,name) values ('vistoon-private','aaaaaaaa-0000-0000-0000-000000000001/x')$$);
select pg_temp.denied_msg('free plan: 6th project rejected', $$insert into public.projects (user_id,name) select 'aaaaaaaa-0000-0000-0000-000000000001', 'p'||g from generate_series(1,5) g$$, 'project_limit_reached');
insert into public.projects (user_id,name) select 'aaaaaaaa-0000-0000-0000-000000000001','q'||g from generate_series(1,4) g;
update public.projects set archived_at = now() where id='22222222-0000-0000-0000-00000000000a';
insert into public.projects (user_id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','replacement');
select pg_temp.denied_msg('un-archiving past the plan limit rejected', $$update public.projects set archived_at = null where id='22222222-0000-0000-0000-00000000000a'$$, 'project_limit_reached');
reset role;
-- Server-side (service role / superuser) writes: triggers must still fire.
select pg_temp.check('bucket is private with size limit', (select not public and file_size_limit = 52428800 from storage.buckets where id='vistoon-private'));
select pg_temp.denied_msg('key must start with owner folder', $$insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes) values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','voiceover','bbbbbbbb-0000-0000-0000-000000000002/steal','audio/mpeg',1)$$, 'assets_key_owner_prefix');
select pg_temp.denied_msg('over-quota asset rejected', $$insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes) values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','voiceover','aaaaaaaa-0000-0000-0000-000000000001/big','audio/mpeg',1073741825)$$, 'storage_quota_exceeded');
insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes,status) values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','voiceover','aaaaaaaa-0000-0000-0000-000000000001/ok1','audio/mpeg',1000,'ready');
select pg_temp.check('valid asset accepted', (select count(*) from public.assets) = 1);
select pg_temp.denied_msg('duplicate storage key rejected', $$insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes) values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','voiceover','aaaaaaaa-0000-0000-0000-000000000001/ok1','audio/mpeg',1)$$, 'assets_storage_key_unique');
insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes) select 'aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','voiceover','aaaaaaaa-0000-0000-0000-000000000001/p'||g,'audio/mpeg',1 from generate_series(1,10) g;
select pg_temp.denied_msg('11th pending upload rejected', $$insert into public.assets (user_id,project_id,kind,storage_key,mime,bytes) values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','voiceover','aaaaaaaa-0000-0000-0000-000000000001/p11','audio/mpeg',1)$$, 'too_many_pending_uploads');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.check('B cannot see A assets', (select count(*) from public.assets) = 0);
reset role;

-- Day 6: stuck-job reaper and worker tables.
reset role;
insert into public.styles (id, name, status) values ('44444444-0000-0000-0000-000000000001','S','published') on conflict do nothing;
insert into public.style_versions (id, style_id, version, adapter, package_sha256) values ('55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','1','remotion','x');
insert into public.script_versions (id, user_id, script_id, body) values ('66666666-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','33333333-0000-0000-0000-00000000000a','b');
insert into public.render_jobs (id, user_id, project_id, style_version_id, script_version_id, request, state, attempt, heartbeat_at, progress) values
 ('77777777-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','55555555-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','{}','rendering',0, now() - interval '10 minutes', 40),
 ('77777777-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','55555555-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','{}','mixing',2, now() - interval '10 minutes', 80),
 ('77777777-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','55555555-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','{}','rendering',0, now(), 50),
 ('77777777-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','55555555-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','{}','awaiting_review',0, now() - interval '3 days', 40),
 ('77777777-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000a','55555555-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','{}','completed',0, now() - interval '3 days', 100);
update public.render_jobs set created_at = now() - interval '2 hours' where id = '77777777-0000-0000-0000-000000000002';
select pg_temp.check('stale_queued_jobs reports nothing for non-queued', (select count(*) from public.stale_queued_jobs(interval '1 hour')) = 0);
set role service_role;
select pg_temp.check('reaper touches exactly the 2 stuck jobs', (select count(*) from public.reap_stuck_jobs(interval '5 minutes', 3)) = 2);
reset role;
select pg_temp.check('stuck job under cap is re-queued with attempt+1 and reset progress', (select state = 'queued' and attempt = 1 and progress = 0 and heartbeat_at is null from public.render_jobs where id='77777777-0000-0000-0000-000000000001'));
select pg_temp.check('stuck job at attempt cap fails for good', (select state = 'failed' and finished_at is not null and error like '%exhausted%' from public.render_jobs where id='77777777-0000-0000-0000-000000000002'));
select pg_temp.check('healthy job untouched', (select state = 'rendering' and attempt = 0 from public.render_jobs where id='77777777-0000-0000-0000-000000000003'));
select pg_temp.check('awaiting_review (waits for a human) untouched', (select state = 'awaiting_review' and attempt = 0 from public.render_jobs where id='77777777-0000-0000-0000-000000000004'));
select pg_temp.check('completed job untouched', (select state = 'completed' from public.render_jobs where id='77777777-0000-0000-0000-000000000005'));
select pg_temp.check('reaper wrote audit events', (select count(*) from public.job_events where message like 'reaper:%') = 2);
select pg_temp.check('second reaper run finds nothing new', (select count(*) from public.reap_stuck_jobs(interval '5 minutes', 3)) = 0);
update public.render_jobs set state = 'queued', created_at = now() - interval '2 hours' where id = '77777777-0000-0000-0000-000000000001';
select pg_temp.check('stale_queued_jobs finds a long-queued job', (select count(*) from public.stale_queued_jobs(interval '1 hour')) = 1);
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.denied('user cannot call reap_stuck_jobs', $$select * from public.reap_stuck_jobs(interval '0', 3)$$);
select pg_temp.denied('user cannot call stale_queued_jobs', $$select * from public.stale_queued_jobs(interval '0')$$);
select pg_temp.denied('user cannot read worker_status', $$select 1/0 from public.worker_status$$);
select pg_temp.denied('user cannot write worker_status', $$insert into public.worker_status (worker_id) values ('evil')$$);
reset role; set role anon;
select pg_temp.denied('anon cannot call reap_stuck_jobs', $$select * from public.reap_stuck_jobs(interval '0', 3)$$);
reset role;

-- anon: nothing.
reset role; set role anon;
select pg_temp.denied('anon cannot read projects', $$select 1/0 from public.projects$$);
select pg_temp.denied('anon cannot read profiles', $$select 1/0 from public.profiles$$);
reset role;
select count(*) || ' checks passed' as summary from results where ok;
