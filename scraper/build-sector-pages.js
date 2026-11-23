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
const { markPathFor, monogramFor } = require('./org-marks');

const SECTORS_DIR = path.join(__dirname, 'sectors');
const ICONS = {
  'train-front': '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
  'newspaper': '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><path d="M18 14v6"/><path d="M2 14h16"/>',
  'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  landmark: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  'building-2': '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  'user-round-cog': '<path d="m14.305 19.53.923-.382"/><path d="m15.228 16.852-.923-.383"/><path d="m16.852 15.228-.383-.923"/><path d="m16.852 20.772-.383.924"/><path d="m19.148 15.228.383-.923"/><path d="m19.53 21.696-.382-.924"/><path d="M2 21a8 8 0 0 1 10.434-7.62"/><path d="m20.772 16.852.924-.383"/><path d="m20.772 19.148.924.383"/><circle cx="10" cy="8" r="5"/><circle cx="18" cy="18" r="3"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'map': '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" x2="8" y1="2" y2="18"/><line x1="16" x2="16" y1="6" y2="22"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  'info': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>',
  'folder': '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  'id-card': '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
  'home': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'clipboard-check': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'
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
  const MAX = 8;
  const shown = listings.slice(0, MAX);
  const rows = shown.map(({ item, type, slug }) => {
    const when = item.lastDate
      ? `Closes ${escapeHTML(date(item.lastDate))}`
      : item.examDate
        ? `Exam ${escapeHTML(date(item.examDate))}`
        : item.resultDate
          ? `Result ${escapeHTML(date(item.resultDate))}`
          : '';
    // The authority mark, so a row is recognisable before the title is read.
    // Where no official mark is on file the cell falls back to a monogram of the
    // authority's own name rather than borrowing another authority's seal.
    const mark = markPathFor(item);
    const mono = mark ? null : monogramFor(item);
    const markCell = mark
      ? `<img class="g-list-mark" src="../../assets/${mark}" alt="" width="28" height="28" loading="lazy" decoding="async">`
      : mono
        ? `<span class="g-list-mark g-list-mark--mono" data-len="${mono.initials.length}" style="--mono-h:${mono.hue}" aria-hidden="true">${escapeHTML(mono.initials)}</span>`
        : `<span class="g-list-mark g-list-mark--none" aria-hidden="true">${icon(type === 'admit' ? 'book-open' : type === 'result' ? 'graduation-cap' : 'briefcase')}</span>`;
    return `<li class="g-list-row">
${markCell}
<span class="g-list-type g-list-type--${type}">${icon(type === 'admit' ? 'book-open' : type === 'result' ? 'graduation-cap' : 'briefcase')}<span>${escapeHTML(listingType(item))}</span></span>
<a class="g-list-title" href="../../job-details/${slug}/">${escapeHTML(item.title)}</a>
${when ? `<span class="g-list-date">${when}</span>` : ''}
</li>`;
  }).join('\n');
  const more = listings.length > MAX
    ? `<p class="g-list-more"><a href="../../all-jobs.html">See all ${listings.length} listings for this sector →</a></p>`
    : '';
  return `<ul class="g-list">${rows}</ul>${more}`;
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
  const matrix = (sector.levels || []).map((level, index) => `
<div class="g-col" data-role-level="${index}">
<div class="g-col-head">${icon('graduation-cap', 'g-ic g-ic--sm')}<h3>${escapeHTML(level.level)}</h3></div>
<ul class="g-posts">
${(level.posts || []).map(post => `<li class="g-post"><span class="g-post-name">${escapeHTML(post.name)}</span><span class="g-post-code">${escapeHTML(post.code || '')}</span><span class="g-post-note">${escapeHTML(post.note || '')}</span></li>`).join('\n')}
</ul>
<p class="g-col-note">${escapeHTML(level.note || '')}</p>
</div>`).join('');
  const levelOptions = (sector.levels || []).map((level, index) =>
    `<option value="${index}">${escapeHTML(level.level)}</option>`).join('');

  // Each stage is an accessible disclosure: its title stays visible while
  // detailed tests and notes open only when a reader asks for them.
  const stages = (sector.stages || []).map((stage, index) => `
<li class="g-step">
<span class="g-step-num" aria-hidden="true">${index + 1}</span>
<details class="g-stage-detail"${index === 0 ? ' open' : ''}>
<summary class="g-stage-summary"><h3 class="g-step-name">${escapeHTML(stage.name)}</h3><span class="g-stage-toggle" aria-hidden="true"></span></summary>
<div class="g-stage-body">
<p class="g-step-tests">${escapeHTML(stage.tests)}</p>
<p class="g-step-note">${escapeHTML(stage.note)}</p>
</div>
</details>
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
<meta property="og:site_name" content="SarkariJobs+"><meta property="og:image" content="https://sarkarijobsplus.com/assets/sector-art/${sector.slug}.webp"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHTML(name)} government jobs: eligibility and selection stages"><meta name="twitter:description" content="${escapeHTML(description)}"><meta name="twitter:image" content="https://sarkarijobsplus.com/assets/sector-art/${sector.slug}.webp">
${jsonLd}
<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
<script src="../../js/analytics-config.js?v=20261022"></script><script src="../../js/analytics.js" defer></script>
<script src="../../js/guide.js?v=20261122-interactive-guides" defer></script>
<link rel="stylesheet" href="../../css/style.css?v=20261124-unified-b"><link rel="stylesheet" href="../../css/guide.css?v=20261123-modern-refresh">
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
<section class="g-hero g-hero--sector" style="--g-accent:${escapeHTML(sector.accent || '#FF9933')}">
<div class="container">
<nav class="g-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a><span aria-hidden="true">/</span><a href="../">Sector guides</a><span aria-hidden="true">/</span><span>${escapeHTML(name)}</span></nav>
<div class="g-sector-hero-grid">
<div class="g-sector-hero-copy">
${heroLogo}
<p class="g-kicker">${icon(sector.icon, 'g-ic g-hero-ic')}Sector guide</p>
<h1>${escapeHTML(name)} jobs: who can apply, and how selection works</h1>
<p class="g-lede">${escapeHTML(name)} recruitment explained in diagrams: which qualification unlocks which post, every selection stage, and live listings pulled from the official feed.</p>
<div class="g-statrow">${stats}</div>
<div class="g-pictograms">
${(sector.pictograms || []).map(p => `<div class="g-picto"><span class="g-picto-icon">${icon(p.icon, 'g-ic g-picto-ic')}</span><span class="g-picto-label">${escapeHTML(p.label)}</span></div>`).join('')}
</div>
<p class="g-hero-note">${icon('landmark', 'g-ic g-ic--sm')}Not a recruiting authority. Confirm every date, fee and eligibility clause on the official notice linked from each listing.</p>
<div class="g-hero-actions"><a class="g-hero-action-primary" href="#live">See ${listings.length} tracked listing${listings.length === 1 ? '' : 's'} <span aria-hidden="true">↓</span></a><a class="g-hero-action-secondary" href="#who-can-apply">Check qualification</a></div>
</div>
<figure class="g-sector-art">
<img src="../../assets/sector-art/${sector.slug}.webp" alt="Illustrative image for the ${escapeHTML(name)} government jobs guide" width="1344" height="768" loading="eager" fetchpriority="high" decoding="async">
<figcaption>Illustrative image for the ${escapeHTML(name)} guide. <b>Selection rules, dates and vacancies come only from the official notice linked on each listing.</b></figcaption>
</figure>
</div>
</div>
</section>

<nav class="g-jump container" aria-label="Jump to a section">
<span class="g-jump-label">On this page</span>
<a href="#who-can-apply">Who can apply</a>
<a href="#selection">Selection stages</a>
<a href="#live">Live listings (${listings.length})</a>
<a href="#apply">Apply</a>
<a href="#more-guides">More guidance</a>
</nav>

<section class="g-block container" id="who-can-apply">
<h2 class="g-h2">${icon('graduation-cap', 'g-ic g-h2-ic')}Who can apply: qualification → post</h2>
<p class="g-sub">Filter by qualification or search for a post. Confirm exact age, subject and certificate rules in the linked notice.</p>
<div class="g-role-tools">
<label class="g-role-search"><span>Search posts</span><input type="search" data-role-search placeholder="e.g. clerk, engineer, officer" autocomplete="off"></label>
<label class="g-role-level"><span>Your qualification</span><select data-role-level-filter><option value="all">All qualifications</option>${levelOptions}</select></label>
<button class="g-role-reset" type="button" data-role-reset>Reset</button>
<p class="g-role-count" data-role-count aria-live="polite">${(sector.levels || []).reduce((count, level) => count + (level.posts || []).length, 0)} role paths</p>
</div>
<p class="g-role-empty" data-role-empty hidden>No matching posts. Try a broader search or choose all qualifications.</p>
<div class="g-matrix">${matrix}</div>
</section>

<section class="g-block container" id="selection">
<h2 class="g-h2">${icon('book-open', 'g-ic g-h2-ic')}How selection works, stage by stage</h2>
<p class="g-sub">Open a stage for what it checks. The exact order and tests can vary by notification.</p>
<ol class="g-flow">${stages}</ol>
</section>

<section class="g-block container" id="live">
<h2 class="g-h2">${icon('briefcase', 'g-ic g-h2-ic')}${escapeHTML(name)} listings tracked right now</h2>
<p class="g-sub">${listings.length ? `${listings.length} listings matched to this sector. Open a detail page to check its source link and current notice.` : 'Nothing matched to this sector right now. Browse all listings while the feed refreshes.'}</p>
${renderListings(listings, helpers)}
</section>

<details class="g-more-card g-block container" id="apply">
<summary class="g-more-summary">
<span class="g-more-title"><span class="g-more-kicker">Application checklist</span><span class="g-more-heading">${icon('clipboard-check', 'g-ic g-h2-ic')}Apply in five steps</span></span>
<span class="g-more-toggle">Open checklist <span aria-hidden="true"></span></span>
</summary>
<div class="g-more-content">
<p class="g-sub">Use the recruiting authority’s instructions as the final word. Many portals stop allowing edits after fee payment.</p>
<ol class="g-apply">
<li class="g-apply-step"><span class="g-apply-num" aria-hidden="true">1</span><span class="g-apply-ic">${icon('file-text', 'g-ic')}</span><h3>Read the official notice</h3><p>Confirm qualification, age as on the notice's cut-off date, fee and the last date before you register.</p></li>
<li class="g-apply-step"><span class="g-apply-num" aria-hidden="true">2</span><span class="g-apply-ic">${icon('clipboard-check', 'g-ic')}</span><h3>Register on the official portal</h3><p>Use the link on the notice, not a search result. Keep the registration number and password it gives you.</p></li>
<li class="g-apply-step"><span class="g-apply-num" aria-hidden="true">3</span><span class="g-apply-ic">${icon('pen-line', 'g-ic')}</span><h3>Fill the form, upload photo and signature</h3><p>Enter your name exactly as on your Class 10 certificate. Upload the photo and signature in the size and format the portal specifies.</p></li>
<li class="g-apply-step"><span class="g-apply-num" aria-hidden="true">4</span><span class="g-apply-ic">${icon('credit-card', 'g-ic')}</span><h3>Pay the fee</h3><p>Pay online and save the receipt. If you claim a fee waiver, the category certificate must already be in the prescribed format.</p></li>
<li class="g-apply-step"><span class="g-apply-num" aria-hidden="true">5</span><span class="g-apply-ic">${icon('check-circle', 'g-ic')}</span><h3>Download the confirmation</h3><p>Save the submitted application PDF and the payment receipt. Check the portal again after a day to confirm the form was accepted.</p></li>
</ol>
</div>
</details>

<section class="g-block container g-more-guide" id="more-guides">
<div class="g-more-guide-heading"><p class="g-more-kicker">Optional detail</p><h2 class="g-h2">More sector guidance</h2><p class="g-sub">Open only the section you need; keep the main route short and easy to scan.</p></div>
<details class="g-disclosure" id="documents">
<summary><h3>${icon('folder', 'g-ic g-h2-ic')}Documents to keep ready</h3><span class="g-disclosure-mark" aria-hidden="true"></span></summary>
<div class="g-disclosure-content"><p class="g-sub">Check the official notice for exact formats, dimensions, validity dates and category-specific requirements.</p>
<ul class="g-docs">
<li class="g-doc"><span class="g-doc-ic">${icon('camera', 'g-ic')}</span><b>Passport photograph</b><p>Recent, plain light background, within the portal's file-size limit.</p></li>
<li class="g-doc"><span class="g-doc-ic">${icon('pen-line', 'g-ic')}</span><b>Signature</b><p>Signed in black ink on white paper, scanned at the size the portal asks for.</p></li>
<li class="g-doc"><span class="g-doc-ic">${icon('graduation-cap', 'g-ic')}</span><b>Class 10 certificate</b><p>Proves your date of birth and is the usual minimum qualification.</p></li>
<li class="g-doc"><span class="g-doc-ic">${icon('file-text', 'g-ic')}</span><b>Degree or marksheet</b><p>Final or provisional, whichever the notice says it accepts.</p></li>
<li class="g-doc"><span class="g-doc-ic">${icon('shield', 'g-ic')}</span><b>Caste or EWS certificate</b><p>In the prescribed format from the competent authority, valid on the cut-off date.</p></li>
<li class="g-doc"><span class="g-doc-ic">${icon('home', 'g-ic')}</span><b>Domicile or residence proof</b><p>Needed only where the notice reserves posts for a state or region.</p></li>
<li class="g-doc"><span class="g-doc-ic">${icon('id-card', 'g-ic')}</span><b>Photo ID</b><p>Aadhaar, PAN, passport or voter card — the name must match the application.</p></li>
<li class="g-doc"><span class="g-doc-ic">${icon('credit-card', 'g-ic')}</span><b>Fee payment proof</b><p>UPI or bank receipt, kept until the admit card is issued.</p></li>
</ul>
</div>
</details>

<details class="g-disclosure" id="syllabus">
<summary><h3>${icon('file-text', 'g-ic g-h2-ic')}Syllabus and preparation</h3><span class="g-disclosure-mark" aria-hidden="true"></span></summary>
<div class="g-disclosure-content"><p class="g-sub">Use official syllabus links where available; verify the current pattern on the recruiting authority’s site.</p>
<div class="g-syllabus">
${(sector.syllabus || []).map(s => `<div class="g-syl-card"><h3>${escapeHTML(s.exam)}</h3><p>${escapeHTML(s.pattern)}</p>${s.topics ? `<ul class="g-syl-topics">${s.topics.map(t => `<li><b>${escapeHTML(t.group)}</b> — ${escapeHTML(t.items)}</li>`).join('')}</ul>` : ''}${s.link ? `<a href="${escapeHTML(s.link)}" target="_blank" rel="noopener noreferrer">Official syllabus →</a>` : ''}${s.books ? `<div class="g-syl-books"><span class="g-syl-books-label">Recommended books:</span> ${s.books}</div>` : ''}</div>`).join('\n')}
</div>
${(sector.prepPlan && sector.prepPlan.length) ? `<div class="g-plan"><h3 class="g-plan-h">${icon('clock', 'g-ic g-ic--sm')} When and how to prepare</h3><ol class="g-plan-list">${sector.prepPlan.map((p, i) => `<li class="g-plan-step"><span class="g-plan-num">${i + 1}</span><div class="g-plan-body"><b>${escapeHTML(p.phase)}</b><p>${escapeHTML(p.what)}</p></div></li>`).join('')}</ol></div>` : ''}
</div>
</details>

<details class="g-disclosure" id="career">
<summary><h3>${icon('user-round-cog', 'g-ic g-h2-ic')}Career path after joining</h3><span class="g-disclosure-mark" aria-hidden="true"></span></summary>
<div class="g-disclosure-content"><p class="g-sub">Progression depends on cadre, service rules, seniority and departmental exams. Confirm details for the specific post.</p>
<ol class="g-ladder">${ladder}</ol>
</div>
</details>

<details class="g-disclosure" id="reality">
<summary><h3>${icon('shield', 'g-ic g-h2-ic')}Practical details to verify</h3><span class="g-disclosure-mark" aria-hidden="true"></span></summary>
<div class="g-disclosure-content"><p class="g-sub">These checks vary by recruitment; follow the current notification where it differs.</p>
<ul class="g-points">${reality}</ul>
</div>
</details>

<details class="g-disclosure" id="faq">
<summary><h3>Frequently asked questions</h3><span class="g-disclosure-mark" aria-hidden="true"></span></summary>
<div class="g-disclosure-content">
${faqHtml}
</div>
</details>

<details class="g-disclosure" id="about-guide">
<summary><h3>About this guide</h3><span class="g-disclosure-mark" aria-hidden="true"></span></summary>
<div class="g-disclosure-content">
<p>SarkariJobs+ is an independent tracker, not a recruiting authority. The post structure, pay levels and selection stages above are summarised from published recruitment notifications for this sector; where a notification differs, the notification wins. Listing dates, vacancy counts and fees are taken from the feed and credited to the source page.</p>
<p class="g-attrib-links">More sectors: ${loadSectors().filter(other => other.slug !== sector.slug).map(other => `<a href="../${other.slug}/">${escapeHTML(other.name)}</a>`).join(' · ') || '<a href="../">all sector guides</a>'}</p>
</div>
</details>
</section>
</main>

<footer class="g-foot"><div class="container foot-grid">
<div class="foot-brand"><a class="logo" href="../../" style="color:#fff"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<p class="foot-note">Independent tracker for government job notifications, results and admit cards across India — always linking the recruiting authority's own portal.</p></div>
<div><h3>Explore</h3><ul>
<li><a href="../../category.html">Notifications</a></li>
<li><a href="../../results.html">Results</a></li>
<li><a href="../../admit-cards.html">Admit cards</a></li>
<li><a href="../../all-jobs.html">All listings (A–Z)</a></li>
</ul></div>
<div><h3>Sector guides</h3><ul>
${loadSectors().map(other => `<li><a href="${other.slug === sector.slug ? './' : '../' + other.slug + '/'}">${escapeHTML(other.name)}</a></li>`).join('\n')}
</ul></div>
<div><h3>Information</h3><ul>
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
    const art = `assets/sector-art/${sector.slug}.webp`;
    return `<a class="g-card" href="${sector.slug}/" style="--g-accent:${escapeHTML(sector.accent || '#FF9933')}">
<span class="g-card-art" aria-hidden="true"><img src="../${art}" alt="" width="1344" height="768" loading="lazy" decoding="async"></span>
<span class="g-card-top"><span class="g-card-icon">${logoImg(sector, 'g-card-logo', '../')}</span><span class="g-card-count">${listings.length} tracked</span></span>
<span class="g-card-name">${escapeHTML(sector.name)}</span>
<span class="g-card-meta">${(sector.levels || []).length} qualification routes · ${listings.length} tracked listing${listings.length === 1 ? '' : 's'}</span>
<span class="g-card-cta">Explore guide <span aria-hidden="true">↗</span></span>
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
<meta property="og:url" content="https://sarkarijobsplus.com/guides/"><meta property="og:image" content="https://sarkarijobsplus.com/assets/generated/guide-hub-study.webp"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Sector-by-sector government job guides | SarkariJobs+"><meta name="twitter:description" content="Which qualification unlocks which post, every selection stage, and live listings per sector."><meta name="twitter:image" content="https://sarkarijobsplus.com/assets/generated/guide-hub-study.webp">
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
<link rel="stylesheet" href="../css/style.css?v=20261124-unified-b"><link rel="stylesheet" href="../css/guide.css?v=20261123-modern-refresh">
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
<section class="g-hero g-hero--hub" style="--g-accent:#FF9933">
<div class="container g-hub-hero-grid">
<div class="g-hub-hero-copy">
<nav class="g-crumbs" aria-label="Breadcrumb"><a href="../">Home</a><span aria-hidden="true">/</span><span>Sector guides</span></nav>
<p class="g-kicker">${icon('landmark', 'g-ic g-hero-ic')}Career guides</p>
<h1>Choose a career path, not just a job title.</h1>
<p class="g-lede">Start with your qualification. See the roles it can lead to, the selection stages to expect, and current listings linked to their source notices.</p>
<div class="g-hub-facts"><span><b>${sectors.length}</b> sector guides</span><span><b>Source-linked</b> listings</span><span><b>Plain-language</b> eligibility paths</span></div>
</div>
<figure class="g-hub-hero-art">
<img src="../assets/generated/guide-hub-study.webp" alt="An adult job seeker comparing career options at a desk" width="1344" height="768" fetchpriority="high" decoding="async">
<figcaption>Use the guide to plan. Use the official notice to decide.</figcaption>
</figure>
</div>
</section>
<section class="g-block container g-guide-index" aria-labelledby="sector-heading">
<div class="g-index-heading">
<p class="g-index-eyebrow">Find your route</p>
<h2 id="sector-heading">Explore by sector</h2>
<p>Each guide connects qualification → roles → selection stages → current listings.</p>
</div>
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
<div><h3>Explore</h3><ul>
<li><a href="../category.html">Notifications</a></li>
<li><a href="../results.html">Results</a></li>
<li><a href="../admit-cards.html">Admit cards</a></li>
<li><a href="../all-jobs.html">All listings (A–Z)</a></li>
</ul></div>
<div><h3>Information</h3><ul>
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
