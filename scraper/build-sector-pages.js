// Sector guide pages — the visual-first pillar content.
//
// These pages exist to answer "can I apply, and what happens after I do?"
// without making the reader read paragraphs. Per drafts/diagram-page-playbook.md
// the diagrams are HTML + CSS (text stays in the DOM, never scales as a
// picture), and inline SVG is used only for icon glyphs.
//
// Everything that varies by notification — dates, vacancies, fees — is pulled
// from data/jobs.json at build time. Only the sector structure (posts, stages,
// career ladder) is authored, and it lives in scraper/sectors/*.json.
const fs = require('fs');
const path = require('path');

const SECTORS_DIR = path.join(__dirname, 'sectors');
const ICONS = {
  'train-front': '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
  'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  landmark: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  'building-2': '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  'user-round-cog': '<path d="m14.305 19.53.923-.382"/><path d="m15.228 16.852-.923-.383"/><path d="m16.852 15.228-.383-.923"/><path d="m16.852 20.772-.383.924"/><path d="m19.148 15.228.383-.923"/><path d="m19.53 21.696-.382-.924"/><path d="M2 21a8 8 0 0 1 10.434-7.62"/><path d="m20.772 16.852.924-.383"/><path d="m20.772 19.148.924.383"/><circle cx="10" cy="8" r="5"/><circle cx="18" cy="18" r="3"/>'
};

