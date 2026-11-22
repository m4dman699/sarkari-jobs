# CSS "bypass" research — per frontend element

Local research note, 22 Nov 2026. For each element used in the SarkariJobs+ redesign this records the **problem CSS has no clean API for**, the proven workaround ("bypass") from a well-known source, the exact copy-ready code, and where it applies on the site.

Primary sources fetched this session:
- 9elements — *Building the Perfect Logo Strip* — https://9elements.com/blog/building-the-perfect-logo-strip/
- MDN — `backdrop-filter` — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter
- MDN — `mask-image` — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image
- MDN — *Using CSS transforms* — https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transforms/Using
- CSS-Tricks — *Gradient Borders in CSS* — https://css-tricks.com/gradient-borders-in-css/
- CSS-Tricks — *Line Clampin'* — https://css-tricks.com/line-clampin/
- Chrome Developers — *CSS text-wrap: balance* — https://developer.chrome.com/blog/css-text-wrap-balance

---

## 1. Gradient hairline border (Trusted-by ribbon)

**Problem:** CSS has no `border-image` that respects `border-radius`. Straight `border-image` can't round corners.

**Bypass (CSS-Tricks, Chris Coyier; single-element variant by Alex Overbeck in the comments):** make the border transparent and paint the gradient as a *second background clipped to the border box*, with the first background clipped to the padding box. Source: https://css-tricks.com/gradient-borders-in-css/

```css
.trust-ribbon {
  border: 1px solid transparent;
  border-radius: 20px;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(120deg, rgba(255,153,51,.55), #e7edf6 38%, rgba(19,136,8,.45)) border-box;
}
```
Equivalent comment variant using `background-origin` (same idea, explicit origins):
```css
.wrapper {
  background: linear-gradient(#222,#222), linear-gradient(to right, red, purple);
  background-origin: padding-box, border-box;
  background-repeat: no-repeat; /* important */
  border: 5px solid transparent;
}
```
Alternative from the same source: pseudo-element with negative `z-index`, or `border-image` + `border-image-slice: 1` (fastest syntax but **incompatible with radius**). We chose the two-background trick because it keeps the 20px radius and needs no extra element.

**Applied:** `.trust-ribbon` in `css/style.css`.

---

## 2. Frosted-glass badge (NCS photo badge, sticky header)

**Problem:** `backdrop-filter` only affects what is painted *behind* the element, and a transparent/partly-transparent background is required to see the effect. Worse, any ancestor with `opacity < 1`, `filter`, `mask`, `clip-path`, `mix-blend-mode` or `backdrop-filter` becomes a **backdrop root** and silently kills the blur.

**Bypass (MDN):** give the element a semi-transparent `background-color`, apply `backdrop-filter`, and audit ancestors for accidental backdrop roots. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter

```css
.source-photo-badge {
  background: rgba(255,255,255,.16);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2); /* Safari */
  border: 1px solid rgba(255,255,255,.45);
}
```
MDN example for reference: `.box { background-color: rgb(255 255 255 / 30%); backdrop-filter: blur(10px); }`.

**Applied:** `.source-photo-badge` (frosted attribution pill) and the translucent `.nav-wrap` header. **Gotcha already handled:** the photo tile uses `isolation: isolate`, not `opacity`, so it does not create a backdrop root above the badge.

---

## 3. Perfect logo strip — 12 official marks (Trusted-by)

**Problem:** logos have wildly different aspect ratios; setting one height makes wide marks look huge and portrait marks (RBI) tower over the row.

**Bypass (9elements, Nils Binder; equal-area variant by Roman Komarov):** use unitless `--width`/`--height` custom properties and compute an aspect-ratio-driven height. The equal-area method scales each logo so width × height equals the area of a square at the base height, using a `sqrt` of the ratio; a `strength` variable interpolates between raw and adjusted heights. Removing units from a height uses the `atan2`/`tan` trick. Source: https://9elements.com/blog/building-the-perfect-logo-strip/

