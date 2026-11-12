# Day 3 — Gap and risk report

Severity: **H** blocks launch, **M** needs a decision or work before beta, **L** note.

| ID | Sev | Gap / risk | Evidence | Action |
|---|---|---|---|---|
| G1 | H | **Remotion commercial license.** Remotion's license is not MIT; for-profit companies above a small size need a paid company license. A SaaS that renders for customers must be checked | `@remotion/*` 4.0.530 in what-if `package.json` | Read the license in `node_modules/remotion/LICENSE.md` after install and on remotion.dev; decide before any paid launch. Fallback: cartoon-video-studio (three.js + Playwright, MIT parts) |
| G2 | H | **Rendering runs generated code.** Episodes are TSX/JS written by an LLM; styles may be imported packages. That is arbitrary code in Node/Chromium | what-if `src/episodes/*`, cartoon `story.js`/`world.js` | Render only in a sandboxed worker: no secrets, no outbound network, CPU/RAM/time limits, read-only code, per-job scratch dir (see ADR-4) |
| G3 | H | No single kit matches the plan's "studio-kit.zip" | Section above | Confirm with the owner whether another archive exists, or accept what-if as the base (ADR-1) |
| G4 | M | `anim.py` runs `npx --yes hyperframes` at runtime: unpinned remote package execution | Animation_skills `kit/anim.py` | Do not use that path in the worker. Pin or vendor if ever needed |
| G5 | M | Setup downloads model files with `curl` from GitHub releases | `kit/setup.sh` lines 39–42 | Pre-bake into the worker image with checksums; never download at job time |
| G6 | M | No Python requirements file; FFmpeg/Node versions unstated | whole kit set | Pin in a Dockerfile; record versions in the job output metadata |
| G7 | M | Paid external API: ElevenLabs (key via env). Cost per episode, key is a secret | `wi.py` `KEY_NAMES`, `tts_elevenlabs.py` | Server-side secret only; per-user quota and cost cap; never expose to the browser |
| G8 | M | ricksclips depends on Higgsfield-generated assets and has no license file | its SKILL.md | Exclude from MVP unless rights and asset source are confirmed |
| G9 | M | Font and SFX provenance unknown (7 fonts, 40 sfx mp3 in `library/sfx`) | woff2 / mp3 files | Confirm font licenses (Inter, Poppins, JetBrains Mono are normally OFL) and SFX rights before shipping |
| G10 | M | Plan says "no AI video models": ElevenLabs sound/voice is AI audio, not video. Needs to be stated in product copy | plan vs kit | Decide wording; keep the rule scoped to video generation |
| G11 | L | Chromium is not bundled; each tool downloads its own | package.json files | Install once in the image (`playwright install chromium`, Remotion browser) |
| G12 | L | Sample render was not run here | — | First task of the worker work (Day 6/10): render `rewind` in a clean container and record time, RAM and output hash |

## Acceptance check for Day 3
- "No unverified assumptions": met for what is written above; items not run are marked as such (G12).
- "Sample render path understood": yes, for what-if and cartoon. Not executed.
