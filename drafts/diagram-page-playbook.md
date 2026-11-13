# Diagram-First Guide Pages — Research & Build Playbook

Status: research complete, pattern proven on `drafts/sector-railways.html`
Scope: sector guides, syllabus pages, after-10th / after-12th / after-graduation pillars
Constraint: no JS libraries, no invented data, must stay indexable

---

## 1. Why the current demo diagrams look bad (measured, not guessed)

The demo `drafts/sector-diagram-demo.html` uses one `<svg viewBox="0 0 900 500">`.
An SVG with a `viewBox` is a **picture that scales**. Its text is drawn in *user
units*, so when the picture shrinks to fit a phone, the text shrinks with it.

Measured rendered label size in the actual demo:

| Container width | Scale | Title text | Subtitle text | Diagram height |
|---|---|---|---|---|
| 928 px (desktop) | 1.031 | 13.4 px ✅ | 10.8 px ⚠️ | 516 px |
| 700 px (tablet) | 0.778 | 10.1 px ⚠️ | 8.2 px ❌ | 389 px |
| 480 px | 0.533 | 6.9 px ❌ | 5.6 px ❌ | 267 px |
| 360 px (phone) | 0.400 | **5.2 px** ❌ | **4.2 px** ❌ | 200 px |
| 328 px (small phone) | 0.364 | **4.7 px** ❌ | **3.8 px** ❌ | 182 px |

Body text needs ≥ 16 px; supporting labels ≥ 13 px. **At phone width every label
in that diagram is unreadable.** That is the entire problem. It is not styling.

Three compounding causes:

1. **Scaling** — `viewBox` text scales with the picture (table above).
2. **Emoji pictographs** — `🛡 📄 🚆 👮` inside `<text>` render as OS colour
   glyphs. They ignore `fill`, have different metrics per platform, sit off the
   text baseline, and cannot be sized or recoloured. They look like stickers
   dropped into a diagram, not part of it.
3. **Fixed coordinates** — every box is a hand-placed `x`/`y`. Adding a word
   breaks the layout, and there is no reflow.

### The fix, in one line

> **Put the text in HTML. Put the shapes in SVG/CSS.**

HTML text is responsive, selectable, translatable, screen-reader friendly and
indexable. CSS connectors, gradients and icons give the visual structure.
Neither has to scale as a picture.

---

## 2. Rendering stack — decision matrix

| Approach | Text indexable | Text responsive | A11y | Weight | Animation | Authoring | Verdict |
|---|---|---|---|---|---|---|---|
| **HTML nodes + CSS connectors** | ✅ real DOM | ✅ | ✅ | ~2 KB | ✅ CSS | easy | **primary** |
| **Inline SVG (shapes/icons only)** | ✅ (text too, if present) | n/a | ✅ | 1–4 KB | ✅ CSS | medium | **secondary** |
| `<img src="diagram.svg">` | ❌ text not in DOM | ❌ scales as image | alt only | 2–6 KB | ✅ (SMIL/CSS inside) | easy | avoid for content |
| CSS `background-image: url(svg)` | ❌ **not indexed at all** | ❌ | ❌ | — | ✅ | easy | **never for content** |
| `<canvas>` / WebGL | ❌ | ❌ | ❌ | ~0 | ✅ JS | hard | reject |
| Lottie / Rive | ❌ | ❌ | ❌ | 40–200 KB + runtime | ✅ | hard | reject |
| AI-generated raster | ❌ (garbled) | ❌ | alt only | 200–800 KB | ❌ | cheap | hero art only, no text |
| Mermaid → pre-rendered SVG | ⚠️ text present but tiny/unstyled | ❌ | ⚠️ | 5–30 KB | ❌ | build step + headless Chrome | reject (dependency) |
| Rough.js / D3 | ❌ canvas/svg via JS | ⚠️ | ❌ | 30–90 KB | ✅ | hard | reject |

**Decision:** HTML+CSS for anything carrying words. Inline SVG only for icon
glyphs, connectors, gradients and decorative shapes.

Google's own docs confirm the asymmetry: images are discovered through `<img src>`
and are indexed as images, while **CSS background images are ignored entirely**
and inline SVG text is ordinary DOM text.

---

## 3. The five diagram archetypes and how each is built

Every diagram in a sector guide is one of these. None needs a `viewBox` with text.

### 3.1 Flow / pipeline → CSS stepper
Numbered nodes in a grid, with the connecting line drawn by a pseudo-element on
the container (not between items — that is what breaks on wrap).

```css
.flow { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); position: relative; }
.flow::before {                     /* the rail */
  content: ''; position: absolute; left: 24px; right: 24px; top: 26px;
  height: 2px; background: linear-gradient(90deg, #FF9933, #138808); opacity: .35;
}
.flow-node { position: relative; text-align: center; }
.flow-num {                         /* sits on the rail, hides it behind itself */
  width: 52px; height: 52px; margin: 0 auto; border-radius: 50%;
  background: #fff; border: 2px solid var(--accent);
  display: grid; place-items: center; position: relative; z-index: 1;
}
@media (max-width: 560px) {
  .flow { grid-template-columns: 1fr; }
  .flow::before { left: 26px; right: auto; top: 26px; bottom: 26px; width: 2px; height: auto; }
  .flow-node { display: grid; grid-template-columns: 52px 1fr; gap: 14px; text-align: left; }
  .flow-num { margin: 0; }
}
```