const icon = (name, cls = 'g-ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.landmark}</svg>`;

// Real official recruiting-authority marks when a sector declares one. The
// inline SVG above stays as the fallback for sectors that have no official
// asset of their own. `prefix` is the relative path prefix for the current page
// so sector pages (guides/<slug>/) and the hub (guides/) resolve the same asset.
const logoImg = (sector, imgCls = 'g-ic', prefix = '') => {
  const logo = sector && sector.logo;
  if (!logo || !logo.src) return icon(sector.icon, 'g-ic');
  const alt = String(logo.alt || (sector.name || 'Sector')).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Intrinsic size is declared so the card does not jump when the mark loads.
  // The emblem is a wide lock-up, hence 2:1.
  const w = logo.width || 44;
  const h = logo.height || Math.round(w / 2);
  return `<img class="${imgCls}" src="${prefix}${logo.src}" alt="${alt}" width="${w}" height="${h}" loading="lazy" decoding="async">`;
};

function loadSectors() {
  if (!fs.existsSync(SECTORS_DIR)) return [];
  return fs.readdirSync(SECTORS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(path.join(SECTORS_DIR, file), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// A sector claims a listing when the feed tagged it with the sector's category
// or when the notice title names it. The category field is a listing-kind label
// ("Results", "Admit cards"), so title matching is what actually finds most
// railway, defence and banking notices.
function sectorMatcher(sector) {
  const words = (sector.categoryMatch || []).map(w => String(w).toLowerCase());
  const titleRe = sector.titleMatch ? new RegExp(sector.titleMatch, 'i') : null;
  return item => {
    const category = String(item.category || '').toLowerCase();
    if (words.some(word => category === word || category.includes(word))) return true;
    return titleRe ? titleRe.test(`${item.title || ''} ${item.organization || ''}`) : false;
  };
}

// Live listings that belong to this sector, deduplicated the same way the
// detail pages are: same normalised title on the same host is one notice.
function listingsFor(sector, payload, helpers) {
  const { typeOf, isNonRecruitmentPage, slugFor } = helpers;
  const matches = (payload.jobs || []).filter(item =>
    item && item.title && item.id && !isNonRecruitmentPage(item) && sectorMatcher(sector)(item));

  const seen = new Map();
  for (const item of matches) {
    const key = `${String(item.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${hostOf(item.link || item.officialLink)}`;
    const prior = seen.get(key);
    const score = completeness(item);
    if (!prior || score > prior.score) seen.set(key, { item, score });
  }
  return [...seen.values()].map(entry => entry.item).map(item => ({
    item, type: typeOf(item), slug: slugFor(item)
  }));
}

const hostOf = value => {
  try { return new URL(String(value)).host.replace(/^www\./, ''); } catch { return ''; }
};
const completeness = item => Object.values(item)
  .filter(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)).length;

function renderListings(listings, helpers) {
  const { escapeHTML, date, listingType } = helpers;
  if (!listings.length) {
    return '<p class="g-empty">No live listing in this sector right now. New notifications appear here as soon as the feed picks them up — <a href="../../all-jobs.html">browse every listing</a> meanwhile.</p>';
  }
  const rows = listings.map(({ item, type, slug }) => {
    const when = item.lastDate
      ? `Closes ${escapeHTML(date(item.lastDate))}`
      : item.examDate
        ? `Exam ${escapeHTML(date(item.examDate))}`
        : item.resultDate
          ? `Result ${escapeHTML(date(item.resultDate))}`
          : '';
    return `<li class="g-list-row">
<span class="g-list-type g-list-type--${type}">${icon(type === 'admit' ? 'book-open' : type === 'result' ? 'graduation-cap' : 'briefcase')}<span>${escapeHTML(listingType(item))}</span></span>
<a class="g-list-title" href="../../job-details/${slug}/">${escapeHTML(item.title)}</a>
${when ? `<span class="g-list-date">${when}</span>` : ''}
</li>`;
  }).join('\n');
  return `<ul class="g-list">${rows}</ul>`;
}

function renderPage(sector, listings, helpers) {
  const { escapeHTML, date } = helpers;
  const name = sector.name;
  const title = `${name} government jobs — eligibility, selection stages and live listings | SarkariJobs+`;
  const description = `${name} recruitment explained: which qualification unlocks which post, every selection stage, and ${listings.length} live listing${listings.length === 1 ? '' : 's'} linked to the official notification.`;

  // @liveListings is filled from the feed at build time. Anything that changes
  // with every notification cycle (counts, dates) must never be typed by hand
  // into the content model — see drafts/diagram-page-playbook.md §11.
  const stats = (sector.stats || []).map(stat => {
    const value = stat.value === '@liveListings' ? String(listings.length) : stat.value;
    return `<div class="g-stat"><span class="g-stat-value">${escapeHTML(value)}</span><span class="g-stat-label">${escapeHTML(stat.label)}</span></div>`;
  }).join('');

  // Matrix archetype: qualification columns, post cards inside.
  const matrix = (sector.levels || []).map(level => `
<div class="g-col">
<div class="g-col-head">${icon('graduation-cap', 'g-ic g-ic--sm')}<h3>${escapeHTML(level.level)}</h3></div>
<ul class="g-posts">
${(level.posts || []).map(post => `<li class="g-post"><span class="g-post-name">${escapeHTML(post.name)}</span><span class="g-post-code">${escapeHTML(post.code || '')}</span><span class="g-post-note">${escapeHTML(post.note || '')}</span></li>`).join('\n')}
</ul>
<p class="g-col-note">${escapeHTML(level.note || '')}</p>
</div>`).join('');

  // Stepper archetype: numbered rail, drawn by CSS on the container.
  const stages = (sector.stages || []).map((stage, index) => `
<li class="g-step">
<span class="g-step-num" aria-hidden="true">${index + 1}</span>
<div class="g-step-body">
<h3 class="g-step-name">${escapeHTML(stage.name)}</h3>
<p class="g-step-tests">${escapeHTML(stage.tests)}</p>
<p class="g-step-note">${escapeHTML(stage.note)}</p>
</div>
</li>`).join('');

  // Ladder archetype: ordered list with a spine.
  const ladder = (sector.ladder || []).map((rung, index) => `
<li class="g-rung">
<span class="g-rung-index">${index + 1}</span>
<span class="g-rung-text">${escapeHTML(rung)}</span>
</li>`).join('');

  const reality = (sector.reality || []).map(point => `
<li class="g-point">
${icon('shield', 'g-ic g-point-ic')}
<p>${escapeHTML(point)}</p>
</li>`).join('');

  const faq = (sector.faq || []);
  const faqHtml = faq.map((entry, index) =>
    `<details class="g-faq-item"${index === 0 ? ' open' : ''}><summary>${escapeHTML(entry.q)}</summary><p>${escapeHTML(entry.a)}</p></details>`).join('');
  // Above the fold, so eager — but fetchpriority="low" keeps the emblem from
  // competing with the LCP element. Intrinsic size stops the hero shifting.
  const heroLogo = sector.logo
    ? `<img class="g-hero-logo" src="../../${sector.logo.src}" alt="${escapeHTML(sector.logo.alt || sector.name)}" width="${sector.logo.width || 380}" height="${sector.logo.height || 190}" decoding="async" fetchpriority="low">`
    : '';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${name} government jobs: eligibility, selection stages and live listings`,
      description,
      datePublished: '2026-11-13',
      dateModified: helpers.feedDate,
      author: { '@type': 'Organization', name: 'SarkariJobs+' },
      publisher: { '@type': 'Organization', name: 'SarkariJobs+' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `https://sarkarijobsplus.com/guides/${sector.slug}/` }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sarkarijobsplus.com/' },
        { '@type': 'ListItem', position: 2, name: 'Sector guides', item: 'https://sarkarijobsplus.com/guides/' },
        { '@type': 'ListItem', position: 3, name: `${name} jobs` }
      ]
    },
    faq.length >= 2 ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(entry => ({
        '@type': 'Question', name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a }
      }))
    } : null
  ].filter(Boolean).map(block => JSON.stringify(block).replace(/</g, '\\u003c'))
    .map(json => `<script type="application/ld+json">${json}</script>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeHTML(description)}">
<link rel="canonical" href="https://sarkarijobsplus.com/guides/${sector.slug}/">
<meta name="theme-color" content="#0a1128">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHTML(name)} government jobs: eligibility and selection stages">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:url" content="https://sarkarijobsplus.com/guides/${sector.slug}/">
<meta property="og:site_name" content="SarkariJobs+">
${jsonLd}
<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
<script src="../../js/analytics-config.js?v=20261022"></script><script src="../../js/analytics.js" defer></script>
<link rel="stylesheet" href="../../css/style.css"><link rel="stylesheet" href="../../css/guide.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20'%3E%3Crect width='30' height='7' fill='%23FF9933'/%3E%3Crect y='7' width='30' height='6' fill='%23fff'/%3E%3Crect y='13' width='30' height='7' fill='%23138808'/%3E%3Ccircle cx='15' cy='10' r='2.4' fill='none' stroke='%2306038D' stroke-width='1'/%3E%3C/svg%3E">
</head>
<body>
<div class="tricolor-strip"></div>
<header><div class="container nav-wrap">
<a class="logo" href="../../"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<nav aria-label="Main navigation"><ul>
<li><a href="../../category.html">Notifications</a></li>
<li><a href="../../results.html">Results</a></li>
<li><a href="../../admit-cards.html">Admit cards</a></li>
<li><a href="../../all-jobs.html">All listings</a></li>
</ul></nav>
<a class="btn btn-primary g-nav-cta" href="#live">Live listings</a>
</div></header>

<main>
<section class="g-hero" style="--g-accent:${escapeHTML(sector.accent || '#FF9933')}">
<div class="container">
<nav class="g-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a><span aria-hidden="true">/</span><a href="../">Sector guides</a><span aria-hidden="true">/</span><span>${escapeHTML(name)}</span></nav>
${heroLogo}
<p class="g-kicker">${icon(sector.icon, 'g-ic g-hero-ic')}Sector guide</p>
<h1>${escapeHTML(name)} jobs: who can apply, and how selection works</h1>
<p class="g-lede">Everything below is derived from the recruiting authority's own notification. The structure — posts, stages, pay levels — is written here once so you do not have to decode a PDF. The dates and vacancy counts are pulled live from the feed and always link the official page.</p>
<div class="g-statrow">${stats}</div>
<p class="g-hero-note">${icon('landmark', 'g-ic g-ic--sm')}Not a recruiting authority. Confirm every date, fee and eligibility clause on the official notice linked from each listing.</p>
</div>
</section>

<nav class="g-jump container" aria-label="Jump to a section">
<a href="#who-can-apply">Who can apply</a>
<a href="#selection">Selection stages</a>
<a href="#career">Career path</a>
<a href="#reality">Reality check</a>
<a href="#live">Live listings (${listings.length})</a>
<a href="#faq">FAQ</a>
</nav>

<section class="g-block container" id="who-can-apply">
<h2 class="g-h2">${icon('graduation-cap', 'g-ic g-h2-ic')}Who can apply: qualification → post</h2>
<p class="g-sub">Find your qualification on the left. Every post it unlocks is listed under it, with the pay level and what the job actually involves.</p>
<div class="g-matrix">${matrix}</div>
</section>

<section class="g-block container" id="selection">
<h2 class="g-h2">${icon('book-open', 'g-ic g-h2-ic')}How selection works, stage by stage</h2>
<p class="g-sub">Each stage below is a real gate. Only the last one leads to an appointment letter.</p>
<ol class="g-flow">${stages}</ol>
</section>

<section class="g-block container" id="career">
<h2 class="g-h2">${icon('user-round-cog', 'g-ic g-h2-ic')}Career path after joining</h2>
<p class="g-sub">Promotions run on seniority plus departmental exams. The rung you enter on depends on the post you clear.</p>
<ol class="g-ladder">${ladder}</ol>
</section>

<section class="g-block container" id="reality">
<h2 class="g-h2">${icon('shield', 'g-ic g-h2-ic')}What the notification does not tell you</h2>
<p class="g-sub">The parts candidates usually discover too late.</p>
<ul class="g-points">${reality}</ul>
</section>

<section class="g-block container" id="live">
<h2 class="g-h2">${icon('briefcase', 'g-ic g-h2-ic')}${escapeHTML(name)} listings tracked right now</h2>
<p class="g-sub">${listings.length ? `${listings.length} live listing${listings.length === 1 ? '' : 's'} matched to this sector. Each opens the summary and the official source link.` : 'Nothing live in this sector at this moment.'}</p>
${renderListings(listings, helpers)}
</section>

<section class="g-block container" id="faq">
<h2 class="g-h2">Frequently asked questions</h2>
${faqHtml}
</section>

<section class="g-block container g-attrib">
<h2 class="g-h2">About this guide</h2>
<p>SarkariJobs+ is an independent tracker, not a recruiting authority. The post structure, pay levels and selection stages above are summarised from published recruitment notifications for this sector; where a notification differs, the notification wins. Listing dates, vacancy counts and fees are taken from the feed and credited to the source page.</p>
<p class="g-attrib-links">More sectors: ${loadSectors().filter(other => other.slug !== sector.slug).map(other => `<a href="${other.slug}/">${escapeHTML(other.name)}</a>`).join(' · ') || '<a href="../">all sector guides</a>'}</p>
</section>
</main>

<footer class="g-foot"><div class="container foot-grid">
<div class="foot-brand"><a class="logo" href="../../" style="color:#fff"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<p class="foot-note">Independent tracker for government job notifications, results and admit cards across India — always linking the recruiting authority's own portal.</p></div>
<div><h4>Explore</h4><ul>
<li><a href="../../category.html">Notifications</a></li>
<li><a href="../../results.html">Results</a></li>
<li><a href="../../admit-cards.html">Admit cards</a></li>
<li><a href="../../all-jobs.html">All listings (A–Z)</a></li>
</ul></div>
<div><h4>Sector guides</h4><ul>
${loadSectors().map(other => `<li><a href="${other.slug === sector.slug ? './' : other.slug + '/'}">${escapeHTML(other.name)}</a></li>`).join('\n')}
</ul></div>
<div><h4>Information</h4><ul>
<li><a href="../../about.html">About</a></li>
<li><a href="../../editorial-policy.html">Editorial policy</a></li>
<li><a href="../../privacy.html">Privacy</a></li>
<li><a href="../../contact.html">Contact</a></li>
</ul></div>
</div>
<p class="g-foot-note">Original SarkariJobs+ summaries and layout © 2026 SarkariJobs+. Source facts remain attributed to their publishers.</p>
<div class="foot-strip"></div>
</footer>
</body></html>`;
}

