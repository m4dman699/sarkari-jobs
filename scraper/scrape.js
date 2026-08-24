/**
 * SarkariJobs+ free scraper
 * Run: node scrape.js
 * Output: ../data/jobs.json  (consumed by the website)
 *
 * Runs anywhere Node 18+ runs — locally, or free on GitHub Actions cron.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchPage, extractJobs, SOURCES, STATE_SOURCES, classifyJob } = require('./sources');

const OUT = path.join(__dirname, '..', 'data', 'jobs.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const all = [];
  const errors = [];

  for (const src of SOURCES) {
    for (const url of src.urls) {
      try {
        process.stdout.write(`→ ${src.name} [${url}] ... `);
        const html = await fetchPage(url);
        const $ = cheerio.load(html);
        const jobs = extractJobs($, url, src.name, src.category, src.state);
        all.push(...jobs);
        console.log(`${jobs.length} jobs`);
      } catch (err) {
        console.log(`FAILED (${err.message})`);
        errors.push({ source: src.name, url, error: err.message });
      }
      await sleep(1500); // be polite to govt servers
    }
  }

  // Deduplicate by id (link hash), keep first; classify generic categories
  const seen = new Set();
  const unique = all
    .map(classifyJob)
    .filter(j => !seen.has(j.id) && seen.add(j.id));

  // Sort: soonest closing first (undated sink to bottom)
  unique.sort((a, b) =>
    String(a.lastDate || '9999-99-99').localeCompare(String(b.lastDate || '9999-99-99'))
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    total: unique.length,
    errors,
    jobs: unique
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

  // Per-state files consumed by state.html pages
  const statesDir = path.join(__dirname, '..', 'data', 'states');
  fs.mkdirSync(statesDir, { recursive: true });
  let stateFileCount = 0;
  for (const src of STATE_SOURCES) {
    const own = unique.filter(j => j.state === src.state);
    if (!own.length) continue;
    fs.writeFileSync(
      path.join(statesDir, `${src.slug}.json`),
      JSON.stringify({ generatedAt: payload.generatedAt, total: own.length, jobs: own }, null, 2)
    );
    stateFileCount++;
  }

  console.log(`\n✅ ${unique.length} unique jobs saved → data/jobs.json`);
  console.log(`✅ ${stateFileCount} per-state files saved → data/states/*.json`);
  if (errors.length) console.log(`⚠️  ${errors.length} source errors (see errors field in JSON)`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
