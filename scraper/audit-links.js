// Audit public feed links with GET requests (many government portals reject HEAD).
// Run from the repository root: node scraper/audit-links.js
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'data', 'jobs.json');
const feed = JSON.parse(fs.readFileSync(file, 'utf8'));
const urls = [...new Set(feed.jobs.map(item => item.link).filter(Boolean))];
const results = [];
let next = 0;

async function worker() {
  while (next < urls.length) {
    const url = urls[next++];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SarkariJobsPlusLinkAudit/1.0', Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: controller.signal
      });
      const status = response.status;
      const finalUrl = response.url;
      await response.body?.cancel();
      if (status >= 400) results.push({ status, url, finalUrl });
    } catch (error) {
      results.push({ status: 'ERROR', url, error: error.message });
    } finally {
      clearTimeout(timeout);
    }
  }
}

Promise.all(Array.from({ length: 16 }, worker)).then(() => {
  console.log(`Checked ${urls.length} unique feed links using GET.`);
  for (const result of results) console.log(JSON.stringify(result));
  console.log(`Non-2xx or unavailable: ${results.length}`);
});