function renderHub(sectors, helpers) {
  const { escapeHTML } = helpers;
  const cards = sectors.map(sector => {
    const listings = sector._listings || [];
    return `<a class="g-card" href="${sector.slug}/" style="--g-accent:${escapeHTML(sector.accent || '#FF9933')}">
<span class="g-card-icon">${logoImg(sector, 'g-card-logo', '../')}</span>
<span class="g-card-name">${escapeHTML(sector.name)}</span>
<span class="g-card-meta">${(sector.levels || []).length} qualification paths · ${listings.length} live listing${listings.length === 1 ? '' : 's'}</span>
<span class="g-card-cta">Open guide ${icon('landmark', 'g-ic g-ic--sm')}</span>
</a>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sector-by-sector government job guides | SarkariJobs+</title>
<meta name="description" content="Plain-language guides to government job sectors: which qualification unlocks which post, every selection stage, and the live listings tracked right now.">
<link rel="canonical" href="https://sarkarijobsplus.com/guides/">
<meta name="theme-color" content="#0a1128">
<meta property="og:type" content="website">
<meta property="og:title" content="Sector-by-sector government job guides | SarkariJobs+">
<meta property="og:description" content="Which qualification unlocks which post, every selection stage, and live listings per sector.">
<meta property="og:url" content="https://sarkarijobsplus.com/guides/">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Sector guides',
    url: 'https://sarkarijobsplus.com/guides/',
    hasPart: sectors.map(sector => ({
      '@type': 'Article',
      headline: `${sector.name} jobs: eligibility and selection stages`,
      url: `https://sarkarijobsplus.com/guides/${sector.slug}/`
    }))
  }).replace(/</g, '\\u003c')}</script>
