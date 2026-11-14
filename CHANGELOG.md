# Changelog

## Day 5 (2026-11-13): projects, private storage, uploads, quotas
- Migrations 0004 (private bucket, server-only asset writes, plan limits + quota triggers) and 0005 (un-archive respects limit).
- Project CRUD, asset upload (signed URL, server verification, checksum), download, archive, delete APIs.
- Projects list, project workspace with gallery, dashboard with real usage.

## Day 4 (2026-11-12): database, auth, authorization
- Schema + RLS (0001-0003), Supabase Auth wiring, route protection, admin role + MFA guards, audited admin API.

## Day 3: renderer inventory, gap report, adapter contract, ADRs.
## Day 1-2: design system and screens.

## Day 6 — Queue, worker, observability
- BullMQ job contracts (strict zod payloads, bounded timeouts/attempts, idempotent job ids), producer with cancel + stats.
- Worker service: DI database, health endpoints, DLQ + audit on final failure, stalled-job recovery, heartbeats, recurring reaper/cleanup schedules, pino redaction.
- Migration 0006: `worker_status`, `reap_stuck_jobs`, `stale_queued_jobs` (service role only).
- `GET /api/admin/queue` (admin + MFA); `worker/Dockerfile`, `docker-compose.yml` (UNVERIFIED: no Docker daemon).

## Day 7 — Admin controls
- Migration 0007: `kill_switches` (uploads, rendering, script_generation), `feature_flags`, `admin_set_role/_switch/_flag` (service role only, audited atomically), append-only `audit_log` (update/delete/truncate blocked for everyone).
- DB-enforced kill switches on `assets` and `render_jobs` inserts.
- APIs `/api/admin/{users,controls,audit}`; pages `/admin/users`, `/admin/controls`, `/admin/audit`.

## Day 8 — LLM adapter and script generation
- Provider-agnostic `LlmProvider` + Anthropic adapter (fetch, timeout, error mapping, Retry-After), bounded retries with backoff.
- Versioned prompt template `script.v1`; brief fenced as data; strict brief schema.
- Server-side word counter policy `words-v1`.
- Migration 0008: `plan_limits.generations_per_day` + `reserve_script_generation` (atomic daily cap, kill switch aware).
- `POST/GET /api/projects/[id]/scripts`; Script Studio wired to real projects and versions.

## Day 9 — Exact length and editor
- Counting policies `words-v1` and `chars-v1` (grapheme-based, NFC, documented); `checkLength`.
- `fitToLength`: max 3 correction rounds, every round re-measured by our counter, best candidate returned, never claims exactness without proof.
- Migration 0009: version kinds, single autosave slot per script, 60k body cap, 200 versions per script.
- APIs: `PUT .../scripts/draft` (autosave), `POST .../scripts/versions` (save version), `POST .../scripts/fit`; generation now honours exact targets.
- Script Studio editor: live counts, exact/over/under, autosave, save version, adjust-to-length, history.

## Day 10 — Quality scoring and revision
- Rubric `quality.v1`: 9 weighted dimensions (total 100), pass target 85. Total computed in code; evidence quotes verified as literal substrings; factual-caution flags; code-measured metrics; no-virality disclaimer.
- Revision: one round per request on a saved version; limit of 3 enforced by API and by a DB check + trigger (migration 0010). Re-fits exact length, re-scores the new text.
- Section rewrite: only the selected range can change (code splices the model's replacement).
- Export txt/md/json with sanitized filenames, `nosniff`, attachment disposition.
- APIs: `/scripts/{score,revise,rewrite,export}`; Script Studio score card, Improve, Rewrite selection, export links.

## Day 11 — DNA Analyzer: intake and analysis
- Migration 0011: transcript metadata and limits (30 per collection, 20 collections), duplicate detection, cached `dna_observations`, `dna_analyses` (one active run per collection, server-written), findings with explanation/counterexamples/status.
- Transcript cleaner (.txt/.srt/.vtt/paste), language guess, fixed 12-technique taxonomy.
- Observations: the model quotes the transcript; quotes are verified as literal substrings or dropped.
- Findings and the five labels are assigned by code from counts (not by the model); fewer than 3 transcripts is always UNVERIFIED_HYPOTHESIS; high-performer association needs user-marked transcripts and is worded as association.
- Background `analyzeDna` worker job: idempotent claim, per-transcript cache so adding a transcript costs one AI call, user-edited findings preserved.
- APIs under `/api/dna/*`; DNA Analyzer page (collections, paste/upload, exclude, high-performer mark, analyze with polling, evidence ledger).
