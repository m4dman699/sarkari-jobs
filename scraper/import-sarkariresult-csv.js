const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { enrichListing, normalizeTitle } = require('./scrape-competitors');

const ROOT = path.join(__dirname, '..');
const FEED = path.join(ROOT, 'data', 'jobs.json');
const CACHE_FILE = path.join(__dirname, 'competitor-detail-cache.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...records] = rows;
  return records.map(record => Object.fromEntries(headers.map((header, index) => [header, record[index] || ''])));
}

function isAllowedOfficialUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const expiringSignedUrl = [...url.searchParams.keys()].some(key => /^(?:x-amz-signature|x-amz-credential|signature|token|expires)$/i.test(key));
    if (expiringSignedUrl) return false;
    return url.protocol === 'https:' && (
      /\.(?:gov\.in|nic\.in|ac\.in)$/.test(host)
      || /(?:^|\.)rbi\.org\.in$/.test(host)
      || /(?:^|\.)sbi\.co\.in$/.test(host)
      || /(?:^|\.)ibps\.in$/.test(host)
      || /(?:^|\.)digialm\.com$/.test(host)
      || host === 'ongcindia.com' || host === 'www.ongcindia.com'
    );
  } catch { return false; }
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) throw new Error('Pass the path to the SarkariResult CSV export.');
  const csvRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const payload = JSON.parse(fs.readFileSync(FEED, 'utf8'));
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
  const records = payload.jobs || [];
  let inspected = 0;
  let updated = 0;
  let added = 0;
  const errors = [];

  const work = csvRows.filter(row => row['wp-block-latest-posts__post-title href']
    && !/\bCDS\b/i.test(row['wp-block-latest-posts__post-title'] || ''));
  let next = 0;
  async function worker() {
    while (next < work.length) {
      const row = work[next++];
      const title = String(row['wp-block-latest-posts__post-title'] || '').trim();
      const sourceUrl = String(row['wp-block-latest-posts__post-title href'] || '').trim();
      try {
        const details = await enrichListing({ title, link: sourceUrl });
        cache[sourceUrl] = { attemptedAt: new Date().toISOString(), details };
        inspected++;

        const key = normalizeTitle(title);
        let item = records.find(entry => normalizeTitle(entry.title) === key);
        if (!item) {
          const id = `competitor-sarkariresult-${crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16)}`;
          item = records.find(entry => entry.id === id);
        }
        if (!item) {
          item = {
            id: `competitor-sarkariresult-${crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16)}`,
            type: 'result', title, category: 'Results', state: 'See official notice', publisher: 'SarkariResult.com.cm',
            source: 'Recruiting authority notice', link: null
          };
          records.push(item);
          added++;
        }

        item.factSource = 'SarkariResult.com.cm listing facts; verify with the recruiting authority';
        item.factCheckedAt = new Date().toISOString().slice(0, 10);
        for (const field of ['organization', 'publishedDate', 'resultDate', 'examDate', 'vacancies', 'ageLimit', 'eligibility', 'applicationFee', 'milestones']) {
          if (details[field] !== undefined && details[field] !== null && details[field] !== '') item[field] = details[field];
        }
        const safeLinks = (details.officialLinks || []).filter(entry => isAllowedOfficialUrl(entry.url));
        if (safeLinks.length) item.officialLinks = safeLinks;
        const preferred = details.officialLink && isAllowedOfficialUrl(details.officialLink)
          ? details.officialLink
          : safeLinks[0]?.url;
        if (preferred) item.officialLink = preferred;
        if (details.notificationLink && isAllowedOfficialUrl(details.notificationLink)) item.notificationLink = details.notificationLink;
        item.link = item.officialLink && isAllowedOfficialUrl(item.officialLink) ? item.officialLink : null;
        item.publisher ||= 'SarkariResult.com.cm';
        updated++;
        console.log(`Checked: ${title}`);
      } catch (error) {
        errors.push({ title, sourceUrl, error: error.message });
        console.warn(`Could not check ${title}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 3 }, worker));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
  payload.jobs = records.sort((a, b) => String(a.lastDate || '9999-99-99').localeCompare(String(b.lastDate || '9999-99-99')));
  payload.total = payload.jobs.length;
  payload.generatedAt = new Date().toISOString();
  payload.errors = [...(payload.errors || []).filter(entry => entry.source !== 'SarkariResult CSV audit'),
    ...errors.map(entry => ({ source: 'SarkariResult CSV audit', url: entry.sourceUrl, title: entry.title, error: entry.error }))];
  fs.writeFileSync(FEED, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Checked ${inspected}/${work.length} result pages, updated ${updated} records, added ${added}; CDS was excluded.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
