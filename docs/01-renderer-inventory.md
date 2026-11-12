# Day 3 — Renderer inventory (verified by reading the uploaded files)

Scope: what is actually in the four uploads. **Nothing was executed**; no render was run. Each kit
was unzipped into its own folder and read only. "Verified" below means "seen in the files".

## Important mismatch with the plan
The plan expects one `studio-kit.zip` containing Remotion, Chromium, PocketSphinx, Python/NumPy, Pillow,
FFmpeg, ebur128, blackdetect, fonts, templates and bootstrap scripts. **No such single kit was uploaded.**
Four separate kits were uploaded instead. PocketSphinx is not referenced anywhere in them.

## The four kits

| Kit | Files | Render engine (pinned) | Role for VISTOON |
|---|---|---|---|
| `what-if-animation.skill` | 101 | Remotion 4.0.530, React 19.0.0, TypeScript 5.8.2 (`package-lock.json` present) | **Best MVP candidate.** Deterministic frame renderer, two example episodes, SFX library, mastering script |
| `cartoon-video-studio.skill` | 84 | three.js r160 vendored, Playwright (Chromium) | Strong second candidate: has tests and a PASS/WARN/FAIL QA report. Voiceover in, MP4 out |
| `ricksclips-short-style.skill` | 37 | three 0.187.0 + Playwright 1.65.0 | Needs externally generated characters/textures (Higgsfield). Not self-contained |
| `Animation_skills-1.0.0-v1.zip` | 69 | three 0.169.0 + Playwright 1.49.1; also shells out to `npx --yes hyperframes` | A collection of skills (stick-figure, graph, map-route, breakdown, …), not one renderer |

## Tool-by-tool (plan Day 3 checklist)

| Item | Finding |
|---|---|
| Remotion | Only in what-if-animation, pinned `4.0.530` for all `@remotion/*` packages. Entry `src/index.ts`; `Root.tsx` registers one composition per episode, plus `<id>Board` (storyboard) and `Cast` |
| Chromium | Not bundled by any kit. Playwright (1.49.1 / 1.65.0) and Remotion each download their own. This sandbox has Chrome for Testing 153, no `chromium` binary |
| PocketSphinx | **Absent.** Word timing is done by kit code (`words.py`, `wi.py`, `shortkit.py`) and, in Animation_skills, Parakeet/Kokoro models downloaded from GitHub by `kit/setup.sh` |
| Python / NumPy / Pillow | Required by cartoon-video-studio (`--check-deps`) and the scripts. Sandbox has Python 3.13, NumPy 2.5.3, Pillow 12.3.0. No `requirements.txt` in any kit, so versions are unpinned |
| FFmpeg / ffprobe | Called via subprocess by all kits. Sandbox has 6.1.1. Required version not stated by the kits |
| ebur128 | Used in `wi.py` (`ebur128=peak=true`) and cartoon `quality-check.py` |
| Loudness mastering | `what-if-animation/scripts/master.py` uses `loudnorm` to the **-14 LUFS** target, TP -1.5 |
| blackdetect | Referenced only in cartoon-video-studio `quality-check.py` |
| Fonts | 7 woff2 files (Inter, Inter Tight, JetBrains Mono, Poppins). Licenses not included in the kits |
| Templates | cartoon-video-studio `templates/` (story, world, cast, config). what-if `studio/src/episodes/` (`rewind`, `copy-paste`) |
| Bootstrap scripts | `cartoon-video-studio/tools/setup.sh`, `Animation_skills/kit/setup.sh`, `install.sh`. what-if has none: copy `studio/`, run `npm install` |
| Sample render path | what-if: `remotion render` on an episode id, then `scripts/master.py`. cartoon: `tools/autopilot.sh --audio --script` then `finish.sh`. **Understood from the code, not executed** |

## Licenses (seen)
- what-if-animation: MIT (FreshStack). Animation_skills: MIT (Artem Novitckii).
- cartoon-video-studio: includes three.js (MIT) and mromidev claude-animated-shorts (MIT).
- ricksclips: no LICENSE file found.
- Remotion itself is **not** plain MIT. See gap G1.