```html
<div class="logo" style="--width:49; --height:48;"><img src="a.svg" alt=""></div>
```
```css
.logo-row { --base-height: 3rem; --strength: .9; display:flex; flex-wrap:wrap; gap:3rem 2rem; align-items:center; }
.logo {
  --base-ratio: calc(var(--width) / var(--height));
  --area-ratio: calc((var(--base-height) * var(--base-height)) / (var(--width) * var(--height)));
  --factor: clamp(.5, pow(var(--area-ratio), .5), 1.6); /* sqrt of ratio */
  aspect-ratio: var(--base-ratio);
  height: calc(var(--base-height) * (1 + (var(--factor) - 1) * var(--strength)));
}
.logo img { width:100%; height:auto; }
```
Original linear-interpolation fallback (their main method) for wide logos:
```css
--factor-horizontal: min(-0.1 * var(--base-ratio) + 1.1, 1);
height: max(var(--base-height)/2, var(--base-height) * var(--factor-horizontal));
```
**Applied:** our 12 tiles use per-item `--logo-h` values (30–45px) in equal-height 76px tiles with grayscale→colour hover — a simpler fixed-height variant of the same principle; the 9elements formula is the upgrade path if marks are ever swapped dynamically via CMS.

---

## 4. Edge-fade on journey diagram

**Problem:** a diagram pasted onto a panel has a hard rectangular edge; fading it smoothly to transparent needs no extra overlay image.

**Bypass (MDN `mask-image`):** use a `radial-gradient()` (or linear gradient) as the mask. Transparent parts of the mask hide the element; opaque parts show it. Supports multiple masks with `mask-size`/`mask-position`/`mask-repeat`. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image

```css
.journey-art {
  -webkit-mask-image: radial-gradient(ellipse 88% 92% at 50% 50%, #000 52%, transparent 100%);
  mask-image: radial-gradient(ellipse 88% 92% at 50% 50%, #000 52%, transparent 100%);
}
/* MDN canonical soft-edge example: */
img { mask-image: radial-gradient(black 50%, transparent 60%); }
```
**Applied:** `.journey-art` — the diagram dissolves into the cream panel. On mobile the art opacity rises to .24 to compensate.

---

## 5. Multi-line title truncation (job cards)

**Problem:** `text-overflow: ellipsis` only works on a single nowrap line.

