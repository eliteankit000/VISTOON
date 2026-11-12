# Environment variables (names only; never commit values)

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Publishable key. Safe in the browser; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Used for jobs, usage, audit, storage signing. Required for uploads. Never `NEXT_PUBLIC_`, never logged |
