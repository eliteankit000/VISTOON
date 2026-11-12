# Test report (2026-11-13)

| Suite | Command | Result |
|---|---|---|
| Unit tests | `npm test` | 50 passed (auth rules, style lifecycle, upload rules, signatures, CSRF) |
| Type-check | `npm run typecheck` | clean |
| Production build | `npm run build` | passes |
| DB security, local PostgreSQL 16 | `npm run test:rls` | 38 checks passed (sabotage-tested) |
| DB security, **real Supabase project** | `supabase/tests/live_rls_test.sql` | 40 checks passed after 0004; un-archive limit check (0005) passed separately; all rolled back, 0 leftover rows |
| Supabase security advisor | `get_advisors` | only "leaked password protection" (needs paid plan) |
| Live HTTP probe, signed-out | curl on production build | all 9 API routes 401; pages 307 to login |

**Not run (and why):** signed-in API/UI flows, real uploads, email, MFA. The sandbox cannot reach `*.supabase.co`. These stay at TESTING/IMPLEMENTED until exercised on a machine with network access.
