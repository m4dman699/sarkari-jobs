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
const { fetchPage, extractJobs, extractMeghalayaJobs, extractEmploymentNewsJobs, extractISROJobs, extractPuducherryJobs, SOURCES, STATE_SOURCES, classifyJob, isStale, isGenericJobTitle } = require('./sources');

const OUT = path.join(__dirname, '..', 'data', 'jobs.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CONCURRENCY = 4;

async function main() {
  const all = [];
  const errors = [];
  const announcementsBySource = new Map();

  const tasks = SOURCES.flatMap(src => src.urls.map(url => ({ src, url })));
  let nextTask = 0;
  async function fetchWithRetry(url, attempts = 3) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await fetchPage(url);
      } catch (err) {
        lastError = err;
        if (attempt < attempts - 1) await sleep(2000 * (attempt + 1));
      }
    }
    throw lastError;
  }
  async function worker() {
    while (nextTask < tasks.length) {
      const { src, url } = tasks[nextTask++];
      try {
        process.stdout.write(`→ ${src.name} [${url}] ... `);
        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);
        const parser = {
          meghalaya: extractMeghalayaJobs,
          'employment-news': extractEmploymentNewsJobs,
          isro: extractISROJobs,
          puducherry: extractPuducherryJobs
        }[src.slug];
        const announcements = parser
          ? parser($, url, src.name, src.category, src.state)
          : extractJobs($, url, src.name, src.category, src.state);
        all.push(...announcements);
        announcementsBySource.set(src.name, (announcementsBySource.get(src.name) || 0) + announcements.length);
        console.log(`${announcements.length} links`);
      } catch (err) {
        console.log(`FAILED (${err.message})`);
        errors.push({ source: src.name, url, error: err.message });
      }
      await sleep(1200); // keep each worker's request rate modest
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Deduplicate by id (link hash), keep first; classify generic categories
  const seen = new Set();
  let unique = all
    .map(classifyJob)
    .filter(j => !seen.has(j.id) && seen.add(j.id));

  // Keep the public job feed focused on applications that are still open.
  unique = unique.filter(item => item.type !== 'job' || !isStale(item.title, item.lastDate, item.publishedDate));

  // Curated competitor links survive daily scrapes when government portals
  // are blocked or their page layouts change.
  const curatedPath = path.join(__dirname, 'competitor-listings.json');
  try {
    const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));
    if (Array.isArray(curated)) {
      const byId = new Map(unique.map(item => [item.id, item]));
      for (const item of curated) {
        if (item?.id && item?.link && (item.type !== 'job' || !isStale(item.title, item.lastDate, item.publishedDate))) {
          byId.set(item.id, item);
        }
      }
      unique = [...byId.values()];
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Could not read ${curatedPath}: ${err.message}`);
  }

  // Sort: soonest closing first (undated sink to bottom)
  unique.sort((a, b) =>
    String(a.lastDate || '9999-99-99').localeCompare(String(b.lastDate || '9999-99-99'))
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* first run */ }
  if (unique.length === 0) {
    console.error('\nNo official announcements were extracted; keeping the existing feed unchanged.');
    process.exitCode = 1;
    return;
  }
  const freshJobs = unique.some(item => !item.type || item.type === 'job');
  if (Array.isArray(previous?.jobs)) {
    // A portal returning no matching announcements often means its page layout changed.
    // Keep that portal's last known records until a later scrape can replace them.
    const uncertainSources = new Set(errors.map(error => error.source));
    for (const source of SOURCES.map(item => item.name)) {
      if (!announcementsBySource.get(source)) uncertainSources.add(source);
    }
    const ids = new Set(unique.map(item => item.id));
    const retained = previous.jobs.filter(item =>
      uncertainSources.has(item.source) &&
      item.link && !/\/undefined(?:$|[?#])|\/#(?:$|[?#])|megrecruitment\.nic\.in/i.test(item.link) &&
      !/\{\{.*\}\}|\brti\b|right to information|reporting vacancies/i.test(item.title || '') &&
      !/^(?:notifications?|what'?s new|latest news|announcements?|recruitment|results?|admit cards?)$/i.test(item.title || '') &&
      !isStale(item.title || '', item.lastDate, item.publishedDate) &&
      !isGenericJobTitle(item.title || '') &&
      !ids.has(item.id)
    );
    unique.push(...retained);
    if (retained.length) console.warn(`Preserved ${retained.length} prior records from sources that failed or returned no matches.`);
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    jobsGeneratedAt: freshJobs ? generatedAt : (previous?.jobsGeneratedAt || previous?.generatedAt || null),
    partial: errors.length > 0 || !freshJobs,
    total: unique.length,
    quality: {
      jobsMissingPublicationDate: unique.filter(item => item.type === 'job' && !item.publishedDate && !item.openDate).length,
      jobsMissingClosingDate: unique.filter(item => item.type === 'job' && !item.lastDate).length,
      genericNavigationItems: unique.filter(item => isGenericJobTitle(item.title)).length
    },
    errors,
    jobs: unique
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

  // Per-state files consumed by state.html pages
  const statesDir = path.join(__dirname, '..', 'data', 'states');
  fs.mkdirSync(statesDir, { recursive: true });
  let stateFileCount = 0;
  for (const slug of new Set(STATE_SOURCES.map(src => src.slug))) {
    const stateName = STATE_SOURCES.find(src => src.slug === slug)?.state;
    const own = unique.filter(j => j.state === stateName && (!j.type || j.type === 'job'));
    fs.writeFileSync(
      path.join(statesDir, `${slug}.json`),
      JSON.stringify({ generatedAt: payload.generatedAt, total: own.length, jobs: own }, null, 2)
    );
    stateFileCount++;
  }

  console.log(`\n✅ ${unique.length} unique announcements saved → data/jobs.json`);
  console.log(`ℹ️  Job date gaps: ${payload.quality.jobsMissingPublicationDate} missing issue/open date; ${payload.quality.jobsMissingClosingDate} missing closing date.`);
  console.log(`✅ ${stateFileCount} per-state files saved → data/states/*.json`);
  if (errors.length) console.log(`⚠️  ${errors.length} source errors (see errors field in JSON)`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
