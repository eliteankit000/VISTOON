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
