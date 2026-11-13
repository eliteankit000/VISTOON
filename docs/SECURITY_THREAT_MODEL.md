# Threat model (working draft)

| Threat | Control | Status |
|---|---|---|
| Cross-tenant read/write (IDOR/BOLA) | RLS on all tables, owner-scoped queries, 404 for foreign ids | VERIFIED on real DB (40 checks) |
| Privilege escalation to admin | Role column not user-writable; admin needs role + MFA (aal2) in DB and API | VERIFIED (DB); UI flow not exercised |
| Forged asset rows / quota bypass | Users cannot write assets; owner-prefix CHECK; quota triggers with advisory locks | VERIFIED on real DB |
| Malicious upload (renamed exe, HTML, SVG) | Type allow-list, size caps, server-side signature sniffing, no SVG/HTML | Rules VERIFIED (unit); live upload TESTING |
| Path traversal via filename | Keys are server-generated UUIDs; names are display-only and sanitised | VERIFIED (unit) |
| CSRF on cookie-auth mutations | Origin must match host; SameSite cookies | Unit VERIFIED; live TESTING |
| Open redirect after login | `safeRedirect` allows only same-site paths | VERIFIED (unit) |
| Account enumeration | Generic login/signup/reset responses | IMPLEMENTED |
| Service key leak | `server-only` import guard; not in client bundle | VERIFIED (bundle scan, Day 4) |
| Private data via storage API | Bucket private, no storage policies for clients | VERIFIED on real DB |
| Brute force / abuse | Supabase Auth limits only. **App rate limiting not yet built** | NOT_STARTED (Day 27-28) |
| Malware in uploads | No scanner yet | NOT_STARTED |
| Rendering-worker abuse | Own compositions only, isolated worker | NOT_STARTED (Day 21-25) |

## Day 6 additions
- Redis payload tampering: worker re-validates every payload and fails unknown/invalid jobs without retry (tested).
- Lost/hung workers: lock renewal + stalled recovery, per-job timeouts, DB reaper (tested).
- Secrets in logs: pino redaction (tested). Redis exposure: compose has no published port + requirepass (unverified).

## Day 7 additions
- Privilege escalation: roles change only via service-role RPC that re-checks the actor is admin; self-change blocked; audited.
- Incident response: kill switches act in the DB, so they stop uploads/renders regardless of code path.
- Audit tampering: append-only triggers (a superuser/DB owner could still drop them; mitigated by external log shipping later).

## Day 8 additions
- Cost abuse: quota reserved in the DB before the LLM call (atomic per user), released on provider failure; kill switch stops it instantly.
- Prompt injection: brief is fenced as data with tag characters stripped; output is plain text rendered as text and never executed. Residual risk: model can still be steered inside the script text (low impact).
- Key exposure: key read server-side only; tests confirm it is absent from request bodies and error messages.

## Day 9 additions
- Storage/DoS via versions: DB caps (60k chars, 200 versions); autosave overwrites a single row.
- Cost: correction rounds can make up to 4 model calls per reserved quota slot (bounded, documented).
- Tampered counts: counts are recomputed server-side on every save; client numbers are never stored.
