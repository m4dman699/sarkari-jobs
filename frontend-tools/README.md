# Frontend tools

This folder is the local quality gate for the static SarkariJobs+ site. It is not deployed to Hostinger; the deploy workflow stages only public site files.

## Tools researched in real Chrome

| GitHub project                                                                | What it does here                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci)   | Scores performance, accessibility, best practices and SEO on every push. |
| [stylelint/stylelint](https://github.com/stylelint/stylelint)                 | Guards CSS against invalid values, empty blocks and duplicate selectors. |
| [html-validate/html-validate](https://github.com/html-validate/html-validate) | Checks the hand-maintained HTML pages for structural mistakes.           |
| [eslint/eslint](https://github.com/eslint/eslint)                             | Checks site JavaScript for real errors (root `eslint.config.mjs`).       |
| [prettier/prettier](https://github.com/prettier/prettier)                     | Keeps this toolkit's own config and scripts formatted.                   |
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core)                   | Runs WCAG A/AA checks inside the Playwright visual test.                 |
| [microsoft/playwright](https://github.com/microsoft/playwright)               | Drives the user's installed Chrome for visual-regression screenshots.    |
| [lovell/sharp](https://github.com/lovell/sharp)                               | Converts Canva exports into lightweight WebP assets.                     |

## Commands

Run these from this folder with Node.js 20+:

```powershell
npm ci
npm run check
npm run audit
npm run visual:check
npm run visual:baseline
npm run canva:prepare
```

- `check` runs CSS, HTML, JavaScript and toolkit formatting checks.
- `audit` starts Lighthouse CI against the local site and writes reports to `.lighthouseci/`.
- `visual:check` compares Chrome screenshots with the committed baselines and runs axe.
- `visual:baseline` refreshes baselines after an intentional design change.
- `canva:prepare` optimizes files from `canva/exports/` into `assets/canva/`.

Playwright uses `channel: 'chrome'` locally, so it uses the real Chrome on this computer. In CI it uses the Chrome installed by `browser-actions/setup-chrome`.

## Canva handoff

See [`../canva/README.md`](../canva/README.md). Canva should export artwork with **no baked-in text or logos**; the website supplies labels as real HTML so they stay selectable, translatable and accessible.
