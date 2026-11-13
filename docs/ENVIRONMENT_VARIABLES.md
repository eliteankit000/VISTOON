# Environment variables (names only; never commit values)

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Publishable key. Safe in the browser; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Used for jobs, usage, audit, storage signing. Required for uploads. Never `NEXT_PUBLIC_`, never logged |
| `REDIS_URL` | server + worker | BullMQ connection. Use `rediss://` with a password in production; Redis must be private, never publicly reachable |
| `REDIS_PASSWORD` | compose only | Used by docker-compose for Redis `requirepass` |
| `WORKER_PORT` / `WORKER_HOST` | worker | Health server (`/healthz`, `/readyz`); default 8080 on 127.0.0.1 |
| `WORKER_ID` | worker | Identifier shown in `worker_status` heartbeats |
| `LOG_LEVEL` | server + worker | pino level; secrets are redacted |
