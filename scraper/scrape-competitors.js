const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.join(__dirname, '..');
const FEED = path.join(ROOT, 'data', 'jobs.json');
const DETAIL_CACHE = path.join(__dirname, 'competitor-detail-cache.json');
const SOURCE = 'https://sarkariresult.com.cm';
const SECTIONS = [
  { type: 'job', url: `${SOURCE}/LATEST-JOBS/`, max: 30 },
  { type: 'admit-card', url: `${SOURCE}/ADMIT-CARD/`, max: 25 },
  { type: 'result', url: `${SOURCE}/RESULT/`, max: 25 }
];

function parseDate(text) {
  const match = String(text).match(/(?:last\s*date\s*:\s*)?(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})/i);
  if (!match) return null;
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month = months.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
}

function normalizeTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function plain(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

async function enrichListing(item) {
  const $ = cheerio.load(await fetchHTML(item.link));
  const body = plain($('main').text() || $('article').text() || $('body').text());
  const intro = $('h1').first().nextAll('p').filter((_, node) => plain($(node).text()).length > 70).first();
  const summary = plain(intro.text()).slice(0, 420);
  const dateMatch = body.match(/Post\s*Date\s*:\s*([A-Za-z]+\s+\d{1,2},?\s+20\d{2})/i);
  const publishedDate = dateMatch ? new Date(dateMatch[1]).toISOString().slice(0, 10) : null;
  const openMatch = body.match(/application form has started on\s+(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i);
  const openDate = openMatch ? parseDate(openMatch[1]) : null;
  const ageMatch = body.match(/minimum age is\s+(\d+)\s*years?.{0,100}?maximum age is\s+(\d+)\s*years?/i);
  const vacancyMatch = body.match(/(?:recruitment is for|total post)\s*([\d,]+)\s*(?:positions?|posts?)/i);
  const examMatch = body.match(/exam date\s*:\s*(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i);
  let eligibility = '';
  $('h1, h2, h3, h4, th, strong').each((_, node) => {
    if (eligibility || !/eligibility/i.test(plain($(node).text()))) return;
    const section = $(node).closest('tr').next('tr').text() || $(node).parent().next().text() || $(node).parent().text();
    eligibility = plain(section).replace(/Eligibility Criteria/ig, '').slice(0, 500);
  });
  let applicationFee = '';
  $('h2, h3, h4, strong').each((_, node) => {
    if (applicationFee || !/application fee/i.test(plain($(node).text()))) return;
    applicationFee = plain($(node).parent().next().text() || $(node).closest('section').text()).slice(0, 350);
  });
  const official = [];
  $('a[href]').each((_, node) => {
    try {
      const url = new URL($(node).attr('href'), item.link);
      if (/\.(?:gov\.in|nic\.in)$/i.test(url.hostname) && url.hostname !== 'sarkariresult.com.cm') {
        official.push({ url: url.href, label: plain($(node).text()) });
      }
    } catch { /* Ignore malformed external links. */ }
  });
  const preferred = official.find(link => /apply|application|official website|notification|advertisement/i.test(link.label)) || official[0];
  const notification = official.find(link => /notification|advertisement/i.test(link.label));
  return {
    ...(summary ? { detail: summary } : {}),
    ...(publishedDate ? { publishedDate } : {}),
    ...(openDate ? { openDate } : {}),
    ...(ageMatch ? { ageLimit: `${ageMatch[1]}–${ageMatch[2]} years` } : {}),
    ...(vacancyMatch ? { vacancies: vacancyMatch[1] } : {}),
    ...(examMatch ? { examDate: parseDate(examMatch[1]) } : {}),
    ...(eligibility ? { eligibility } : {}),
    ...(applicationFee ? { applicationFee } : {}),
    ...(preferred ? { officialLink: preferred.url } : {}),
    ...(notification ? { notificationLink: notification.url } : {})
  };
}

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'SarkariJobsPlusFeed/1.0 (+https://sarkarijobsplus.com)', accept: 'text/html' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(FEED, 'utf8'));
  const cache = fs.existsSync(DETAIL_CACHE) ? JSON.parse(fs.readFileSync(DETAIL_CACHE, 'utf8')) : {};
  const byId = new Map((payload.jobs || []).map(item => [item.id, item]));
  const byTitle = new Map((payload.jobs || []).map(item => [normalizeTitle(item.title), item]));
  let imported = 0;
  const errors = [];
  const now = new Date();

  for (const section of SECTIONS) {
    try {
      const $ = cheerio.load(await fetchHTML(section.url));
      const candidates = [];
      $('a[href]').each((_, node) => {
        const link = new URL($(node).attr('href'), section.url);
        const title = $(node).text().replace(/\s+/g, ' ').trim();
        if (link.origin !== SOURCE || !title || title.length < 12 || /^\/(?:LATEST-JOBS|ADMIT-CARD|RESULT)\/?$/i.test(link.pathname)) return;
        const context = $(node).closest('li').text().replace(/\s+/g, ' ').trim() || $(node).parent().text().replace(/\s+/g, ' ').trim();
        const lastDate = section.type === 'job' ? parseDate(`${title} ${context}`) : null;
        if (section.type === 'job' && (!lastDate || new Date(`${lastDate}T23:59:59Z`) < now)) return;
        candidates.push({ title, link: link.href, lastDate });
      });

      const seen = new Set();
      const unique = candidates.filter(item => !seen.has(item.link) && seen.add(item.link)).slice(0, section.max);
      for (const item of unique) {
        if (section.type === 'result' && /\bCDS\b/i.test(item.title)) continue;
        const id = `competitor-sarkariresult-${Buffer.from(item.link).toString('base64url').slice(-48)}`;
        const existing = byId.get(id) || byTitle.get(normalizeTitle(item.title));
        if (existing) {
          if (item.lastDate && !existing.lastDate) existing.lastDate = item.lastDate;
          if (!existing.discoveredVia) existing.discoveredVia = section.url;
          if (existing.publisher !== 'SarkariResult.com.cm') continue;
          Object.assign(existing, cache[item.link]?.details || {});
          existing.link = item.link;
          continue;
        }
        const listing = {
          id,
          type: section.type,
          title: item.title,
          source: 'SarkariResult.com.cm listing (recruiting authority named in title/notice)',
          publisher: 'SarkariResult.com.cm',
          category: section.type === 'job' ? 'Government jobs' : section.type === 'admit-card' ? 'Admit cards' : 'Results',
          state: 'See linked notice',
          link: item.link,
          ...(item.lastDate ? { lastDate: item.lastDate } : {}),
          discoveredVia: section.url
        };
        byId.set(id, listing);
        imported++;
      }
      console.log(`${section.type}: parsed ${candidates.length} links; retained ${unique.length};`);
    } catch (error) {
      errors.push({ source: 'SarkariResult.com.cm', url: section.url, error: error.message });
      console.warn(`${section.type}: ${error.message}`);
    }
  }

  const candidates = [...byId.values()].filter(item =>
    item.publisher === 'SarkariResult.com.cm' && !cache[item.link]
  );
  let next = 0;
  async function detailWorker() {
    while (next < candidates.length) {
      const item = candidates[next++];
      try {
        cache[item.link] = { attemptedAt: new Date().toISOString(), details: await enrichListing(item) };
        Object.assign(item, cache[item.link].details);
      } catch (error) {
        cache[item.link] = { attemptedAt: new Date().toISOString(), error: error.message, details: {} };
      }
    }
  }
  await Promise.all(Array.from({ length: 3 }, detailWorker));
  fs.writeFileSync(DETAIL_CACHE, JSON.stringify(cache, null, 2) + '\n');

  // Keep the competitor scrape focused on the broad feed; the existing CDS guide is a page template.
  for (const [id, item] of byId) {
    if (item.publisher === 'SarkariResult.com.cm' && /\bCDS\b/i.test(item.title || '')) byId.delete(id);
  }

  if (imported || candidates.length) {
    payload.jobs = [...byId.values()].sort((a, b) => String(a.lastDate || '9999-99-99').localeCompare(String(b.lastDate || '9999-99-99')));
    payload.total = payload.jobs.length;
    payload.generatedAt = new Date().toISOString();
    payload.quality.jobsMissingPublicationDate = payload.jobs.filter(item => item.type === 'job' && !item.publishedDate && !item.openDate).length;
    payload.quality.jobsMissingClosingDate = payload.jobs.filter(item => item.type === 'job' && !item.lastDate).length;
    payload.errors = [...(payload.errors || []).filter(item => item.source !== 'SarkariResult.com.cm'), ...errors];
    fs.writeFileSync(FEED, JSON.stringify(payload, null, 2) + '\n');
  }
  console.log(`Imported ${imported} new competitor listings; ${payload.jobs.length} total feed records.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
