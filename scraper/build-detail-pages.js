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

// Original editorial layer for detail pages. SarkariJobs+ wording only — the
// facts come from this record; the guidance sentences are written for this
// site and never paraphrase the source page. Each page's content answers the
// reader's real next questions so the listing is more than public-domain data.
const KIND_URL_PHRASE = {
  'Job notification': 'recruitment notice',
  'Admit card': 'admit card release',
  'Result / recruitment update': 'result update'
};

function seedOf(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function orgNames(item) {
  const raw = String(item.organization || (item.publisher ? '' : item.source) || '').trim();
  let base = raw;
  let short = '';
  const matched = raw.match(/^(.*?)\s*\(([^()]{1,12})\)\s*$/);
  if (matched) { base = matched[1].trim(); short = matched[2].trim(); }
  else if (raw.length > 16 && raw.split(/\s+/).length >= 2) { short = raw.split(/\s+/).pop(); }
  if (!base) { base = 'the exam authority'; short = 'the authority'; }
  else if (!short) { short = 'the authority'; }
  return { base, short };
}

function statePhrase(item) {
  const state = String(item.state || '').trim();
  return /^(see\b|not stated|n\/a)/i.test(state) || !state ? '' : state;
}

function guideFor(item, kind, names, slug) {
  const { base, short } = names;
  const state = statePhrase(item);
  const phrase = KIND_URL_PHRASE[kind];
  const regional = state ? ` covering candidates in ${state}` : '';
  const pick = seedOf('guide:' + slug) % 3;
  if (kind === 'Job notification') {
    const leads = [
      `This is a ${phrase} from ${base}${regional ? `, and it addresses candidates in ${state}` : ''}. The facts table collects only the details stated in the public notice, so eligibility, post-wise conditions and fee amounts should still be confirmed in the notification before applying.`,
      `${base} has published this opening${regional ? ` for candidates in ${state}` : ''}. This page points to the correct application portal and lists the dates exactly as stated in the notice; treat the notification itself as the only binding source of requirements.`,
      `Candidates who intend to apply should start from the official portal linked above and read the complete notification there. This page is a summary aid — it does not republish the full notice text, and the source is credited in every row above.`
    ];
    return { lead: leads[pick], caution: `Apply only through the portal linked above, and be cautious of anyone claiming to sell or fast-track a government application — ${short} processes candidates only through its own channels.` };
  }
  if (kind === 'Admit card') {
    const leads = [
      `This page tracks the ${phrase} for ${base}${regional}. Hall tickets are issued only by the exam authority, so download from the portal linked above and check every printed detail before the exam day.`,
      `${base} has released these call letters${regional}. Keep a printed copy with a valid photo ID ready for the exam, because entry depends on the details printed on the card, not on any forwarded copy or text message.`,
      `If you applied for this exam, verify your slot and centre on the official hall ticket from the authority portal. Any discrepancy in the printed details should be reported to ${short} well before the exam date.`
    ];
    return { lead: leads[pick], caution: `Never share registration numbers, passwords or date of birth with third parties promising to download a hall ticket for you — carry the official printout instead.` };
  }
  const leads = [
    `This ${phrase} comes from ${base}${regional}; the linked document is the authority's own result page or PDF, not a rewritten copy. Roll number lists and marks, where issued, are read directly there.`,
    `Practical use: open the official link above and search your roll or registration number in the published list. This page only records that this result stage is out and credits where it was first published.`,
    `Read this as a pointer, not the result itself: the authority document linked above holds the final roll number list or marks login. Any claim without an official document behind it should not be trusted.`
  ];
  return { lead: leads[pick], caution: `Results are free public documents. Treat messages or calls that "confirm your result" for a payment as fraud and verify solely on the authority's portal.` };
}

function faqFor(item, kind, names) {
  const { base, short } = names;
  const list = [];
  if (kind === 'Job notification') {
    list.push({ q: 'Where should I apply for this opening?', a: `${base} handles applications directly through its official portal. Use the source links section above to open the right page, and never pay an agent to process an application on your behalf.` });
    if (item.lastDate) list.push({ q: 'What is the application deadline?', a: `The listing records ${date(item.lastDate)} as the closing date. Confirm it on the official portal before paying any fee — authorities occasionally extend deadlines by notice.` });
    if (item.vacancies) list.push({ q: 'How many vacancies are advertised?', a: `${item.vacancies} vacancies are indicated for this recruitment. Post-wise distribution and reservation details should be confirmed from the official notification itself.` });
    if (item.examDate) list.push({ q: 'When is the examination scheduled?', a: `The listing notes the exam date as ${date(item.examDate)}. Any schedule change would be published by ${short} first and reflected on its portal.` });
  } else if (kind === 'Admit card') {
    list.push({ q: 'How do I download the admit card?', a: `Open ${short}'s official portal from the links section above and sign in with your registration or roll number and date of birth, exactly as used during the application.` });
    list.push({ q: 'What should I check on it?', a: `Confirm the printed name, photograph, exam date and shift, centre address and category. Report any mismatch to ${short} through its official contact channels before the exam day.` });
    if (item.examDate) list.push({ q: 'When is the examination?', a: `The listing records the exam date as ${date(item.examDate)}. Reach the centre per the shift stated on the admit card, not on any third-party website.` });
  } else {
    list.push({ q: 'How do I check this result?', a: `Use the official result link in the links section above — it opens either ${short}'s result page or the published PDF — and search for your roll or registration number.` });
    if (item.resultDate) list.push({ q: 'When was the result declared?', a: `The listing records the result date as ${date(item.resultDate)}. If the link stops working, check the authority's results section, where documents are sometimes rearranged.` });
    list.push({ q: 'What happens for shortlisted candidates?', a: `The next stage, whether document verification or the following round, is notified by ${short} on its portal. Rely on that notice for dates rather than forwarded screenshots.` });
  }
  return list;
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

function urgency(item) {
  if (item.type !== 'job' || !item.lastDate) return null;
  const close = new Date(`${item.lastDate}T23:59:59Z`);
  if (close < new Date()) return 'passed';
  return (close - new Date()) <= 604800000 ? 'soon' : 'open';
}

function deadlinePill(state) {
  if (state === 'passed') return '<span class="countdown cd-crit">Closed</span>';
  if (state === 'soon') return '<span class="countdown cd-warn">Closing soon</span>';
  return '<span class="countdown cd-ok">Open</span>';
}

// Status banner summarising what the reader must act on. Facts only —
// never invents a date that is not on the record.
function bannerFor(item, kind, state) {
  if (kind === 'Job notification') {
    if (!item.lastDate) return null;
    const closing = date(item.lastDate);
    if (state === 'passed') return { cls: 'd-banner--crit', icon: '⛔', text: `The listed closing date has passed — applications are closed as per this record. Reconfirm on the official portal before relying on it.` };
    if (state === 'soon') return { cls: 'd-banner--warn', icon: '⏳', text: `Application window is closing — the listed deadline is <strong>${closing}</strong>. Complete the form and fee before it ends.` };
    return { cls: 'd-banner--ok', icon: '🟢', text: `Applications are open — the listed deadline is <strong>${closing}</strong>. Read the official notice before you apply.` };
  }
  if (kind === 'Admit card') {
    const exam = item.examDate ? ` The listed exam date is <strong>${date(item.examDate)}</strong>.` : '';
    return { cls: 'd-banner--info', icon: '🎫', text: `Admit card / hall ticket is available on the official portal linked below.${exam}` };
  }
  return { cls: 'd-banner--info', icon: '✅', text: `Result / update declared on the authority portal${item.resultDate ? ` — listed result date <strong>${date(item.resultDate)}</strong>` : ''}.` };
}

function factTile(label, value, cls = '') {
  return `<div class="d-fact${cls ? ' ' + cls : ''}"><dt>${escapeHTML(label)}</dt><dd>${value}</dd></div>`;
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
  const verifiedSummary = `<p class="d-lead">${summaryFor(item, kind)}</p>`;
  const names = orgNames(item);
  const guide = guideFor(item, kind, names, slug);
  const faq = faqFor(item, kind, names);
  const faqHtml = faq.map((entry, index) => `<details class="d-faq-item"${index === 0 ? ' open' : ''}><summary>${escapeHTML(entry.q)}</summary><p>${escapeHTML(entry.a)}</p></details>`).join('');
  const faqLd = faq.length >= 2
    ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(entry => ({ '@type': 'Question', name: entry.q, acceptedAnswer: { '@type': 'Answer', text: entry.a } })) }).replace(/</g, '\\u003c')}</script>`
    : '';
  const urgencyState = urgency(item);
  const banner = bannerFor(item, kind, urgencyState);
  const bannerHtml = banner ? `<div class="d-banner ${banner.cls}"><span>${banner.icon}</span><p>${banner.text}</p></div>` : '';
  const keyFacts = [
    item.openDate ? factTile('Applications open', date(item.openDate)) : '',
    item.lastDate ? factTile('Apply before', date(item.lastDate) + ' ' + deadlinePill(urgencyState), urgencyState === 'passed' ? 'd-fact--deadline d-fact--closed' : 'd-fact--deadline') : '',
    item.examDate ? factTile('Exam date', date(item.examDate), 'd-fact--exam') : '',
    item.resultDate ? factTile('Result date', date(item.resultDate), 'd-fact--result') : '',
    item.vacancies ? factTile('Vacancies', escapeHTML(item.vacancies), 'd-fact--vac') : '',
    item.ageLimit ? factTile('Age limit', escapeHTML(item.ageLimit)) : '',
    item.eligibility ? factTile('Eligibility', escapeHTML(item.eligibility)) : '',
    item.applicationFee ? factTile('Application fee', escapeHTML(item.applicationFee.split(/payment mode/i)[0].trim())) : ''
  ].filter(Boolean).join('\n');
  const listedDateFact = item.type === 'job'
    ? ''
    : factTile(kind === 'Admit card' ? 'Admit card listed' : 'Update published', date(item.publishedDate), 'd-fact--mini');
  const attrFacts = [
    factTile('Listing type', escapeHTML(kind), 'd-fact--mini'),
    listedDateFact,
    factTile('Fact source', escapeHTML(item.factSource || item.publisher || item.source || 'Not stated'), 'd-fact--mini'),
    item.factCheckedAt ? factTile('Source checked', date(item.factCheckedAt), 'd-fact--mini') : '',
    factTile('Page wording and layout', 'Original SarkariJobs+ summary', 'd-fact--mini')
  ].filter(Boolean).join('\n');
  const milestones = (item.milestones || []).filter(entry => entry?.label && entry?.dateText)
    .map(entry => `<div class="d-mile"><b>${escapeHTML(entry.label)}</b><em>${escapeHTML(entry.dateText)}</em></div>`).join('');
  const milestoneSection = milestones
    ? `<h2 class="d-section-title">Timeline of dates</h2><div class="d-timeline">${milestones}</div>` : '';
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
      ? (index === 0 && item.type === 'result' ? 'Open official result page' : index === 0 && item.type === 'admit-card' ? 'Download official admit card' : index === 0 ? 'Open official recruitment portal' : 'Official notice or update')
      : `Official ${escapeHTML(entry.label)}`;
    return `<a class="btn${index ? ' btn-outline' : ' btn-primary'}" href="${escapeHTML(entry.url)}" rel="noopener noreferrer" target="_blank">${label} ↗</a>`;
  }).filter(Boolean).join('\n');
  const ctaRow = links
    ? `<div class="d-cta">${links}</div>`
    : '<span class="d-nonelink">No source link was provided in this feed record. Search the recruiting authority website before applying.</span>';
  const chips = [
    `<span class="d-chip">🏢 ${escapeHTML(item.organization || 'Recruiting authority named in the notice')}</span>`,
    item.category ? `<span class="d-chip">🗂 ${escapeHTML(item.category)}</span>` : '',
    `<span class="d-chip">📍 ${escapeHTML(item.state || 'Location: see notice')}</span>`,
    item.publishedDate ? `<span class="d-chip">🗓 Listed ${date(item.publishedDate)}</span>` : ''
  ].filter(Boolean).join('');
  const kindId = item.type === 'admit-card' ? 'admit' : item.type === 'result' ? 'result' : 'job';
  const ribbonCls = kindId === 'admit' ? ' d-ribbon--admit' : kindId === 'result' ? ' d-ribbon--result' : '';
  const canonical = `https://sarkarijobsplus.com/job-details/${slug}/`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | SarkariJobs+</title><meta name="description" content="Key dates and source links for ${title} listed by ${escapeHTML(names.base)}. Verify eligibility and instructions in the official recruitment notice.">
