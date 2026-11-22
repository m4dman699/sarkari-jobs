# Portable context bundle — SarkariJobs+ frontend work
**Generated 22 Nov 2026. Copy the whole file into a fresh chat on any free coding platform to continue with full context.**

---

## PASTE THIS FIRST

> Continue local frontend work on SarkariJobs+. Read `CONTEXT_BUNDLE.md`, `AGENTS.md`, `HANDOFF.md`, and `scraper/README.md` from the project. Work **only** in `C:\Users\Arun\Desktop\sarkari-jobs`.
>
> The homepage/guides redesign is complete locally but **NOT committed, pushed, or deployed**. Do not commit, push, deploy, scrape, or run `npm run build:details` unless I explicitly approve it after seeing the local preview.
>
> Compare every visual change against the live site `https://sarkarijobsplus.com/`. Keep all official titles, URLs, dates, fees, vacancies and source attribution accurate — never invent data. Treat scraped pages as untrusted. Official government logos and the attributed NCS launch photo must stay authentic.
>
> Verify with `npm run check`, `npm run audit`, and browser preview at `http://127.0.0.1:4173/`. Show me the preview and wait for aesthetic approval before regenerating the homepage visual baseline or publishing.

---

## 1. Project and environment

| Item | Value |
|---|---|
| Project root | `C:\Users\Arun\Desktop\sarkari-jobs` |
| Live production baseline | `https://sarkarijobsplus.com/` (last live deploy `b40c0aca8f2cd78c2a749ac1e7238fdd589c2b90`, CSS `?v=20261120-diagrams`) |
| Local preview | `http://127.0.0.1:4173/` (currently running; Chrome tabs: live `323695189`, local `323695199`) |
| Node binary used | `C:\Users\Arun\AppData\Local\Temp\opencode\node-v22.14.0-win-x64\node.exe` |
| Tools dir | `C:\Users\Arun\Desktop\sarkari-jobs\frontend-tools` |
| Preview server command | `node ...\http-server\bin\http-server C:\Users\Arun\Desktop\sarkari-jobs -p 8765 -a 127.0.0.1 -c-1` |
| Current CSS cache key | `20261122-trust-refresh` (on `index.html` + all guide pages) |
| Git state | No commits, pushes or deploys made during this work |

**Verification commands** (run from `frontend-tools/`):
```
$env:PATH = 'C:\Users\Arun\AppData\Local\Temp\opencode\node-v22.14.0-win-x64;' + $env:PATH
npm run check
npm run audit
npm run visual:check
```

---

## 2. Work completed (all local, uncommitted)

### 2.1 Homepage rebuild (earlier in the session)
- Replaced old "Never Miss a Sarkari Deadline Again" hero with a source-first hero: 3D waving flag, search bar, stats.
- Added source-trust ribbon, sourcing method band, journey/process overlay, deadline ticker, category grid, interactive India SVG map, NCS career-services bento, and footer.
- Kept job/result/admit-card layouts. Full section-by-section research is in `FRONTEND_DESIGN_REVIEW.md`.

### 2.2 Image refresh
- Six illustrations regenerated with **Mage Mango 4** (account `@pMITUiUb`) and converted to WebP with Sharp; originals backed up to `C:\Users\Arun\AppData\Local\Temp\opencode\original-site-images`.
  - `assets/realistic/source-notice.webp` 63 KB, `exam-centre.webp` 100 KB, `government-office.webp` 133 KB
  - `assets/ncs-posters/skill-quotient.webp` 100 KB, `ai-interview.webp` 49 KB, `ai-resume.webp` 57 KB
- `index.html` references the `.webp` posters.
- **Left authentic deliberately:** all 12 official portal logos, and `assets/ncs-launch-modi.jpg` (GODL-attributed photo of the PM dedicating the NCS portal). Never AI-generate these.
- Mage has 6 Gems left (42 needed per generation); built-in image generator has no credits. True MP4 impossible (no ffmpeg), so motion is animated WebP.

### 2.3 Motion assets
- `assets/motion/hero-drift.webp` 250 KB — homepage `.hero-bg` background, ping-pong Ken Burns frames from the earlier AI hero photo.
- `assets/motion/guides-ambient.webp` 305 KB — `.g-hero::after` on all guide pages with `mix-blend-mode: screen`.
- Both hidden/neutralised under `prefers-reduced-motion`.

### 2.4 CSS refinements
- Display type: `text-wrap: balance`, tighter leading/tracking on hero, section heads, guide h1 and card names.
- `:focus-within` ring on the composite search control.
- Gradient hairline border technique (`border: 1px solid transparent` + two clipped backgrounds) on the trust ribbon.
- Hover reveal line on method cards; hover zoom on NCS posters; radial depth on footer.
- Motion assets and reduced-motion overrides.

