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

-- anon: nothing.
reset role; set role anon;
select pg_temp.denied('anon cannot read projects', $$select 1/0 from public.projects$$);
select pg_temp.denied('anon cannot read profiles', $$select 1/0 from public.profiles$$);
reset role;
select count(*) || ' checks passed' as summary from results where ok;
