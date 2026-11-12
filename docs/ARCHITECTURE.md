# Architecture (current, Day 5)

Browser (Next.js 15, React 19) -> Next.js route handlers (server) -> Supabase (Postgres + RLS, Auth, private Storage).

- **Two Supabase clients.** User client (cookie session, RLS applies) for reads and owner-scoped writes. Service client (server-only file) for privileged work after the caller is authenticated and ownership is checked.
- **Uploads:** `POST /api/projects/:id/assets` validates type/size/rights, reserves a pending row (DB trigger enforces quota), returns a signed upload token. The browser uploads straight to the private bucket. `POST /api/assets/:id/complete` streams the object, checks size, real file signature and SHA-256, then marks it ready, or deletes it.
- **Downloads:** 60-second signed URLs issued only to the owner of a ready file.
- **No direct client access** to storage objects or asset rows: writes are server-only.
- **Rendering (planned Day 21-25):** BullMQ + Redis queue, isolated worker container, Remotion renderer behind the adapter in `docs/03-renderer-adapter-contract.md`.