Mobile becomes a vertical rail automatically. Text stays 16 px because it is HTML.

### 3.2 Hub / sector map → CSS grid with a centre cell
A 3×3 grid; the centre cell is the hub. Works at every width, no coordinates.

```css
.hubmap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.hubmap-centre { grid-area: 2 / 2; border-radius: 50%; aspect-ratio: 1; display: grid; place-items: center; }
@media (max-width: 620px) { .hubmap { grid-template-columns: repeat(2, 1fr); } .hubmap-centre { grid-area: auto; border-radius: 16px; aspect-ratio: auto; } }
```

### 3.3 Ladder / progression → ordered list with a spine
A vertical spine drawn with `::before` on the `<ol>`; each step offsets to the
right by an increasing amount on desktop, flat on mobile.

### 3.4 Matrix (qualification × post) → CSS grid of cards
Each qualification is a column on desktop, a stacked card on mobile. Posts are
chips. This is the highest-value diagram on the page — it answers "can I apply?"
in one glance.

### 3.5 Comparison / ranking → HTML table styled as a visual grid
Real `<table>` for semantics, `display: grid` on the rows for layout. Screen
readers keep the table structure; sighted users see a card grid.

---

## 4. Interaction without JavaScript

| Pattern | Mechanism | Use for |
|---|---|---|
| Expand a node | `<details><summary>` | post details, exam stages, FAQ |
| Deep-link a state | `:target` on an element with `id` | "open this stage" links |
| Highlight a sibling | `:has()` on the container | dim others when one is focused |
| Filter chips | radio + `:checked` | **avoid** — poor a11y, no keyboard semantics |

`<details>` content is **always in the DOM**, so it is always crawlable — unlike
a JS accordion that injects nodes on click. Zero JS, native keyboard support,
`Ctrl+F` finds collapsed text in Chrome and Firefox.

Rule: never put essential content behind `display:none`. Collapsed is fine;
absent is not.

---

## 5. Animation rules

1. **Entrance stagger** — `animation-delay` per child, 60–80 ms apart, total
   sequence ≤ 900 ms. Longer feels broken.
2. **Scroll-driven** — `animation-timeline: view()` is baseline (Chrome/Edge 115+,
   Firefox 159+, Safari 26+). Use it only for *decorative* reveal; the content
   must be visible without it.
3. **`prefers-reduced-motion: reduce`** — mandatory. Set `animation: none` and
   reset the final state, e.g. `stroke-dashoffset: 0`, `opacity: 1`,
   `transform: none`.
4. **Never start at `opacity: 0` and rely on an animation to reveal it.** If the
   animation never runs (reduced motion, old browser, CSS blocked), the content
   is invisible. Either animate *from* a visible state, or pair every
   `opacity: 0` with a `@media (prefers-reduced-motion: reduce) { opacity: 1 }`
   override **and** `animation-fill-mode: forwards`.
5. **SVG line-draw** — `stroke-dasharray` + `stroke-dashoffset` only on
   connectors, never on anything carrying meaning.

---

## 6. Accessibility

- `role="img"` on an SVG **hides all its children from assistive tech**. Never
  put `role="img"` on a diagram containing links, buttons or `<details>`.
- For a purely decorative shape: `aria-hidden="true"`.
- For an informative SVG: `<title>` + `<desc>`, referenced by
  `aria-labelledby="t d"` — and keep a real text equivalent nearby anyway.
- Contrast: body text ≥ 4.5:1, large text ≥ 3:1. The site's `#5b6b8f` on white is
  ~5.1:1 ✅; `#b9c6e2` on `#0a1128` is ~9.4:1 ✅.
- Icon-only buttons need an accessible name. Icon + visible label needs
  `aria-hidden="true"` on the icon.
- Focus ring must survive the new components — do not set `outline: none`.

---

## 7. SEO mechanics that actually matter here

| Fact | Consequence |
|---|---|
| Inline SVG text is DOM text | Labels inside inline SVG are indexable |
| `<img src="x.svg">` text is **not** in the DOM | Never use for label-bearing diagrams |
| CSS `background-image` is **not indexed** | Never put content in a background |
| Inline `<svg>` is **not an LCP candidate** (web.dev) | A large inline SVG hero costs no LCP |
| `<img>` and CSS `background-image` **are** LCP candidates | Keep photo heroes small and preloaded |
| Social platforms do not render SVG | `og:image` must be PNG/JPEG, 1200×630 |

Page-level schema for a sector guide: `Article` (or `WebPage`) +
`BreadcrumbList` + `FAQPage` when ≥ 2 real Q&As. Do **not** use `HowTo` for
"how to apply" — it implies step-by-step instructions we do not own.

Internal links from diagrams must be real `<a href>` elements. A `<div onclick>`
passes no equity and is invisible to crawlers.

---

## 8. Images — what is legal and what is worth the bytes

