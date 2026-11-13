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
