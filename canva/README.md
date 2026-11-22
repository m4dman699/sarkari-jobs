# Canva export handoff

Canva is the design source; GitHub Actions and the frontend tools are the delivery path.

## Rules

- Export artwork **without text, numbers, dates, fees or logos**. The website adds those as real HTML.
- Use `#FFF8EE` as the base, with saffron `#FF9933`, green `#138808` and navy `#000080` accents.
- Keep subjects centred with generous empty space for HTML labels.
- For full-width process art, work at 1344×768 or larger.
- For card art, keep a 1200×870 landscape ratio.
- Official portal logos must come from `assets/portal-logos/`, never from Canva.

## Steps

1. Put Canva exports in `canva/exports/` as PNG, JPG or WebP.
2. From `frontend-tools/`, run `npm run canva:prepare`.
3. Optimised WebP files appear in `assets/canva/` with a `manifest.json`.
4. Add the image to HTML with real `alt`, `width`, `height`, `loading="lazy"`, and an HTML label beside it.
5. Run `npm run visual:baseline` from `frontend-tools/` so the new design becomes the approved screenshot baseline.
