# Day 4 — Database, auth, authorization

## What exists
- `supabase/migrations/0001_init.sql` schema, `0002_rls.sql` row-level security, `seed.sql` (dev only)
- `supabase/tests/run.sh`: spins up a throwaway PostgreSQL 16, applies the migrations, runs 23 security checks
  (cross-user read/write/delete, attaching to another user's project, role escalation, plan tampering,
  server-only tables, published-only styles, admin writes need MFA, anon sees nothing).
  Sabotage-tested: weakening two policies made the suite fail as it should.
- Next.js: middleware blocks signed-out access (pages redirect, APIs get 401), server guards
  (`requireUser`, `requireAdminPage`, `requireAdminApi`), login/signup/reset with generic messages
  (no account enumeration), open-redirect protection, admin MFA page, audited admin API.

## Access model
| Who | Can |
|---|---|
| Signed out | Landing, login, signup, reset only |
| User | CRUD own projects/assets/scripts/DNA. Read-only own jobs, outputs, usage, plan. See published styles only |
| Admin (role) | Also read all styles/profiles/audit log |
| Admin + MFA session (aal2) | Also write styles (enforced in the database AND the API) |
| Server (service role) | Create/update jobs, usage, audit entries after its own checks. Key never reaches the browser |

## Supabase project checklist (do in the dashboard; cannot be done from code)
- [ ] Run the two migrations (SQL editor or `supabase db push`), then `seed.sql` in dev only
- [ ] Auth: require email confirmation; minimum password length 12; enable leaked-password protection if your plan has it
- [ ] Auth: enable TOTP MFA; set Site URL and add the redirect URL `<your-domain>/auth/callback`
- [ ] Put `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` / host secrets
- [ ] Make the first admin by hand: `update public.profiles set role='admin' where user_id='<uuid>';` (no UI can do this, by design)
- [ ] Confirm in the Table Editor that every table shows RLS enabled

## Not verified (honest list)
- Not run against a real Supabase project (none available here). RLS was tested on plain PostgreSQL 16 with a shim that
  mimics `auth.uid()`/`auth.jwt()`. Re-run the same SQL tests on your project before trusting it.
- Login, signup emails, password reset and the MFA enrol/verify screens have **not** been exercised end to end.
- Signed-in page behaviour and the admin API were verified only by type-check and unit tests, not live.
- No rate limiting on login yet (Supabase has its own limits; app-level limits are Day 28 hardening).

## UPDATE 2026-11-12: verified on a real Supabase project
- Project `vistoon` (ref `vfrrratpnpohkdmegyue`, region ap-south-1, free plan) created; migrations 0001–0003 applied.
- `supabase/tests/live_rls_test.sql`: **26/26 checks passed on the real database** (real `auth.users`, real `auth.uid()`/`auth.jwt()`),
  rolled back afterwards (verified 0 leftover rows).
- Supabase security advisor found 2 real issues that the local tests could not see (trigger function and RLS helpers
  callable through the public REST API). Fixed in `0003_private_helpers.sql`. Advisor now reports **0 findings**.
- Still NOT verified: anything that needs Supabase Auth over HTTP (signup email, login, password reset, TOTP enrol/verify,
  the real aal2 token). This sandbox's network blocks `*.supabase.co`. Test these from your machine (steps in README).
- Dashboard settings no tool here can change (do by hand): require email confirmation, minimum password length 12,
  enable TOTP MFA, Site URL + redirect URL `<domain>/auth/callback`.

## UPDATE 2026-11-13: Day 5 database
- Migrations 0004 and 0005 applied to the real project. `live_rls_test.sql` is the full suite (40 checks passed on 0004).
- Note: the Supabase tool asked for confirmation on 0004 (it drops a policy and revokes grants) and timed out once; the retry was approved.