<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
<script src="../js/analytics-config.js?v=20261022"></script><script src="../js/analytics.js" defer></script>
<link rel="stylesheet" href="../css/style.css"><link rel="stylesheet" href="../css/guide.css">
</head>
<body>
<div class="tricolor-strip"></div>
<header><div class="container nav-wrap">
<a class="logo" href="../"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<nav aria-label="Main navigation"><ul>
<li><a href="../category.html">Notifications</a></li>
<li><a href="../results.html">Results</a></li>
<li><a href="../admit-cards.html">Admit cards</a></li>
<li><a href="../all-jobs.html">All listings</a></li>
</ul></nav>
</div></header>
<main>
<section class="g-hero" style="--g-accent:#FF9933"><div class="container">
<nav class="g-crumbs" aria-label="Breadcrumb"><a href="../">Home</a><span aria-hidden="true">/</span><span>Sector guides</span></nav>
<p class="g-kicker">${icon('landmark', 'g-ic g-hero-ic')}Sector guides</p>
<h1>Which government job fits your qualification</h1>
<p class="g-lede">Every sector has its own ladder, its own exam pattern and its own traps. Pick one to see the qualification that unlocks each post, the stages you have to clear, and the live listings tracked from the official portals.</p>
</div></section>
<section class="g-block container">
<div class="g-cards">${cards}</div>
</section>
<section class="g-block container g-attrib">
<h2 class="g-h2">How these guides are built</h2>
<p>Post names, pay levels and selection stages are summarised from the recruiting authorities' published notifications. Dates, vacancy counts and fees are not typed by hand — they are read from the feed on every build and linked to the official page. Where a notification is silent on something, the field is left empty rather than guessed.</p>
</section>
</main>
<footer class="g-foot"><div class="container foot-grid">
<div class="foot-brand"><a class="logo" href="../" style="color:#fff"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<p class="foot-note">Independent tracker for government job notifications, results and admit cards across India.</p></div>
<div><h4>Explore</h4><ul>
<li><a href="../category.html">Notifications</a></li>
<li><a href="../results.html">Results</a></li>
<li><a href="../admit-cards.html">Admit cards</a></li>
<li><a href="../all-jobs.html">All listings (A–Z)</a></li>
</ul></div>
<div><h4>Information</h4><ul>
<li><a href="../about.html">About</a></li>
<li><a href="../editorial-policy.html">Editorial policy</a></li>
<li><a href="../privacy.html">Privacy</a></li>
<li><a href="../contact.html">Contact</a></li>
</ul></div>
</div>
<p class="g-foot-note">Original SarkariJobs+ summaries and layout © 2026 SarkariJobs+.</p>
<div class="foot-strip"></div>
</footer>
</body></html>`;
}

// Writes guides/<slug>/index.html plus the hub, and returns the paths so the
// detail generator can put them in sitemap.xml with change-aware lastmod.
function buildGuides({ ROOT, payload, helpers }) {
  const sectors = loadSectors();
  if (!sectors.length) return [];
  for (const sector of sectors) sector._listings = listingsFor(sector, payload, helpers);

  const outRoot = path.join(ROOT, 'guides');
  fs.mkdirSync(outRoot, { recursive: true });

  const written = [];
  for (const sector of sectors) {
    const dir = path.join(outRoot, sector.slug);
    fs.mkdirSync(dir, { recursive: true });
    const html = renderPage(sector, sector._listings, { ...helpers, feedDate: helpers.feedDate });
    const file = path.join(dir, 'index.html');
    fs.writeFileSync(file, html);
    written.push({ rel: `guides/${sector.slug}/`, file, slug: sector.slug });
  }
  const hubFile = path.join(outRoot, 'index.html');
  fs.writeFileSync(hubFile, renderHub(sectors, helpers));
  written.push({ rel: 'guides/', file: hubFile, slug: '' });
  return written;
}

module.exports = { buildGuides, loadSectors, sectorMatcher };