| Source | Licence | Attribution | Use |
|---|---|---|---|
| **AI-generated** (this toolchain) | ours | none | hero art, sector illustration — **no text in image** |
| **Lucide icons** | ISC | keep `LICENSE` notice | inline icon glyphs ✅ |
| Phosphor / Tabler / Heroicons | MIT | notice | inline icon glyphs ✅ |
| Unsplash / Pexels | free commercial | not required | photos, but generic |
| Wikimedia Commons | varies (often CC BY-SA) | **required**, share-alike risk | avoid |
| Google Images | ✗ | — | **never** |

Hard rules:
- Never hotlink an image from another domain (breaks, and it is not ours).
- Every `<img>` needs `width`, `height`, `alt`, `loading="lazy"` (except the LCP
  image, which gets `fetchpriority="high"` and no lazy).
- Serve WebP/AVIF; hero ≤ 120 KB, inline content images ≤ 60 KB.
- AI images **must not contain text** — models garble glyphs. Icon + label
  belongs in HTML on top of or beside the image.

---

## 9. Weight budget

Current production numbers:

| Asset | Size |
|---|---|
| a detail page (`job-details/*/index.html`) | 13.0 KB |
| `css/style.css` | 30.9 KB |
| `css/detail.css` | 16.9 KB |

Budget for a guide page:

| Item | Budget |
|---|---|
| HTML (all content + inline SVG icons) | ≤ 70 KB |
| New CSS (`css/guide.css`) | ≤ 24 KB |
| Hero image (if used) | ≤ 120 KB WebP |
| Icons | inline, ~200–400 B each |
| JS | **0 KB** |

Inline SVG icons are the cheapest visual upgrade available: ~300 B per icon
versus ~40 KB for an icon font, and they inherit `currentColor`.

---

## 10. "More visual than text" — how to prove it

Counting words is easy; counting *visuals* needs a definition. Use this:

> A **visual block** is a diagram, stepper, matrix, ladder, icon-card grid,
> table, or image that communicates structure without requiring the reader to
> read a paragraph.

Targets:
- **≥ 1 visual block per 120 words of prose**
- **no prose block longer than 90 words** without a visual adjacent
- **every `<h2>` section contains at least one visual block**
- first visual appears **above the fold**

Verification is automated in `drafts/check-visual-density.js` — it counts prose
words outside visual containers and the number of visual blocks, then fails the
build if a threshold is missed.

---

## 11. Authoring workflow

The detail pages are already generated by `scraper/build-detail-pages.js` from
`data/jobs.json`. Sector guides should follow the same shape:

```
drafts/sectors/railways.json      ← content model (posts, stages, FAQ, links)
        ↓
scraper/build-sector-pages.js     ← template + live listings + schema
        ↓
guides/railways/index.html        ← static, crawlable, in sitemap
```

Content model per sector (all authored, none invented):

```json
{
  "slug": "railways",
  "name": "Railways",
  "icon": "train-front",
  "accent": "#FF9933",
  "categoryMatch": ["Railways"],
  "stats": [{ "value": "18", "label": "Railway zones" }],
  "levels": [{ "level": "10th", "posts": ["Group D"], "note": "..." }],
  "stages": [{ "name": "CBT 1", "tests": "...", "note": "..." }],
  "ladder": ["Technician", "Senior Technician", "Junior Engineer"],
  "reality": ["...", "..."],
  "faq": [{ "q": "...", "a": "..." }]
}
```

Anything that varies by notification (dates, fees, vacancy counts, age limits)
is **pulled from `jobs.json` at build time**, never typed into the content model.
Where a source is silent, the field is omitted rather than estimated.

---

## 12. Verification checklist (run before any publish)

- [ ] No `viewBox` text below 13 px at 360 px viewport
- [ ] Every `<svg>` has either `aria-hidden="true"` or `title`+`desc`
- [ ] `role="img"` appears on no interactive diagram
- [ ] `prefers-reduced-motion` override present and resets final state
- [ ] Visual density thresholds pass
- [ ] No `<img>` without `width`/`height`/`alt`
- [ ] `og:image` is raster, 1200×630, absolute URL
- [ ] `FAQPage` JSON-LD matches the visible questions exactly
- [ ] Every diagram link is a real `<a href>`
- [ ] Page renders with CSS disabled (content order still makes sense)
- [ ] Mobile: no horizontal overflow
- [ ] Lighthouse: a11y ≥ 95, SEO ≥ 95

---

## 13. What this changes about the original plan

The earlier plan assumed "3–5 inline SVG diagrams per page". That was wrong for
mobile. Revised:

| Old plan | New plan |
|---|---|
| One 900×500 SVG sector map | CSS hub grid — reflows, text never scales |
| Emoji pictographs | Lucide inline icon paths |
| Diagram = `<svg role="img">` | Diagram = HTML structure + CSS connectors + inline icon SVG |
| 3–5 big SVGs per page | 6–8 HTML visual blocks per page + 1 small SVG accent |
| Prose explains the diagram | Diagram *is* the section; prose is a 1–2 sentence caption |

Same animation budget, same zero-JS rule, better result at 360 px.
