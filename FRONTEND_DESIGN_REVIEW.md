# Frontend design review — homepage + guides (local, uncommitted, 22 Nov 2026)

## Baseline used for every comparison
- **Live production:** `https://sarkarijobsplus.com/` (commit `b40c0aca…`, CSS `?v=20261120-diagrams`). It still serves the older "Never Miss a Sarkari Deadline Again" hero, a single diagram band, and a 12-logo source strip.
- **Local working copy:** `C:\Users\Arun\Desktop\sarkari-jobs`, served at `http://127.0.0.1:4173/`.
- **References inspected in Chrome:** Vercel (display type scale), Linear (card borders / one-pixel gradient hairlines), 9elements "Building the Perfect Logo Strip" (already the basis of the existing trust ribbon), Smashing Magazine on accessible text over images (the existing one-directional hero scrim).

## Section-by-section decision

| Section | Live site | Local before this pass | Decision adopted | CSS technique used |
|---|---|---|---|---|
| Header | Sticky white bar | Same + backdrop blur | Keep; no change needed | `position: sticky`, `backdrop-filter: blur(12px)` |
| Hero | Photo + orb gradients + old headline | Animated hero, 3D flag, search, stats | **Tighten display type; live background** | `text-wrap: balance`, `line-height: 1.06`, `letter-spacing: -.045em`; animated WebP background; `:focus-within` ring on the composite search control |
| Trusted-by / source location | 12 flat logos, caption on live | Grayscale tile strip + "Trusted by 40+" + non-affiliation note | **Keep real official marks; upgrade the frame** — never AI-generate government logos | Gradient hairline border via `border: 1px solid transparent` + `background: linear-gradient(#fff,#fff) padding-box, linear-gradient(...) border-box` |
| Method band | Not on live | 3 illustrative photos + real HTML captions | **Replace all three photos; add subtle reveal** | Mage-generated 16:9 WebPs; `::before` tricolor progress line that scales in on hover |
| Journey / process | One static diagram | Diagram + 5-step overlay | Keep; content-first HTML/CSS | Existing `.journey-*` grid |
| Deadline ticker | Not on live | CSS marquee | Keep; pause on hover | `animation: scrollX`, `animation-play-state: paused` |
| Categories | 4-column cards | Same | Keep; no change needed | Existing `.cat-grid` hover lift + tricolor line |
| India map | Interactive SVG | Same + magnified insets | Keep; no change needed | SVG state paths, focus-visible outline |
| NCS / career sources | Old bento + launch photo | Bento + 3 illustrative posters + attributed launch photo | **Replace all three posters; add life** | Mage-generated 3:2 WebPs; hover `scale(1.05)` with reduced-motion override |
| Guides hero | Not on live | Gradient + dot pattern | **Add lightweight motion** | Animated WebP ambient layer on `.g-hero::after`, hidden for `prefers-reduced-motion`; `text-wrap: balance` on h1 |
| Job / result / admit cards | Standard cards | Same | Keep; no change needed | Existing hover lift + status borders |
| Footer | Flat dark | Same | **Add depth** | Two soft radial washes on `footer::before` |

## Images — generated and installed
Generated with **Mango 4** in the user's Mage account (`@pMITUiUb`), then processed with Sharp. All are text/logo/watermark-free and saved as optimised WebP; originals were backed up outside the project.

| File | Source | Size |
|---|---|---|
| `assets/realistic/source-notice.webp` | Mage Mango 4, 16:9 | 63 KB |
| `assets/realistic/exam-centre.webp` | Mage Mango 4, 16:9 | 100 KB |
| `assets/realistic/government-office.webp` | Mage Mango 4, 16:9 | 133 KB |
| `assets/ncs-posters/skill-quotient.webp` | Mage Mango 4, 3:2 | 100 KB |
| `assets/ncs-posters/ai-interview.webp` | Mage Mango 4, 3:2 | 49 KB |
| `assets/ncs-posters/ai-resume.webp` | Mage Mango 4, 3:2 | 57 KB |

**Left authentic on purpose:** all 12 official portal logos in the Trusted-by strip, and the GODL-attributed photo of the Hon'ble Prime Minister dedicating the National Career Service portal in `assets/ncs-launch-modi.jpg`. Those are real source marks / a real historical photo with attribution — replacing them with generated imagery would make the site's sourcing claims false.

## Motion assets (GIF-equivalent loops)
Mage Gems were exhausted after the six stills (6 left; a generation costs 42), and the built-in image generator had no remaining credits, so the hero still photo from the earlier AI pass was retained as the source. Two lightweight **animated WebP** loops were produced locally with Sharp (ping-pong Ken Burns frames, reduced-motion respected):

| File | Use | Size |
|---|---|---|
| `assets/motion/hero-drift.webp` | Homepage `.hero-bg` background | 250 KB |
| `assets/motion/guides-ambient.webp` | `.g-hero::after` on all 13 guide pages | 305 KB |

These are animated images, not MP4 files — no ffmpeg is installed on this machine. They give real visible motion at a fraction of a video's weight.

## Text + image blend / overlay playbook — how it is done here

There are six surfaces where type sits on, or blends into, imagery. Each uses a different CSS mechanism. All are in `css/style.css` and `css/guide.css`.

