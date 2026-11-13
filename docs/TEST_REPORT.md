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

## Day 6 (2026-11-13)
- `npm test`: 71/71 pass (50 prior + 21 queue incl. real Redis, SIGKILL stalled-job recovery, DLQ, timeout, cancel, redaction).
- `npm run test:rls`: 53 checks pass. `npm run build`, `tsc --noEmit`: clean.
- Supabase advisors: only worker_status "RLS no policy" (intentional) and leaked-password protection (needs paid plan).
- Not tested: Docker build, worker against live Supabase, admin queue API signed in.

## Day 7 (2026-11-13)
- `npm run test:rls`: 75 checks pass. Live (rolled back): 8 checks pass. `npm test` 71 pass, build clean.
- Signed-out probes: new admin APIs 401, pages 307. Cross-origin PATCH is rejected (401 from auth before the 403 CSRF check).
- Not tested: admin pages signed in with an MFA session.

## Day 8 (2026-11-13)
- `npm test`: 102 pass (31 new LLM/count/prompt tests). `npm run test:rls`: 81 checks. Live quota checks (rolled back): 4 pass.
- Not tested: real provider call, signed-in generate/save, UI in a browser.

## Day 9 (2026-11-13)
- Unit tests and RLS checks (91) pass; live script_versions constraint checks (rolled back) pass.
- Not tested: real model obeying length corrections, UI in a browser, signed-in API calls.

## Day 10 (2026-11-13)
- Unit + RLS: all pass (see totals below in final run); live revision constraint checks (rolled back) pass.
- Not tested: real model scoring quality/consistency, UI in a browser, signed-in API calls, file download in a browser.
