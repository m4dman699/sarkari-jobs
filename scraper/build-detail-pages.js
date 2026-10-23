const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'jobs.json'), 'utf8'));
const output = path.join(ROOT, 'job-details');

// Change-aware sitemap dates: page-hashes.json stores the content hash and the
// date each detail page last actually changed, so <lastmod> reports real page
// updates instead of treating every rebuild as a change (Google stops trusting
// lastmod values that do not match the page's real modification history).
const lastmodStatePath = path.join(__dirname, 'page-hashes.json');
let lastmodState = {};
try { lastmodState = JSON.parse(fs.readFileSync(lastmodStatePath, 'utf8')); } catch { }
const nextLastmodState = {};
const feedDate = String(payload.generatedAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
const sitemapPath = path.join(ROOT, 'sitemap.xml');
const rawSitemap = fs.readFileSync(sitemapPath, 'utf8');

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function slugFor(item) {
  const title = String(item.title || 'listing').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54) || 'listing';
  let hash = 2166136261;
  for (const char of String(item.id || item.link || item.title)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${title}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function date(value) {
  if (!value) return 'Not stated in the source';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) ? escapeHTML(value) : parsed.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

function listingType(item) {
  if (item.type === 'admit-card') return 'Admit card';
  if (item.type === 'result') return 'Result / recruitment update';
  return 'Job notification';
}

function isNonRecruitmentPage(item) {
  const title = String(item?.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const url = String(item?.sourceListingUrl || item?.discoveredVia || item?.link || '');
  return /^(?:privacy policy|about(?: us)?|contact(?: us)?|disclaimer|terms(?: and conditions)?|sitemap|advertise(?: with us)?|faq)$/.test(title)
    || /\/(?:privacy-policy|about-us|contact-us|disclaimer|terms-and-conditions|sitemap)(?:\/|$)/i.test(url);
}

function summaryFor(item, kind) {
  const organization = escapeHTML(item.organization || 'the recruiting authority');
  if (item.type === 'job') {
    const facts = [
      item.vacancies ? `${escapeHTML(item.vacancies)} vacancies are listed` : '',
      item.openDate ? `applications opened ${date(item.openDate)}` : '',
      item.lastDate ? `the listed deadline is ${date(item.lastDate)}` : ''
    ].filter(Boolean).join('; ');
    return `${organization} recruitment${facts ? `: ${facts}` : ''}. Check the authority notice for the complete post-wise requirements and application instructions.`;
  }
  if (item.type === 'admit-card') {
    return `${escapeHTML(item.title)} is an examination update from ${organization}. Confirm the exam schedule and candidate instructions on the authority portal before downloading.`;
  }
  const updateDate = item.resultDate || item.publishedDate;
  return `${escapeHTML(item.title)} is a result or examination update from ${organization}${updateDate ? `, listed ${date(updateDate)}` : ''}. Use the authority link to confirm the latest notice and access the result or answer key.`;
}

function applicationStatus(item) {
  if (item.type !== 'job' || !item.lastDate) return null;
  const close = new Date(`${item.lastDate}T23:59:59Z`);
  const status = close >= new Date() ? 'Application window closes' : 'Listed closing date has passed';
  return `${status}: <strong>${date(item.lastDate)}</strong>`;
}

function row(label, value) {
  return `<tr><th scope="row">${escapeHTML(label)}</th><td>${value}</td></tr>`;
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const urls = [];
for (const item of payload.jobs || []) {
  if (!item?.title || !item.id || isNonRecruitmentPage(item)) continue;
  const slug = slugFor(item);
  const directory = path.join(output, slug);
  fs.mkdirSync(directory, { recursive: true });
  const title = escapeHTML(item.title);
  const kind = listingType(item);
  const verifiedSummary = `<p class="summary">${summaryFor(item, kind)}</p>`;
  const extraRows = [
    item.vacancies ? row('Vacancies', escapeHTML(item.vacancies)) : '',
    item.ageLimit ? row('Age limit', escapeHTML(item.ageLimit)) : '',
    item.eligibility ? row('Eligibility', escapeHTML(item.eligibility)) : '',
    item.applicationFee ? row('Application fee', escapeHTML(item.applicationFee.split(/payment mode/i)[0].trim())) : '',
    item.examDate ? row('Exam date', date(item.examDate)) : '',
    item.resultDate ? row('Result date', date(item.resultDate)) : ''
  ].filter(Boolean).join('\n');
  const typeDateRows = item.type === 'admit-card'
    ? row('Admit card listed', date(item.publishedDate))
    : item.type === 'result'
      ? `${row('Update published', date(item.publishedDate))}${item.resultDate ? row('Result date', date(item.resultDate)) : ''}`
      : [row('Applications open', date(item.openDate)), row('Application deadline', date(item.lastDate))].join('\n');
  const milestones = (item.milestones || []).filter(entry => entry?.label && entry?.dateText)
    .map(entry => row(entry.label, escapeHTML(entry.dateText))).join('\n');
  const trustedLinks = Array.isArray(item.officialLinks) ? item.officialLinks : [];
  const officialLink = item.officialLink || (item.publisher ? '' : item.link);
  if (officialLink && !trustedLinks.some(entry => entry.url === officialLink)) {
    trustedLinks.unshift({ url: officialLink, label: 'Official recruitment portal' });
  }
  if (item.notificationLink && !trustedLinks.some(entry => entry.url === item.notificationLink)) {
    trustedLinks.push({ url: item.notificationLink, label: 'Official notification' });
  }
  const links = trustedLinks.slice(0, 5).map((entry, index) => {
    if (!/^https:\/\//i.test(entry.url || '')) return '';
    const generic = /^(click here|here|official recruitment portal)$/i.test(entry.label || '');
    const label = generic
      ? (index === 0 && item.type === 'result' ? 'Official result / update portal' : index === 0 && item.type === 'admit-card' ? 'Official admit-card portal' : index === 0 ? 'Official recruitment portal' : 'Official notice or update')
      : `Official ${entry.label}`;
    return `<a class="button${index ? ' secondary' : ''}" href="${escapeHTML(entry.url)}" rel="noopener noreferrer" target="_blank">${escapeHTML(label)} ↗</a>`;
  }).filter(Boolean).join('\n');
  const canonical = `https://sarkarijobsplus.com/job-details/${slug}/`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | SarkariJobs+</title><meta name="description" content="Key dates and source links for ${title}. Verify eligibility and instructions in the official recruitment notice.">
<link rel="canonical" href="${canonical}"><script src="../../js/analytics-config.js?v=20261022"></script><script src="../../js/analytics.js" defer></script><link rel="stylesheet" href="../../css/style.css">
<style>body{background:#f4f7fb;color:#182235;font:16px/1.65 system-ui,sans-serif;margin:0}.detail-wrap{max-width:920px;margin:2rem auto;padding:1.25rem}.detail-card{background:#fff;border:1px solid #d9e1ee;border-radius:16px;padding:clamp(1.25rem,4vw,2.5rem);box-shadow:0 8px 28px #1527470d}.crumbs{font-size:.9rem;margin-bottom:1.4rem}.eyebrow{color:#415b83;font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.8rem}.detail-card h1{font-size:clamp(1.6rem,4vw,2.4rem);line-height:1.2;margin:.35rem 0 1rem}.summary{font-size:1.05rem;color:#35445b}.facts{width:100%;border-collapse:collapse;margin:1.5rem 0}.facts th,.facts td{border-bottom:1px solid #e5eaf2;padding:.8rem;text-align:left;vertical-align:top}.facts th{width:35%;color:#42516a}.buttons{display:flex;flex-wrap:wrap;gap:.7rem;margin:1.2rem 0}.button{display:inline-flex;padding:.75rem 1rem;background:#173c8f;color:white!important;border-radius:9px;text-decoration:none;font-weight:700}.button.secondary{background:#edf2fb;color:#173c8f!important}.notice{font-size:.9rem;color:#46556d;background:#f3f6fb;padding:1rem;border-radius:10px}.back{display:inline-block;margin-top:1.2rem}.disclaimer{font-size:.85rem;color:#58667a;border-top:1px solid #e5eaf2;padding-top:1rem;margin-top:1.5rem}</style></head>
<body><main class="detail-wrap"><nav class="crumbs"><a href="../../">Home</a> / ${escapeHTML(kind)}</nav><article class="detail-card">
<div class="eyebrow">${escapeHTML(kind)} · ${escapeHTML(item.category || 'Government recruitment')}</div><h1>${title}</h1>
<p><strong>Recruiting organization:</strong> ${escapeHTML(item.organization || item.source || 'See source notice')}<br><strong>Location:</strong> ${escapeHTML(item.state || 'See notice')}</p>
${verifiedSummary}<h2>Key details</h2><table class="facts"><tbody>
${row('Listing type', escapeHTML(kind))}${row('Published / listed', date(item.publishedDate))}${typeDateRows}
${extraRows}${milestones}${applicationStatus(item) ? row('Closing status', applicationStatus(item)) : ''}
${row('Fact source', escapeHTML(item.factSource || item.publisher || item.source || 'Not stated'))}${item.factCheckedAt ? row('Source checked', date(item.factCheckedAt)) : ''}
${row('Page wording and layout', 'Original SarkariJobs+ summary')}</tbody></table>
<div class="buttons">${links || '<span class="notice">No source link was provided in this feed record. Search the recruiting authority website before applying.</span>'}</div>
<p class="notice">This page uses original SarkariJobs+ wording and layout to summarize public listing facts. Confirm dates, eligibility, vacancies, fees, and instructions in the recruiting authority’s latest notice. Details not stated in the source are left unfilled.</p>
<p class="disclaimer">SarkariJobs+ is an independent information site and is not a recruiting authority. Original SarkariJobs+ summaries and page layout © 2026 SarkariJobs+. Source facts remain attributed and are not represented as exclusive or licensed from the source site.</p>
<a class="back" href="../../">← Back to SarkariJobs+</a><nav class="back" aria-label="Site information"><a href="../../about.html">About</a> · <a href="../../editorial-policy.html">Editorial policy</a> · <a href="../../privacy.html">Privacy</a> · <a href="../../contact.html">Contact</a></nav></article></main></body></html>`;
  fs.writeFileSync(path.join(directory, 'index.html'), html);
  // Change-aware lastmod: an identical rebuild keeps the page's previous date;
  // a page whose content moved (new milestone, refreshed detail) is stamped
  // with this feed's date. New pages use the listing date on first build.
  const pageHash = crypto.createHash('sha1').update(html).digest('hex');
  const prevState = lastmodState[slug];
  let lastmod;
  if (prevState && prevState.hash === pageHash) lastmod = prevState.lastmod || null;
  else if (prevState) lastmod = feedDate;
  else if (rawSitemap.includes(`/job-details/${slug}/`)) lastmod = item.publishedDate || null;
  else lastmod = feedDate;
  nextLastmodState[slug] = { hash: pageHash, lastmod };
  urls.push(`<url><loc>${canonical}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
}

// The client-rendered shell pages below re-render this committed feed in the
// browser, so the date they materially changed equals the feed's build date.
// No deploy-time sitemap rewriting is needed anymore: this makes the deployed
// sitemap byte-identical to the committed one.
const shellUrls = [
  'https://sarkarijobsplus.com/',
  'https://sarkarijobsplus.com/category.html',
  'https://sarkarijobsplus.com/state.html',
  'https://sarkarijobsplus.com/results.html',
  'https://sarkarijobsplus.com/admit-cards.html',
  'https://sarkarijobsplus.com/upsc-cds-2-2026/'
];
const sitemapRescape = value => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
let sitemap = rawSitemap.replace(/\s*<url>\s*<loc>https:\/\/sarkarijobsplus\.com\/job-details\/[^<]+<\/loc>[\s\S]*?<\/url>/g, '');
for (const loc of shellUrls) {
  const pattern = new RegExp(`<url>\\s*<loc>${sitemapRescape(loc)}</loc>\\s*(?:<lastmod>[\\d-]{10}</lastmod>\\s*)?</url>`);
  if (pattern.test(sitemap)) sitemap = sitemap.replace(pattern, `<url><loc>${loc}</loc><lastmod>${feedDate}</lastmod></url>`);
}
sitemap = sitemap.replace('</urlset>', `${urls.join('\n')}\n</urlset>`);

// Canonical serialization independent of the previous file's formatting:
// every <url> block on its own compact line, so repeated builds are
// byte-stable and the deployed file equals the committed one. Stray CR bytes
// from CRLF checkouts are dropped so every line ends uniformly in LF.
const opening = rawSitemap.slice(0, rawSitemap.indexOf('<url>')).replace(/\s+$/, '\n').replace(/\r/g, '');
const blocks = (sitemap.replace(/\r/g, '').match(/<url>[\s\S]*?<\/url>/g) || []);
fs.writeFileSync(sitemapPath, `${opening}${blocks.join('\n')}\n</urlset>\n`);
fs.writeFileSync(lastmodStatePath, JSON.stringify(nextLastmodState, null, 2) + '\n');

// A previous feed imported a third-party privacy-policy page as an admit card.
// Redirect its retired URL to the real first-party policy page after deployment.
const retiredPrivacyPage = path.join(output, 'privacy-policy-1f1c4eba');
fs.mkdirSync(retiredPrivacyPage, { recursive: true });
fs.writeFileSync(path.join(retiredPrivacyPage, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://sarkarijobsplus.com/privacy.html"><meta http-equiv="refresh" content="0;url=../../privacy.html"><title>Privacy policy | SarkariJobs+</title></head><body><p>This page has moved to our <a href="../../privacy.html">privacy policy</a>.</p></body></html>`);
console.log(`Generated ${urls.length} individual detail pages and updated sitemap.xml.`);
