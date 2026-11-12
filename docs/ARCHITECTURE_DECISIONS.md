# Architecture decisions (ACCEPTED 2026-11-12)

| # | Decision | Why | Revisit if |
|---|---|---|---|
| ADR-1 | MVP renderer = **what-if-animation** (Remotion) behind the adapter in 03 | Pinned versions, lockfile, deterministic frames, example episodes, mastering script | G1 (Remotion license) is unacceptable → switch adapter to cartoon-video-studio |
| ADR-2 | Second adapter = cartoon-video-studio (three.js + Playwright) | Has tests and a PASS/FAIL QA report; vendored three.js | — |
| ADR-3 | Frontend + API: Next.js (done). DB/Auth/Storage: Supabase (Postgres + RLS + private buckets) | Matches plan Day 4–5 | You prefer another host |
| ADR-4 | Render worker is a **separate container**, not in the web app: non-root, no secrets, egress only to signed storage URLs, CPU/RAM/time caps, wiped scratch dir | Generated episode code is arbitrary code (G2) | — |
| ADR-5 | Queue: **Inngest or BullMQ+Redis** (plan Day 6). Recommendation: BullMQ+Redis on the worker host | Long (minutes) CPU jobs need a persistent worker, not serverless limits | You want zero-ops → Inngest |
| ADR-6 | Styles are immutable **versions**; only `verified` after a passing isolated test render; only `published` ones are user-visible | Matches the Admin style lifecycle | — |
| ADR-7 | ElevenLabs key stays server-side; per-user quota and cost cap | G7 | — |

## Accepted decisions (owner, 2026-11-12)
1. Studio kit: build on **what-if-animation**. Other audited kits stay quarantined until reviewed.
2. Remotion: **Free License**, with a mandatory compliance check before launch.
3. Database and login: **Supabase PostgreSQL + Auth**, RLS on every table.
4. Queue: **BullMQ + Redis**. PostgreSQL holds the durable records.
5. LLM: Anthropic API for scripts, narration and structured scene JSON. Not for video generation.
6. Rendering: isolated cloud workers only. No local rendering, no desktop agent.

## Remotion license conditions (read from remotion.dev/docs/terms on 2026-11-12)
- Free License covers "an organization or team of individuals with up to 3 people". A Company License is
  required when the combined headcount of all involved parties is **4 or more** (counts all personnel, not only
  Remotion users; clients who only receive finished video are not counted).
- Automations (calling Remotion render APIs programmatically, embedding the Player) are allowed for Free License users.
  The paid "Automators" option is $0.01 per render, $100/month minimum, once you are not Free-eligible.
- "It is not acceptable for services to allow end-users to bring/upload their own Remotion code." VISTOON must render
  only its own compositions. Users supply script/scene JSON, never code. (This also removes the main sandbox risk, G2.)
- **Compliance check before launch (owner: you):** re-read the terms, record the installed versions
  (`remotion` 4.0.530), check dependency licenses and FFmpeg/codec obligations, and confirm headcount.