**Bypass (CSS-Tricks, *Line Clampin'*, Chris Coyier):** the now-standardised WebKit old-flexbox technique — `display:-webkit-box`, `-webkit-line-clamp`, `-webkit-box-orient: vertical`. It is in the Overflow spec and works in Firefox too now. Source: https://css-tricks.com/line-clampin/

```css
.job-title {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```
Fade-out alternative from the same article when you don't want a hard cut (gradient pseudo-element one line tall):
```css
.fade { position:relative; height:3.6em; overflow:hidden; } /* 1.2em × 3 */
.fade::after { content:""; position:absolute; bottom:0; right:0; width:70%; height:1.2em;
  background:linear-gradient(to right, rgba(255,255,255,0), #fff 50%); pointer-events:none; }
```
**Applied:** job/result/admit card titles clamp to 3 lines. **Gotcha from source:** don't add vertical padding to a clamped element — it exposes extra lines.

---

## 6. Balanced headlines (hero, section heads, guide h1, card names)

**Problem:** browsers wrap headlines with ugly orphan words; hand-authoring `<wbr>`/`&shy;` doesn't scale to dynamic content.

**Bypass (Chrome Developers, Adam Argyle):** `text-wrap: balance` — the browser binary-searches the smallest width that adds no line, using its knowledge of font/language/space. Source: https://developer.chrome.com/blog/css-text-wrap-balance

```css
h1,h2,h3,h4,h5,h6,blockquote { text-wrap: balance; }   /* recommended scope */
```
Rules from the source worth keeping:
- Works only for **≤6 wrapped lines** — do not apply to `*`.
- Needs a `max-inline-size` (or `max-width`) to have an effect.
- To re-enable after `white-space`, set `white-space: unset; text-wrap: balance;`.
- `text-wrap: pretty` is the companion for body copy (prevents orphans, no line limit).

**Applied:** `.hero h1`, `.section-head h2`, `.g-hero h1`, `.trust-copy h2`, `.method-card` titles, card names. Body subheads use `text-wrap: pretty`.

---

## 7. 3D waving flag (hero)

**Problem:** a flat CSS tricolour looks lifeless; a real 3D wave needs perspective setup.

**Bypass (MDN, *Using CSS transforms*):** set `perspective` on a parent, `transform-style: preserve-3d` on the transformed element, an explicit `transform-origin`, and animate `rotateY`/`rotateX`. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transforms/Using

```css
.flag-stage { perspective: 900px; display:grid; place-items:center; }
.wave-flag {
  transform-style: preserve-3d;
  transform-origin: left center;
  animation: flagWave3D 4.5s ease-in-out infinite;
}
@keyframes flagWave3D {
  0%,100% { transform: rotateY(0deg)   rotateX(0deg); }
  50%     { transform: rotateY(18deg)  rotateX(-4deg); }
}
```
MDN notes lower `perspective` px = deeper 3D; `perspective-origin` moves the viewer. **Applied:** `.flag-stage`/`.wave-flag` with a 21% white chakra circle and a `mix-blend-mode: overlay` fabric sheen — the sheen is contained with `isolation: isolate` so it blends against the flag only, not the hero photo.

---

## 8. Marquee ticker (deadlines)

**Problem:** no CSS "scroll text" property exists; JS marquees are heavy and janky.

**Bypass (standard community pattern):** duplicate the track content, animate a `width:max-content` flex row by exactly `translateX(-50%)`, so the loop is seamless at the midpoint. Pause on hover; hide fully with `[hidden]{display:none}`.

```css
.ticker-wrap { overflow:hidden; background:var(--navy); padding:13px 0; }
.ticker { display:flex; width:max-content; gap:56px; animation:scrollX 32s linear infinite; }
.ticker-wrap:hover .ticker { animation-play-state: paused; }
@keyframes scrollX { from { transform:translateX(0); } to { transform:translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .ticker { animation:none; } }
```
**Applied:** deadline ticker. The duplicated list is rendered in the template; the label pill uses a separate `pulse` box-shadow animation.

---

## 9. Text legibility over imagery

**Problem:** white text on a photo loses contrast as the image brightens.

**Bypass (widely used display-type practice):** never rely on the image alone — stack a gradient **scrim** plus a **two-layer text-shadow** (tight halo + wide lift). The scrim does the contrast work; the shadow rescues individual glyph edges.

```css
.hero h1 { text-shadow: 0 1px 2px rgba(0,0,0,.55), 0 6px 24px rgba(0,0,0,.45); }
.hero-bg::after {
  content:''; position:absolute; inset:0;
  background:
    radial-gradient(900px 460px at 22% 36%, rgba(4,8,20,.5), transparent 70%),
    linear-gradient(90deg, rgba(4,8,20,.6), rgba(4,8,20,.12) 65%);
}
```
**Applied:** hero headline/subhead, NCS photo attribution, guide card names. All text over imagery also keeps a scrim or frosted backing so it survives `prefers-reduced-contrast`/image failures.

---

## 10. Sticky translucent header

**Problem:** a solid sticky header hides the design beneath; full transparency makes nav unreadable on scroll.

**Bypass:** `position:sticky; top:0; z-index:100` + near-opaque white (`.95`) and `backdrop-filter: blur(12px)` (same MDN backdrop-filter principle as §2). Tricolor underline via `::after` growing `width:0→100%`.

```css
.site-header { position:sticky; top:0; z-index:100; background:rgba(255,255,255,.95);
  backdrop-filter:blur(12px); }
.nav a::after { content:''; height:3px; width:0; background:var(--tricolor); transition:width .25s; }
.nav a:hover::after, .nav a:focus-visible::after { width:100%; }
```

---

## 11. Composite search focus ring

**Problem:** focusing the inner `<input>` should highlight the whole pill, not draw a second native ring on the input.

**Bypass:** put `:focus-within` on the wrapper for the ring, and remove the input's own outline.

```css
.search { display:flex; border-radius:14px; }
.search:focus-within { box-shadow: var(--focus-ring); }
.search input { border:0; outline:0; background:transparent; }
```
**Applied:** hero search control. Also `:focus-visible` on links/cards for keyboard parity.

---

## 12. Bento layout (NCS source guide)

**Problem:** a photo + two cards that reflow cleanly needs a span-based grid, not nested flex hacks.

**Bypass:** a 12-column / 2-row grid with explicit spans; collapse to 6-col at ≤900px and 1-col at ≤640px.

```css
.source-bento { display:grid; grid-template-columns:repeat(12,minmax(0,1fr));
  grid-template-rows:repeat(2,minmax(205px,1fr)); gap:16px; }
.source-photo-tile { grid-column:span 7; grid-row:span 2; }
.source-bento-card { grid-column:span 5; }
```
**Applied:** `.source-bento` with the authentic GODL-attributed NCS photo tile.

---

## 13. Hover reveals (method cards, NCS posters, trust tiles)

**Problem:** a hairline that appears on hover can't animate `border` width without layout shift.

**Bypass:** pseudo-element bar scaled with `transform: scaleX(0)→(1)` and `transform-origin:left`; images use `transform: scale(1)→(1.05)`. No layout shift, compositor-friendly.

```css
.method-card::before { content:''; position:absolute; inset:0 0 auto; height:3px;
  background:linear-gradient(90deg,var(--saffron),var(--navy),var(--green));
  transform:scaleX(0); transform-origin:left; transition:transform .35s var(--ease-out); }
.method-card:hover::before { transform:scaleX(1); }
```

---

## 14. Reduced motion as a hard requirement

**Problem:** every effect above is motion; it must degrade without losing information.

**Bypass:** a global `@media (prefers-reduced-motion: reduce)` block that neutralises animations, kills the ambient WebP layers, and forces reveals visible.

```css
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity:1 !important; transform:none !important; animation:none !important; }
  .orb, .hero-bg, .g-hero::after, .ticker, .wave-flag { animation:none !important; }
  * { scroll-behavior:auto !important; }
}
```
**Applied:** present across `style.css`, `guide.css`, `detail.css`.

---

## Quick reference — element → source → file

| Element | Source | Section / file |
|---|---|---|
| Gradient hairline border | CSS-Tricks | Trusted-by ribbon · `style.css` |
| Frosted glass badge | MDN backdrop-filter | NCS badge, sticky header · `style.css` |
| Logo strip sizing | 9elements | Trusted-by logos · `style.css` |
| Edge-fade diagram | MDN mask-image | Journey art · `style.css` |
| Title truncation | CSS-Tricks | Job cards · `style.css` |
| Balanced headlines | Chrome Developers | All h1/h2 · `style.css`, `guide.css` |
| 3D flag | MDN transforms | Hero · `style.css` |
| Marquee | standard duplicated-track pattern | Ticker · `style.css` |
| Text-over-image | scrim + two-layer shadow practice | Hero, cards · all CSS |
| Sticky translucent header | backdrop-filter | Header · `style.css` |
| Composite focus ring | `:focus-within` | Search · `style.css` |
| Bento grid | span-based CSS grid | NCS section · `style.css` |
| Hover reveal | scaleX pseudo-element | Cards · `style.css`, `guide.css` |
| Reduced motion | `@media` neutralisation | Global |

All of these are already implemented in the local redesign except the full 9elements equal-area formula (we use the simpler fixed-height variant). Nothing here has been deployed; local preview only at `http://127.0.0.1:4173/`.
