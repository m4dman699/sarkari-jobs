# SarkariJobs+ — change & performance progress

Track every major change against real Search Console / GA4 numbers. Update this file after each deployment, not before.

## Baseline — 20 Nov 2026 (launch ~21 Oct 2026, ~30 days)

### Search Console (21 Oct – 17 Nov 2026)
| Metric | Value |
|---|---|
| Clicks | 1 |
| Impressions | 439 |
| CTR | 0.2% |
| Average position | 49.9 |
| Queries / pages | 121 / 142 |
| Indexed / not indexed | 215 / 469 |

Reasons for non-indexing: 280 crawled-not-indexed, 182 discovered-not-indexed, 3 alternate canonical, 2 page-with-redirect, 1 duplicate, 1 redirect error.

### GA4 (21 Oct – 20 Nov 2026)
| Metric | Value |
|---|---|
| Active users | 188 |
| Sessions | 206 |
| Views | 551 |
| Events | 1,386 |
| Engagement rate | 40.8% |
| Avg engagement / user | 23s |
| Key events | 0 |

Channels: Direct 196 (95.2%), Organic Search 4, AI Assistant 3, Referral 3.
Events: page_view 551, user_engagement 266, session_start 207, first_visit 189, scroll 148, click 17, file_download 5, outbound_click 2, form_start 1.

## Change log

| Date | Change | Deployed | Expected effect | Status |
|---|---|---|---|---|
| 20 Nov 2026 | Sitemap rebuilt to 539 URLs, thin detail pages removed, hubs added; resubmitted | Yes | Cleaner crawl priorities | GSC: Success, 539 discovered, last read 20 Nov |
| 20 Nov 2026 | Original data-backed intros + cross-links added to `category.html` and `state.html` | Yes (`a4d96ab`) | More useful hub pages for indexing | Live verified; awaiting re-index |
| 20 Nov 2026 | Indexing requested for `category.html`, `state.html`, `admit-cards.html` | n/a | Faster re-crawl | Added to priority queue; recheck in 7–14 days |
| 20 Nov 2026 | `outbound_click` marked as key event in GA4 | n/a | Conversion tracking | Marked; still 0 key events — verify in Admin → Events |

## Visual / diagram work

### Generic process diagrams (6)
| Item | Purpose | File | Placement |
|---|---|---|---|
| Recruitment journey | Notice → application → exam → result → joining | `assets/diagrams/journey-flow.webp` | Homepage + `category`, `state`, `results`, `admit-cards`, `all-jobs` |
| Sector map | The 12 sectors covered by the guides | `assets/diagrams/sector-map.webp` | `guides/index.html` |
| Eligibility ladder | Qualification → post progression | `assets/diagrams/eligibility-ladder.webp` | All 12 sector guides |
| Exam-day checklist | Hall ticket, ID, centre, reporting time | `assets/diagrams/admit-card-checklist.webp` | Admit-card hub + 174 admit-card detail pages |
| Merit-list reading | Find roll no., rank, scorecard, verification | `assets/diagrams/result-merit-reading.webp` | Results hub + 358 result detail pages |
| Source verification | Official notice → checked record → original page → attribution | `assets/diagrams/source-verification.webp` | `about.html`, `editorial-policy.html` |

### Topic-specific artwork (12)
One unique illustration per sector guide in `assets/sector-art/`: `banking`, `defence`, `employment`, `it-technical`, `judiciary`, `medical`, `police`, `railways`, `revenue`, `ssc`, `teaching`, `upsc` (all `.webp`). Each is used **only** on its matching guide, above the qualification ladder.

All 18 images were generated with the free model `openrouter/recraft/recraft-v4.1-flash-v2:free` (no credits used). All are 1344×768 WebP, lazy-loaded with explicit dimensions, in the site palette (saffron `#FF9933`, green `#138808`, navy `#000080`, off-white `#FFF8EE`). Every image is paired with real HTML labels and a source caveat; no real portal logo was replaced.

### Persistence
`scraper/build-detail-pages.js` and `scraper/build-sector-pages.js` were updated so all artwork survives the daily build. `npm run build:details` was run locally (no scrape/network): **515 detail pages** regenerated, sitemap updated. Verification scan found **0 missing local image references** (9 reported entries are external official PDF URLs containing `/assets/` in their paths, not local files). CSS cache-busters at this stage were `20261120-diagrams` / `20261120-sector-art`; they were later superseded by `20261120-frontend-toolkit` across all generated and hand-maintained pages.

Rules applied: images carry real process or topic content, are paired with HTML text labels, and never replace real portal logos.

