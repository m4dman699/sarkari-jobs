import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const inputDir = path.join(root, 'canva', 'exports');
const outputDir = path.join(root, 'assets', 'canva');

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const images = entries.filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name));

  if (images.length === 0) {
    console.log('No Canva exports found in canva/exports/. Add PNG, JPG or WebP files there first.');
    return;
  }

  const manifest = [];

  for (const entry of images) {
    const source = path.join(inputDir, entry.name);
    const stem = path.parse(entry.name).name.replace(/\s+/g, '-').toLowerCase();
    const destination = path.join(outputDir, `${stem}.webp`);

    const info = await sharp(source)
      .rotate()
      .resize({ width: 1344, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destination);

    manifest.push({
      source: `canva/exports/${entry.name}`,
      output: `assets/canva/${stem}.webp`,
      width: info.width,
      height: info.height
    });
    console.log(`${entry.name} -> assets/canva/${stem}.webp (${info.width}x${info.height})`);
  }

  await fs.writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), items: manifest }, null, 2)}\n`
  );
  console.log(`Wrote ${manifest.length} optimized asset(s) and assets/canva/manifest.json.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
