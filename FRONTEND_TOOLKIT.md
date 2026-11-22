# Frontend toolkit and visual guardrails

SarkariJobs+ is a static site, so the frontend stack stays deliberately light: no bundler, no runtime framework, and no paid service. The tools below are development/CI checks. They are documented individually in [`frontend-tools/README.md`](frontend-tools/README.md).

| Tool | GitHub source | Connected through | Guards |
| --- | --- | --- | --- |
| Lighthouse CI | https://github.com/GoogleChrome/lighthouse-ci | `frontend-tools/lighthouserc.json`, `.github/workflows/frontend-checks.yml` | Performance, accessibility, best practices, SEO |
| Stylelint | https://github.com/stylelint/stylelint | `frontend-tools/stylelint.config.json`, `npm run check:css` | CSS validity and consistency |
| html-validate | https://github.com/html-validate/html-validate | `frontend-tools/htmlvalidate.json`, `npm run check:html` | HTML structure |
| ESLint | https://github.com/eslint/eslint | `eslint.config.mjs`, `npm run check:js` | JavaScript errors |
| Prettier | https://github.com/prettier/prettier | `frontend-tools/.prettierrc.json`, `npm run check:format` | Toolkit file formatting |
| axe-core + Playwright | https://github.com/dequelabs/axe-core, https://github.com/microsoft/playwright | `frontend-tools/tests/visual.spec.js` | Visual regression and WCAG A/AA |
| Sharp | https://github.com/lovell/sharp | `frontend-tools/scripts/prepare-canva-assets.js` | Canva export optimisation |

AOS (https://github.com/michalsnik/aos) and Lucide (https://github.com/lucide-icons/lucide) were also reviewed in Chrome. They are **not enabled**: the site already has CSS reveal motion and hand-drawn icons, and adding them would increase runtime weight without improving source accuracy.

## Canva workflow

1. Design in Canva with a warm off-white `#FFF8EE` background and saffron/green/navy accents.
2. Do not type labels or paste logos into the artwork. Leave clean space where the website can place real HTML text.
3. Export PNG or JPG into `canva/exports/`.
4. Run `npm run canva:prepare` from `frontend-tools/`.
5. Reference the resulting WebP from `assets/canva/` in HTML with explicit `width`, `height`, `loading="lazy"` and a descriptive `alt`.

This keeps every label selectable and every source attribution visible, which is the whole point of the content-first visuals.