### NCS poster ribbon (local, not yet deployed)
The official NCS portal was checked in Chrome. Its real logo (`ncs-small-logo.png`), Ministry of Labour logo and three banner SVGs were inspected. Those three official banners were captured in Chrome and used only as **style references** to generate three original, text-free poster/ribbon illustrations:
`assets/ncs-posters/skill-quotient.png`, `ai-interview.png`, `ai-resume.png` (1200×870/880 PNG). Labels stay in real HTML: Skill Quotient, AI Interview Prep and Free AI Resume Builder. The existing launch photo and its GODL-India attribution remain unchanged; the new ribbon sits above the bento on the homepage with a clear independence note.

These required `openrouter/microsoft/mai-image-2.7-flash` because the usual free Recraft model does not accept reference images; the model showed 0 listed cost and completed successfully. No official text, logo or watermark was copied into the artwork. After review, the artwork was regenerated twice: first into a softer, more realistic friendly clay/cartoon style, then with one uncluttered subject per card that directly matches its HTML label (gauge for Skill Quotient, robot interviewer for AI Interview Prep, resume sheet with checkmark for Free AI Resume Builder). A wide empty ribbon sits at the top of each image so the HTML label reads as part of the poster. A GIF test returned a PNG and was removed; no true animated GIF was produced. Chrome confirmed all three final images load with correct dimensions on the local page; CSS cache-buster for the homepage is `20261120-ncs-ribbons2`.

### Asset audit (Chrome + local scan)
A scan of 934 text files and 74 asset files found no broken local image references on the four sampled live pages after lazy loading. The following assets are unused or weak and need a decision before any change:
- `assets/gen-1.png`, `gen-3.png`, `gen-4.png`, `gen-5.png` — unused 1024×1024 PNGs, about 6.8 MB total.
- `assets/india.svg` — unused third-party ammap.com map with an attribution comment; replace with original art or remove before use.
- `assets/logos/police.png` — unused 32×32; the real `indian-police-service-logo.png` already exists.
- `assets/logos/railways.png` — unused 32×32; the real `assets/portal-logos/railways.png` already exists.
- `assets/logos/sbi-logo.svg` — 143-byte stub, unused.
- `assets/logos/ssc.png` (5632×10240) and `assets/logos/teaching.png` (9728×8224) — oversized unused originals; WebP versions are already used instead.
- `assets/logos/indian-police-service-logo.png` and `assets/logos/staff-selection-commission-logo.jpg` — real but unused; keep as source material or remove deliberately.

No logo was regenerated or replaced. Real official logos stay as downloaded assets.

### Frontend toolkit and source-trust ribbon (local, not yet deployed)
Research was done in the user's real Chrome through the browse bridge. The chosen GitHub tools are Lighthouse CI, Stylelint, html-validate, ESLint, Prettier, axe-core, Playwright, Sharp, AOS and Lucide. AOS and Lucide were reviewed but not enabled because the site already has CSS reveal motion and icons. The connected, active tools live in `frontend-tools/` with a config, npm scripts, a `frontend-checks.yml` workflow, and `FRONTEND_TOOLKIT.md`. Canva is the design source: `canva/README.md` defines export rules, and `npm run canva:prepare` converts `canva/exports/` into optimised `assets/canva/` WebP plus a manifest.

