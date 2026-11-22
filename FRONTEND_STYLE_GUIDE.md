# SarkariJobs+ — Frontend style, section by section

Local working copy, 22 Nov 2026. Source of truth: `css/style.css`, `css/guide.css`, `css/detail.css`.
Live comparison baseline: `https://sarkarijobsplus.com/`.

---

## 0. Design tokens and global base

All colours and shared effects are CSS variables on `:root` (`css/style.css:6-23`):

| Token | Value | Used for |
|---|---|---|
| `--saffron` | `#FF9933` | Primary accent, tricolor, ticker label, focus ring |
| `--saffron-dark` | `#e07f1a` | Hover text on light surfaces, dark saffron on white |
| `--green` | `#138808` | Secondary accent, success, live status |
| `--green-dark` | `#0d6606` | Countdown "ok" text |
| `--navy` | `#000080` | Section headings, primary structural colour |
| `--chakra` | `#06038D` | Ashoka Chakra in the flag |
| `--bg-dark` / `--bg-dark-2` | `#0a1128` / `#101c3d` | Hero, footer, detail hero |
| `--off-white` | `#f5f7fa` | Page background |
| `--text-dark` / `--text-grey` | `#1a2332` / `#5a6b85` | Body / secondary copy |
| `--tricolor` | vertical saffron-white-green gradient | Flag, nav underlines, category tops |
| `--ease-out` | `cubic-bezier(.22,.9,.3,1)` | Reveals, hovers |
| `--focus-ring` | `0 0 0 3px rgba(255,153,51,.38)` | Keyboard focus |

**Base:** `*{margin:0;padding:0;box-sizing:border-box}`, `html{scroll-behavior:smooth}`, body in `'Segoe UI', system-ui, -apple-system, sans-serif`, `.container{width:min(1240px,92%);margin:0 auto}`.

---

## 1. Top tricolor strip

5px tall, horizontal saffron → white → green at 33.3% / 66.6% stops. Pure CSS, no image.

```css
.tricolor-strip{height:5px;background:linear-gradient(90deg,var(--saffron) 0 33.3%,#fff 33.3% 66.6%,var(--green) 66.6% 100%)}
```

---

## 2. Header, nav and buttons

**Header** — sticky at `top:0`, `z-index:100`, translucent white `rgba(255,255,255,.95)` with `backdrop-filter: blur(12px)` and a soft shadow. `.nav-wrap` is a 72px flex row.

**Logo** — 42×28 CSS flag with a 11px Chakra ring drawn as `::after`, `flagWave` keyframes (`rotateY 0→18deg`). Inline brand saffron is overridden to `#a85a00` on the light header for contrast (and `#ffc46b` in the dark footer).

**Nav links** — 0.95rem/600, with a `::after` tricolor underline that grows `width:0 → 100%` on hover; hover colour `--saffron-dark`.

**Buttons** — `.btn` (11px 26px, radius 10, weight 700). `.btn-primary` uses `linear-gradient(135deg, var(--saffron) 0%, var(--green) 160%)` with a warm shadow; hover lifts 2px and deepens the shadow. `.btn-outline` is navy border/text, fills navy on hover.

---

## 3. Hero

The most heavily styled section. Layers, back to front:

1. `.hero` — `#0a1128`, white text, `overflow:hidden`, padding `86px 0 92px`.
2. `.hero-bg` — animated `hero-drift.webp` at `center 42%/cover`, `opacity:.5`.
3. `.hero-bg::after` — **layered spotlight scrim**: radial darkness behind the headline plus a left→right wash.
4. Three `.orb` divs — 80px-blurred saffron/green/blue circles, slow `orbFloat` drift.
5. `.hero-grid` — `5fr / 6fr` grid, flag on the left, copy on the right.

**3D flag** — `.flag-stage{perspective:900px}`; `.wave-flag` is a 3:2 tricolor with a 21% white chakra circle, hard shadow + inset shading, `transform-style:preserve-3d`, `flagWave3D` keyframes. Its `::after` is a diagonal repeating-gradient fabric sheen with `mix-blend-mode:overlay`, contained by `isolation:isolate`. Its `::before` is a 24-spoke `conic-gradient` chakra, masked to a ring with `mask: radial-gradient(#000 0 41%, transparent 41%)`, spinning over 24 s.

**Headline** — `clamp(2.2rem,4.8vw,3.65rem)`, `line-height:1.06`, `letter-spacing:-.045em`, `text-wrap:balance`, two-layer text shadow (tight halo + wide lift).

**Subhead** — `#e3ebfa`, 1.06rem/1.7, `max-width:640px`, `text-wrap:pretty`, two-layer shadow.

**Search** — white pill `radius:14px`, deep shadow, `:focus-within` adds `--focus-ring` to the whole composite control. Input is borderless/outline-free inside it.