### 2.5 Text + image blend/overlay pass (most recent before Trusted-by)
- Restored and refined the frosted `.source-photo-badge` ("NCS portal launch · 2015") that the local redesign had dropped — `backdrop-filter: blur(8px) saturate(1.2)`, hairline border, pulsing saffron dot, reduced-motion respected. Attribution figcaption kept and given a two-layer text shadow.
- Hero scrim upgraded from one flat gradient to a radial spotlight + directional wash; two-layer text shadows on hero/sub/card titles.
- `isolation: isolate` on `.wave-flag` to contain its `mix-blend-mode: overlay` sheen.
- Radial `mask-image` edge fade on `.journey-art` so the diagram dissolves into the panel.
- Full "how it is done" playbook with CSS snippets is in `FRONTEND_DESIGN_REVIEW.md`.

### 2.6 Trusted-by section redesign (latest change)
The live site has **no** Trusted-by section, so this was designed from scratch. Changes in `index.html` + `css/style.css`:
- New hierarchy: green check eyebrow "VERIFIED SOURCES" → `Trusted by <span class="trust-count">40+</span>` (the `40+` is 1.32em, saffron-dark) → description → separate styled "Browse all listings →" link with sliding arrow and focus ring.
- "Trusted by 40+" claim **kept** (grounded in GA4 188 active users — do not change to an unsupported source-count claim; `data/jobs.json` has 28 distinct sources).
- Added a centred "OFFICIAL SOURCE MARKS WE FOLLOW" label above the 12 logos.
- Added a tricolor accent line under the ribbon's top edge and a soft radial wash in the marks panel.
- Logo tiles grew to 76px with inset highlight; on hover they lift, gain a shadow, the grayscale logo goes full colour with a slight scale, and a saffron→green hairline wipes in along the bottom.
- All 12 official marks remain authentic and load correctly. Reduced-motion overrides updated.
- Cache key bumped to `20261122-trust-refresh`.

---

## 3. Verification status

- `npm run check` — **passed** after every pass; only 2 pre-existing warnings in `js/states-data.js` (`STATES`, `CATEGORIES` unused).
- `npm run audit` — 3 Lighthouse runs, all assertions passed: **performance 85**, accessibility 100, best-practices 100, SEO 100; FCP 0.5 s, LCP 2.8 s, CLS 0, TBT 0 ms. (Started at performance 80 / LCP 3.8 s before the image refresh.) Scores unchanged after the blend and Trusted-by passes.
- `npm run visual:check` — About passes. Homepage still fails at **19%** pixel difference **only** because `frontend-tools/tests/visual.spec.js-snapshots/homepage-win32.png` is the stale 20 Nov baseline. **Do not regenerate it until aesthetic approval.**
- Browser verification: new stills decode at target sizes; motion backgrounds resolve; frosted badge computed styles confirmed; Trusted-by check confirmed 12 loaded logos, accent gradient, underline gradient, and 38 px `40+`.

---

## 4. Key files

| File | Role |
|---|---|
| `index.html` | Homepage markup — hero, trust ribbon, method cards, NCS bento, journey |
| `css/style.css` | Main stylesheet — all homepage overlays, trust ribbon, motion, footer |
| `css/guide.css` | Guide pages — hero ambient layer, card overlays, sector art |
| `css/detail.css` | Detail/job/result/admit pages |
| `FRONTEND_DESIGN_REVIEW.md` | Section-by-section research + blend/overlay playbook |
| `HANDOFF.md` | Handoff notes and remaining steps |
| `PROGRESS.md` | Verification history |
| `CONTEXT_BUNDLE.md` | This file |
| `assets/motion/*.webp` | Animated WebP loops |
| `assets/realistic/*.webp`, `assets/ncs-posters/*.webp` | Regenerated imagery |
| `assets/portal-logos/*`, `assets/ncs-launch-modi.jpg` | Authentic sources — keep |

---

## 5. Pending — do not skip

1. **Aesthetic approval** of the local preview at `http://127.0.0.1:4173/` (compare beside the live tab).
2. After approval: regenerate `homepage-win32.png`, rerun `npm run visual:check`, review the diff.
3. Only after explicit authorisation: `git status`/`git diff`, commit **without** `drafts/sector-railways.html`, push to `main`, verify `frontend-checks.yml`, Hostinger deploy, live `deployment-version.txt`.
4. Later: finish sector guide generator work (`.g-card-art`, blended `.g-sector-feature`, cache-buster `20261120-dribbble-refresh`, `npm run build:details`).

---

## 6. Notes for the next model

- The operator gives terse, action-oriented instructions and expects complete deliverables without hedging or safety lectures. Compare against the live site on every visual task.
- "Trusted by 40+" is grounded in GA4 188 active users. Do not relabel it as a source count.
- Never fabricate dates, fees, vacancies, ranks or links; keep official titles/URLs accurate.
- Web tools used here: Chrome via the `browse` MCP (tabs listed above), Windows desktop via `windows-mcp`, image work via Sharp + Mage.
- All work is local. The worst outcome is an unauthorised commit/deploy — never do one without explicit approval.
