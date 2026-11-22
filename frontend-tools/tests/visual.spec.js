import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'homepage', url: '/' },
  { name: 'about', url: '/about.html' }
];

for (const { name, url } of pages) {
  test(`${name}: visual baseline and accessibility`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02
    });

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length
      }))
    ).toEqual([]);
  });
}