The homepage source ribbon was rebuilt into a modern grayscale logo strip in the "trusted by / powered by" style seen on other sites: **12 real official marks** (UPSC, SSC, Indian Railways, NCS, RBI, IBPS, DSSSB, RPSC, HSSC, GPSC, Supreme Court, TPSC), the headline **"Trusted by 40+ readers"** (per the user's explicit choice), and an explicit non-affiliation line. The 40+ figure is grounded in GA4's 188 active users for Oct 21 – Nov 20, 2026; the feed has 28 distinct sources, so "40+ sources" was not claimed. "Powered by Zomato/OYO" was not used because neither brand is involved with this site. The required `SOURCE-CHECKED, NOT ENDORSED` wording remains on the ribbon. The full-width recruitment journey section uses the original soft-3D artwork as a low-opacity background behind five real HTML step cards. Contrast fixes were applied to the logo, deadline ticker and saffron tags, and the homepage gained a `<main>` landmark. Homepage CSS cache-buster is `20261120-realistic-visuals`.

### Realistic photo layer (local, not yet deployed)
Four photorealistic, text-free WebP images were generated with `openrouter/microsoft/mai-image-2.7-flash` (the free Recraft model cannot accept the reference image this tool requires): `hero-aspirants.webp` (hero background, replacing the old `gen-2.png`), `source-notice.webp`, `exam-centre.webp` and `government-office.webp` in `assets/realistic/`. PNG originals were converted to WebP with Sharp (98–185 KB each) and removed. A new "What happens before a listing goes live" band pairs the three process photos with real HTML captions, so text stays selectable and on-brand. No text, logo or watermark is baked into any photo.

Verification on 20 November 2026: `npm run build:details` regenerated 515 detail pages and the sector guides with no scrape/network. The `20261120-realistic-visuals` cache-buster now covers `style.css` and `detail.css` in both generators and all hand-maintained pages. The About-page accessibility failure was traced to `static-toc.js` inserting a `<span>` directly inside the table-of-contents `<ul>`; the cursor is now an `<li aria-hidden="true">`, and the script cache-buster was bumped. `npm run check` passes (2 known data-global warnings); Playwright screenshot + axe baselines pass for homepage and About; Lighthouse CI passed all assertions in 3 real-Chrome runs with performance 80, accessibility 100, best practices 100 and SEO 100 (LCP 3.8 s, CLS 0). A real-Chrome DOM check confirmed all 12 trust logos, three process photos, the journey artwork, five step cards and three NCS posters load with their expected dimensions. All of this remains local and uncommitted.

### Homepage rebuild verification (21 Nov 2026, local)
`npm run check` passed with the two known `js/states-data.js` warnings. `npm run audit` completed three Lighthouse runs with all assertions passing: performance 80, accessibility 100, best practices 100, SEO 100; FCP 0.5 s, LCP 3.8 s, CLS 0, TBT 0 ms. `npm run visual:check` passed for About but failed for the homepage (18% of pixels differ): the checked-in `homepage-win32.png` baseline is from 20 Nov 14:51, while `index.html` and `css/style.css` were changed later on 21 Nov. The baseline must be regenerated after the design is approved. All work remains local and uncommitted.

### Image + motion refresh and design research (22 Nov 2026, local, not deployed)
Compared every section against live production `sarkarijobsplus.com` and reference patterns from Vercel/Linear/9elements/Smashing Magazine; decisions recorded in `FRONTEND_DESIGN_REVIEW.md`. Replaced three method photos and three NCS posters with Mage Mango 4 generations, converted to WebP (49–133 KB each), with originals backed up outside the repo. Official portal logos and the attributed NCS launch photo stay authentic. Added two animated WebP loops (`hero-drift.webp` 250 KB, `guides-ambient.webp` 305 KB) and applied refined typography/focus/border/hover/footer CSS. Re-audit: performance 85 (from 80), LCP 2.8 s (from 3.8 s), accessibility/best-practices/SEO 100, CLS 0, TBT 0 ms; `npm run check` passed with two pre-existing warnings. Homepage visual baseline still stale (19% diff) pending design approval.

### Text/image blend + overlay pass (22 Nov 2026, local, not deployed)
Compared text-over-image treatments against live production. Live has a frosted `source-photo-badge` on the NCS photo that the local redesign had dropped — restored it with `backdrop-filter: blur(8px) saturate(1.2)`, a hairline light border and a pulsing saffron dot (`prefers-reduced-motion` respected). Upgraded the hero scrim from one flat gradient to a layered radial spotlight + directional wash, and gave hero/sub/card titles a two-layer text shadow. Contained the flag's `mix-blend-mode: overlay` sheen with `isolation: isolate`. Added a radial `mask-image` edge fade to the journey diagram so it dissolves into the panel instead of showing a hard cut. Verified all computed styles in Chrome and sampled pixels from captured section screenshots (badge ~19 luminance levels darker than adjacent photo). `npm run check` passed with the same 2 known warnings; `npm run audit` held performance 85 / a11y 100 / BP 100 / SEO 100, LCP 2.8 s, CLS 0, TBT 0 ms. Cache keys bumped to `20261122-blend-overlay`.

### Trusted-by redesign + context export (22 Nov 2026, local, not deployed)
Live site has no Trusted-by section, so rebuilt it: verified-sources eyebrow with green check, `Trusted by 40+` heading with oversized saffron `40+`, separated browse link with sliding arrow and focus ring, centred marks label, tricolor top accent, radial wash, 76px tiles with hover lift and saffron→green underline wipe. All 12 official logos remain authentic and load correctly; claim text unchanged. Cache keys bumped to `20261122-trust-refresh`. `npm run check` passed (same 2 known warnings); `npm run audit` held 85/100/100/100, LCP 2.8 s, CLS 0, TBT 0 ms. Wrote `CONTEXT_BUNDLE.md` — a paste-ready portable handoff for moving this chat to a free coding platform with full context.

## Next measurement points

- **+14 days:** indexed count, impressions, CTR, average position, key events, referring domains.
- **+30 days:** organic sessions in GA4, guide-page views, backlinks earned from outreach.

Targets: indexed > 215, CTR > 0.5%, position < 30, organic sessions > 20/month, key events > 0.
