# VISTOON — Phase 1 (Days 1–2): design system + all screens

Status: **UI mostly mock data; auth, roles and database policies are real (Day 4).** Every screen shows a "Preview only" banner. No auth, database, storage,
queue, LLM or renderer exists yet, and nothing here is production-ready.

## Setup
    cp .env.example .env.local   # fill in Supabase values (see docs/06 checklist)
    npm run test         # unit tests
    npm run test:rls     # database security tests (needs local PostgreSQL 16)

## Try the real login flow on your machine
    # .env.local already points at the vistoon Supabase project (publishable key only).
    # 1) Supabase dashboard > Authentication: turn on TOTP MFA, set Site URL http://localhost:3000 and redirect http://localhost:3000/auth/callback
    # 2) Add SUPABASE_SERVICE_ROLE_KEY to .env.local (dashboard > Project Settings > API)
    # 3) npm run dev, sign up, confirm the email, sign in
    # 4) Make yourself admin in the SQL editor: update public.profiles set role='admin' where user_id='<your uuid>';
    # 5) Open /security, enrol TOTP, verify, then open /admin

## Run
    npm install
    npm run dev        # http://localhost:3000
    npm run typecheck && npm run build

## What exists
- Light-only VISTOON tokens (tailwind.config.ts), Inter + mono, 4px-grid spacing
- Component library: src/components/ui/index.tsx
- Collapsible, responsive app shell: src/components/shell/AppShell.tsx
- Screens: landing, dashboard, projects (+detail), Script Studio, DNA Analyzer, Reference Studio,
  Video Studio, Animation Library, Render Queue, Settings, Admin, Admin Style Editor
- Mock data isolated in src/lib/mock.ts
- Baseline security headers in next.config.mjs (CSP to be added with nonces later)

## Known gaps (by design, per plan)
- Admin link is visible in the shell for layout preview only; real admin gating is server-side (Day 4/7).
- The script word counter is a naive preview; the deterministic server counter is Day 9.
- Fonts load from Google Fonts; self-host before launch for CSP/privacy.

## Done: Day 3 (docs/01-05), Day 4 (supabase/ + auth, docs/06)

## Next: Day 5
Project workspace APIs and private storage with signed uploads.