**Stats** — three inline stats, 1.5rem bold numbers in warm/cool/tinted colours.

**Entrance** — `.reveal` starts `opacity:0; translateY(28px)`, `riseIn .85s var(--ease-out)`; delay classes `.d1`–`.d5` stagger 0.08→0.62 s.

**Reduced motion** — orbs, reveals and hero background animation are disabled; reveals forced visible.

---

## 4. Deadline ticker

`.ticker-wrap` navy bar, saffron pill label with a `pulse` box-shadow ring. `.ticker` is a `width:max-content` flex row with 56px gaps, `scrollX 32s linear infinite` (translateX 0 → −50%), paused on hover. The viewport clips overflow. Hidden entirely via `[hidden]{display:none}`.

---

## 5. Section heading pattern

`section.block` gets `78px 0` padding. `.section-head` is centred with a 46px bottom margin; h2 is `clamp(1.5rem,3vw,2.1rem)`, `letter-spacing:-.028em`, `line-height:1.15`, `text-wrap:balance`; a 88×5 tricolor `.line` sits beneath it.

---

## 6. Trusted-by ribbon

Two-column grid `1fr / 1.7fr`, gap 34px. Outer card:

- `border:1px solid transparent` + two backgrounds (`linear-gradient(#fff,#fff) padding-box, linear-gradient(120deg, saffron, #e7edf6 38%, green) border-box`) → **gradient hairline border**.
- `radius:20px`, shadow `0 16px 38px rgba(10,17,40,.07)`.
- `::before` tricolor accent line tucked under the top edge.

**Left copy** — green check SVG + "VERIFIED SOURCES" eyebrow (0.7rem, 800, .12em tracking, uppercase). Heading `Trusted by 40+` with the `40+` at `1.32em`, `letter-spacing:-.055em`, colour `#a85a00`. Description `max-width:46ch`. Separate `.trust-link` with underline and a `→` that slides 4px on hover; visible focus ring.

**Right marks panel** — soft radial wash over `#fbfcfe`, centred "OFFICIAL SOURCE MARKS WE FOLLOW" label. `.trust-logos` is a 6-column grid of 76px tiles. Each `.trust-logo`:

- white tile, `radius:12px`, inset highlight, `position:relative`.
- image grayscale(1)/contrast(.96)/opacity .66, height from per-item `--logo-h` (30–45px).
- on hover: tile lifts 3px + shadow, image full colour at scale 1.04, and `::after` wipes a saffron→green 2px hairline across the bottom.

Reduced motion removes all those transitions/transforms. Responsive: one column at ≤1000px, 3 logo columns at ≤640px.

---

## 7. Sourcing method band

Three `.method-card` figures in a 3-column grid (1 column ≤900px). White, `radius:20px`, `overflow:hidden`. A `::before` tricolor 3px bar scales in from the left on hover. `.method-photo` is 16/8 (16/7 on tablet) with `object-fit:cover`; image scales 1.04 on hover. Captions use a `.method-step` eyebrow (0.74rem/800/.09em), a balanced navy title, and grey body copy. Reversed images get a gentle `sourcePhotoDrift` animation, disabled under reduced motion.

---

## 8. Journey / process hero

`.journey-hero-frame` — `min-height:360px`, `radius:22px`, cream `#fff8ee`, top diagram image at `opacity:.2` with a **radial `mask-image` edge fade** (`ellipse 88% 92%`, solid to 52%, transparent at 100%) so it dissolves into the panel. Five `.journey-steps` cards float above (`z-index:1`) in a 5→3→1 column grid, each `rgba(255,255,255,.93)`, numbered navy circle, title and small copy. Mobile bumps the art opacity to .24 to compensate for the mask.

---

## 9. Categories

`.cat-grid` auto-fills 215px columns with 20px gaps. `.cat-card` white, `radius:16px`, tricolor `::before` bar that wipes in on hover, lift −8px with the large shadow on hover. Icon in a 50px gradient tile, count pill in warm saffron.

---

## 10. India map

`.map-section` fades from `#eef3fb` to white. `.map-layout` is `1.2fr / .8fr`. The SVG gets `drop-shadow(0 22px 34px rgba(6,3,141,.22))`; states are `#cfd9ec` with white 0.6 strokes, hover/fill transitions to the tricolour. Small states use magnifier insets. `.state-tip` is a fixed dark tooltip with `backdrop-filter: blur(8px)`. `.pill` chips for popular states lift on hover with saffron border.

---

## 11. Job / result / admit cards

`.jobs-grid` auto-fills 330px columns. `.job-card` white, `radius:16px`, 4px left border whose colour encodes status — green (live), saffron (warn), red (crit), blue (result), purple (admit). Hover lifts 6px with the large shadow. Title clamped to 3 lines with `-webkit-line-clamp`. 44px portal mark (real logo or HSL-derived monogram). Tags and a dashed-top `.dates` row; `.countdown` chips in green / amber / red.

