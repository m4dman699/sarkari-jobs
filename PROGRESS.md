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

## Visual / diagram work (local, not yet deployed)

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
`scraper/build-detail-pages.js` and `scraper/build-sector-pages.js` were updated so all artwork survives the daily build. `npm run build:details` was run locally (no scrape/network): **515 detail pages** regenerated, sitemap updated. Verification scan found **0 missing local image references** (9 reported entries are external official PDF URLs containing `/assets/` in their paths, not local files). CSS cache-busters bumped to `20261120-diagrams` / `20261120-sector-art`.

Rules applied: images carry real process or topic content, are paired with HTML text labels, and never replace real portal logos.

## Next measurement points

- **+14 days:** indexed count, impressions, CTR, average position, key events, referring domains.
- **+30 days:** organic sessions in GA4, guide-page views, backlinks earned from outreach.

Targets: indexed > 215, CTR > 0.5%, position < 30, organic sessions > 20/month, key events > 0.