### 1. Layered "spotlight" scrim — homepage hero (`.hero-bg::after`)
A single flat dark overlay dulls the whole photo. Instead, stack two gradients on a pseudo-element: a **radial pool** of darkness centred on the headline, and a **directional wash** that stays subtle on the image side.

```css
.hero-bg::after {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(900px 520px at 12% 42%, rgba(6,13,31,.96) 0%, rgba(6,13,31,.58) 52%, transparent 78%),
    linear-gradient(90deg, rgba(6,13,31,.92) 0%, rgba(6,13,31,.78) 36%, rgba(6,13,31,.42) 70%, rgba(6,13,31,.22) 100%);
}
```
The pseudo-element inherits `.hero-bg`'s `opacity: .5`, so the effective darkness is gentle; the text shadow below does the final legibility work.

### 2. Two-layer text shadow — hero and guide card titles
One wide blur alone makes letters look foggy. Combine a **tight 1 px halo** (edge definition on busy pixels) with a **wide soft shadow** (lifts the block off the image):

```css
.hero h1 {
  text-shadow: 0 1px 2px rgba(3,8,20,.6), 0 4px 24px rgba(3,8,20,.42);
}
.g-card-name {
  text-shadow: 0 1px 2px rgba(0,0,0,.55), 0 2px 14px rgba(0,0,0,.45);
}
```

### 3. Frosted-glass chip — NCS launch photo (`.source-photo-badge`)
The live site had a small dark pill reading "● NCS portal launch · 2015"; the redesign had dropped it, so it is restored and refined. A translucent background + **backdrop blur** + hairline light border keeps text readable without an opaque box:

```css
.source-photo-badge {
  position: absolute; z-index: 2; top: 16px; left: 16px;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 13px;
  border: 1px solid rgba(255,255,255,.26);
  border-radius: 999px;
  background: rgba(12,26,49,.72);
  backdrop-filter: blur(8px) saturate(1.2);
  color: #fff; font-size: .78rem; font-weight: 750;
}
```
A saffron `.badge-dot` with a pulsing `box-shadow` ring adds a live accent (disabled under reduced motion). The photo's `::after` scrim was also strengthened at the bottom so the GODL attribution stays readable.

### 4. `mix-blend-mode` — fabric sheen and guides ambient layer
Blend modes merge a layer's pixels with whatever is beneath it:
- `.wave-flag::after` uses `mix-blend-mode: overlay` with a repeating diagonal gradient to fake a fabric sheen. **`isolation: isolate` was added to `.wave-flag`** so the blend is confined to the flag's own tricolour and never bleeds into the hero photo behind it.
- `.g-hero::after` uses `mix-blend-mode: screen` on the animated `guides-ambient.webp`, so only the light parts lift the dark navy hero.

### 5. `mask-image` edge fade — journey diagram (`.journey-art`)
A faded diagram with hard rectangular edges reads as a pasted picture. A radial **alpha mask** dissolves the edges into the cream panel — no extra element, no blend cost:

```css
.journey-art {
  -webkit-mask-image: radial-gradient(ellipse 88% 92% at 50% 50%, #000 52%, transparent 100%);
  mask-image: radial-gradient(ellipse 88% 92% at 50% 50%, #000 52%, transparent 100%);
}
```
`-webkit-mask-image` covers Safari; the standard property covers Chrome/Firefox.

### 6. Contained gradient overlay — guide cards (`.g-card`)
`.g-card` sets `isolation: isolate`, then stacks a bottom-heavy linear scrim plus a small radial highlight on `::after` at `z-index: 1`. The artwork sits at `z-index: 0`, text at `z-index: 2`, and the accent bar at `z-index: 3` — a clean stacking order guaranteed by `isolation`. Note the guides cards themselves are logo-only on both live and local (no background photo), so this overlay supplies depth without an image request.

### Verification of the blends
Computed styles were checked in Chrome: badge `backdrop-filter: blur(8px) saturate(1.2)`, hero scrim both gradients present, both text shadows applied, journey mask present, flag `isolation: isolate`. Pixel sampling of the captured sections confirmed the frosted badge is ~19 luminance levels darker than the adjacent photo, and the hero's top-left scrim is materially darker than the right side.

## Verification
- `npm run check` — passed (2 pre-existing `js/states-data.js` warnings only).
- `npm run audit` — 3 Lighthouse runs, all assertions passed. **Performance 85** (was 80), accessibility 100, best practices 100, SEO 100; FCP 0.5 s, **LCP 2.8 s** (was 3.8 s), CLS 0, TBT 0 ms.
- `npm run visual:check` — About passed. Homepage still fails at 19% pixel difference because `homepage-win32.png` is the 20 Nov baseline and the redesign postdates it. Regenerate only after design approval.
- Browser verification: all six new stills decode at their target dimensions; the guides hero resolves `guides-ambient.webp`; the homepage hero resolves `hero-drift.webp`.

## Still waiting on
1. Aesthetic approval of the local preview.
2. After approval: regenerate `homepage-win32.png`, rerun `visual:check`, review the diff.
3. Explicit authorisation before any commit, push, or Hostinger deploy.