---

## 12. NCS source guide (bento + poster ribbon)

**Section** — radial saffron/green washes over `#f2f5fa`, top/bottom hairlines.

**Bento** — 12-column, 2-row grid. Photo tile spans 7 cols / 2 rows, two cards span 5 cols.

**Photo tile** — `isolation:isolate`, slow Ken Burns drift, two scrim gradients (bottom-heavy dark + tricolor tint), bottom attribution with two-layer text shadow, and a frosted `.source-photo-badge` pill (`backdrop-filter: blur(8px) saturate(1.2)`, hairline border, pulsing saffron dot) reading "NCS portal launch · 2015".

**Cards** — `.source-main-tile` navy gradient with white text; `.source-check-tile` white-to-warm gradient. Uppercase toplines with mini icons, balanced headings, `.source-cta` with lift on hover.

**Poster ribbon** — 3 cards; each `.ncs-ribbon-media` is a 1200/870 framed plate with `object-fit:cover`; image scales 1.05 on hover/focus. Labels stay live HTML below, with a non-affiliation note.

---

## 13. Footer

`#0a1128` with `::before` two soft radial washes (saffron top-left, green top-right). 4-column `.foot-grid` (2fr 1fr 1fr 1fr → 2 columns at ≤1024px). `.foot-bottom` hairline divider, `.foot-strip` 4px tricolor closing bar. Footer logo saffron lightened to `#ffc46b`.

---

## 14. Guides pages (`css/guide.css`)

**Hero** — navy gradient with two radial accent washes, 3px accent bottom border. `::before` is a masked dot grid (22px dots, fades out at 72%); `::after` is the animated `guides-ambient.webp` at `opacity:.15` with `mix-blend-mode:screen`, hidden under reduced motion. Kicker is an accent pill. h1 is `clamp(1.6rem,3.6vw,2.5rem)`, `line-height:1.09`, `letter-spacing:-.03em`, `text-wrap:balance`, `max-width:21ch`. Stat tiles and pictogram chips use translucent white surfaces.

**Cards** — `.g-card` is a 250px-min dark card with `isolation:isolate`; `::before` tricolor/accent top bar; `::after` bottom-heavy gradient + radial highlight at z-index 1; real official logo at top, name/meta/CTA at z-index 2. Name has two-layer text shadow and `text-wrap:balance`. Hover lifts 3px, deepens shadow, scales any art 1.05.

**Diagrams** — content-first HTML/CSS; `.diagram-frame` with step cards; `.g-sector-art` is a framed illustrative figure with a caption below (text never overlaid on the diagram).

---

## 15. Detail pages (`css/detail.css`)

**Hero** — 22px-radius navy panel with saffron/green radial washes, 4px tricolor `::before`, soft shadow. Breadcrumbs use CSS-chevron separators. `.d-ribbon` is a translucent pill with a pulsing status dot (saffron / blue / purple per type). h1 `clamp(1.5rem,3.4vw,2.15rem)`, `max-width:46ch`.

**Facts / timeline / prose** — colour-coded left-border fact cards (deadline, exam, result, vacancy), a vertical milestone timeline with gradient spine, sticky TOC with tricolor markers, FAQ `<details>` items with saffron marker on open, prose h2 markers and external-link arrows.

---

## 16. Responsive map

| Breakpoint | What changes |
|---|---|
| ≤1024px | Hero + map layouts stack; flag moves first; footer 2 columns |
| ≤1000px | Trust ribbon stacks; logos 6 cols; journey steps 3 cols |
| ≤900px | Method grid 1 col; source bento 6/6; NCS ribbon 1 col |
| ≤720px | Nav wraps + scrolls; jobs 1 col; categories 160px min; ticker compact |
| ≤640px | Trust logos 3 cols; source bento 1 col; journey steps 1 col; tighter paddings |

---

## 17. Motion and reduced motion

Motion: ticker marquee, flag wave, chakra spin, orbs, reveals, pulse rings, Ken Burns photo drift, hero/guides animated WebP loops, hover lifts/zooms/wipes.
Reduced motion globally disables orbs/reveals/hero background, the guides ambient layer, NCS zoom, method zoom, source drift/badge pulse, and all trust hover transforms. Nothing depends on motion to convey information.

---

## 18. Accessibility decisions

- Text over imagery always has a scrim and/or two-layer text shadow, never a bare overlay.
- `:focus-within` on the composite search control, plus `focus-visible` on links/cards.
- Official logos and the attributed NCS photo are real assets, never generated.
- Decorative artwork (`hero-bg`, `journey-art`, orbs, flag) is `aria-hidden` or CSS-only.
- Contrast-safe colour overrides for brand saffron on light surfaces (`#a85a00`/`#8a4b00`).
- All interaction states also work with reduced motion and keyboard navigation.
