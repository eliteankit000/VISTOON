# Implementation status

| Area | Day | Status | Evidence / note |
|---|---|---|---|
| Design system + screens | 1-2 | IMPLEMENTED | builds; most screens still mock |
| Renderer inventory + adapter contract | 3 | VERIFIED (read-only) | docs/01-03; nothing executed |
| Schema + RLS | 4 | VERIFIED | 40 live checks |
| Auth (signup/login/reset) | 4 | TESTING | code + route protection verified; email flows not exercised |
| Admin MFA | 4 | TESTING | DB enforcement verified; enrol UI not exercised |
| Project CRUD API + UI | 5 | TESTING | build OK, signed-out 401 verified; signed-in flow not exercised |
| Private storage + signed uploads | 5 | TESTING | DB/bucket rules verified live; upload round-trip not exercised |
| Upload validation (type/size/signature) | 5 | VERIFIED | unit tests |
| Asset gallery / archive / delete | 5 | TESTING | not exercised signed-in |
| Quota foundation | 5 | VERIFIED | live triggers (storage, projects, pending, un-archive) |
| Rate limiting | 5 | NOT_STARTED | planned Day 27-28 |
| Stale pending-upload cleanup | 5 | NOT_STARTED | belongs to Day 6 worker (BullMQ job) |
| Malware scan, media duration limits | 5 | NOT_STARTED | needs worker + ffprobe |
| Queue + worker skeleton | 6 | NOT_STARTED | next |

## Day 6 — Queue and worker
| Item | Status | Evidence |
|---|---|---|
| Job contracts, producer, states | VERIFIED | tests/queue.test.ts on real Redis |
| Worker (retry, timeout, cancel, DLQ, audit, stalled recovery via SIGKILL, schedules, heartbeat, health) | VERIFIED | 21 queue tests pass |
| Stuck-job reaper SQL (0006) | VERIFIED | 12 live checks + 53 local RLS checks |
| Admin queue API | IMPLEMENTED | typechecks/builds; not exercised signed in |
| Dockerfile / compose | IMPLEMENTED (unverified) | no Docker daemon here |
| Error tracking (Sentry) | NOT_STARTED | `reportError` hook only |

## Day 7 — Admin controls
| Item | Status | Evidence |
|---|---|---|
| Role management (no self-change, actor re-checked, audited) | VERIFIED (DB) | 22 new local checks (75 total) + 8 live checks, rolled back |
| Kill switches enforced in DB (uploads, rendering) | VERIFIED (DB) | local + live checks |
| Append-only audit log | VERIFIED (DB) | update/delete/truncate rejected, local + live |
| Feature flags | IMPLEMENTED | DB verified; flags are not yet read by feature pages |
| `script_generation` switch | IMPLEMENTED | stored; enforced when Script Studio (Day 8+) exists |
| Admin APIs and pages | IMPLEMENTED | build ok; signed-out probes 401/307; not exercised signed in with MFA |
| Reauthentication for sensitive actions | NOT_STARTED | |

## Day 8 — LLM adapter and script generation
| Item | Status | Evidence |
|---|---|---|
| Provider interface, Anthropic adapter, retry | VERIFIED (against fake fetch) | 31 unit tests in tests/llm.test.ts |
| Prompt template + injection fencing | VERIFIED (unit) | tests; not evaluated against a live model |
| Generation quota (atomic, 24h) + kill switch | VERIFIED (DB) | 6 new local checks (81 total), live checks (rolled back) |
| Generate/list API | IMPLEMENTED | typechecks, builds; signed-out 401; never run with a real key or signed in |
| Script Studio UI | IMPLEMENTED | not exercised in a browser |
| Real Anthropic call | NOT_STARTED | needs ANTHROPIC_API_KEY |