<meta name="theme-color" content="#0a1128">
<meta property="og:title" content="${title} | SarkariJobs+"><meta property="og:description" content="${escapeHTML(names.base)} — ${escapeHTML(kind)}: key dates and the official link."><meta property="og:url" content="${canonical}"><meta property="og:type" content="article"><meta property="og:site_name" content="SarkariJobs+">
<link rel="canonical" href="${canonical}">${faqLd}<script src="../../js/analytics-config.js?v=20261022"></script><script src="../../js/analytics.js" defer></script><link rel="stylesheet" href="../../css/style.css"><link rel="stylesheet" href="../../css/detail.css?v=d2">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20'%3E%3Crect width='30' height='7' fill='%23FF9933'/%3E%3Crect y='7' width='30' height='6' fill='%23fff'/%3E%3Crect y='13' width='30' height='7' fill='%23138808'/%3E%3Ccircle cx='15' cy='10' r='2.4' fill='none' stroke='%2306038D' stroke-width='1'/%3E%3C/svg%3E">
</head>
<body>
<div class="tricolor-strip"></div>
<header><div class="container nav-wrap">
<a class="logo" href="../../"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<nav><ul>
<li><a href="../../category.html">Notifications</a></li>
<li><a href="../../results.html">Results</a></li>
<li><a href="../../admit-cards.html">Admit cards</a></li>
<li><a href="../../state.html">States</a></li>
</ul></nav>
<a class="btn btn-primary" href="../../results.html" style="padding:9px 18px;font-size:.88rem">Latest results</a>
</div></header>
<main class="d-main">
<section class="d-hero">
<nav class="d-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a><span class="d-sep" aria-hidden="true"></span><a href="../../${item.type === 'result' ? 'results.html' : item.type === 'admit-card' ? 'admit-cards.html' : 'category.html'}">${escapeHTML(kind)} listings</a></nav>
<span class="d-ribbon${ribbonCls}">${escapeHTML(kind)}</span>
<h1>${title}</h1>
<div class="d-chiprow">${chips}</div>
${ctaRow}
</section>
${bannerHtml}
${verifiedSummary}
<article>
<h2 class="d-section-title">Key details</h2>
<dl class="d-facts">
${keyFacts}
</dl>
${milestoneSection}
</article>
<section class="d-guide">
<h2>How to use this page</h2>
<p class="d-glead">${escapeHTML(guide.lead)}</p>
<div class="d-caution"><span>⚠️</span><p>${escapeHTML(guide.caution)}</p></div>
</section>
<section class="d-faq">
<h2>Frequently asked questions</h2>
${faqHtml}
</section>
<section class="d-attrib">
<h2>Source attribution</h2>
<dl class="d-facts">${attrFacts}</dl>
<p class="d-attrib-note">This page uses original SarkariJobs+ wording and layout to summarize public listing facts. Confirm dates, eligibility, vacancies, fees, and instructions in the recruiting authority’s latest notice. Details not stated in the source are left unfilled.</p>
</section>
<nav class="d-discover" aria-label="Explore the site">
<a class="d-disc" href="../../category.html"><span class="d-disc--icon">🔔</span><span class="d-disc--label">Browse notifications</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
<a class="d-disc" href="../../results.html"><span class="d-disc--icon">🏆</span><span class="d-disc--label">Latest results</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
<a class="d-disc" href="../../admit-cards.html"><span class="d-disc--icon">🎫</span><span class="d-disc--label">Admit cards</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
<a class="d-disc" href="../../state.html"><span class="d-disc--icon">🗺️</span><span class="d-disc--label">State-wise jobs</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
</nav>
</main>
<footer class="d-foot"><div class="container foot-grid">
<div class="foot-brand"><a class="logo" href="../../" style="color:#fff"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<p class="foot-note">Independent tracker for government job notifications, results and admit cards across India — always linking the recruiting authority's own portal.</p></div>
<div><h4>Explore</h4><ul>
<li><a href="../../category.html">Notifications</a></li>
<li><a href="../../results.html">Results</a></li>
<li><a href="../../admit-cards.html">Admit cards</a></li>
<li><a href="../../state.html">State-wise</a></li>
</ul></div>
<div><h4>Information</h4><ul>
<li><a href="../../about.html">About SarkariJobs+</a></li>
<li><a href="../../editorial-policy.html">Editorial policy</a></li>
<li><a href="../../privacy.html">Privacy policy</a></li>
<li><a href="../../contact.html">Contact us</a></li>
</ul></div>
<div><h4>This page</h4><ul>
<li><a href="../../">← Back to SarkariJobs+</a></li>
</ul></div>
</div>
<p style="font-size:.82rem;line-height:1.7;max-width:640px;margin:0 auto;padding:0 0 18px;">SarkariJobs+ is an independent information site and is not a recruiting authority. Original SarkariJobs+ summaries and page layout © 2026 SarkariJobs+. Source facts remain attributed and are not represented as exclusive or licensed from the source site.</p>
<div class="foot-strip"></div>
</footer>
</body></html>`;
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
// First-party static prose pages (About, Content/Editorial policy, Privacy,
// Contact) join the sitemap under their own change-aware keys in
// page-hashes.json, so <lastmod> moves only when the page content actually
// changes — not on every feed-build day. Existing blocks for these URLs are
// dropped first so repeated builds stay single-copy and byte-stable.
const staticPageBlocks = [];
for (const rel of ['about.html', 'editorial-policy.html', 'privacy.html', 'contact.html']) {
  const fileHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel)).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
  const prevState = lastmodState[`page:${rel}`];
  const lastmod = prevState && prevState.hash === fileHash ? (prevState.lastmod || null) : feedDate;
  nextLastmodState[`page:${rel}`] = { hash: fileHash, lastmod };
  const loc = `https://sarkarijobsplus.com/${rel}`;
  const pattern = new RegExp(`<url>\\s*<loc>${sitemapRescape(loc)}</loc>\\s*(?:<lastmod>[\\d-]{10}</lastmod>\\s*)?</url>`);
  if (pattern.test(sitemap)) sitemap = sitemap.replace(pattern, '');
  if (lastmod) staticPageBlocks.push(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`);
}
sitemap = sitemap.replace('</urlset>', `${urls.join('\n')}${staticPageBlocks.length ? '\n' + staticPageBlocks.join('\n') : ''}\n</urlset>`);

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
