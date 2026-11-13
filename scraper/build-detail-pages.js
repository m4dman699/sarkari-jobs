const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Sector guide generator. Imported here rather than run as a separate script so
// there is one entry point (`npm run build:details`) and one deploy path, and so
// the per-listing "deeper guide" links are derived from the same content model
// that produces the guides themselves.
const { buildGuides, loadSectors, sectorMatcher } = require('./build-sector-pages');

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

// The feed's own `type` field is unreliable in one direction: 17 records whose
// title plainly says "Admit Card" are typed as results, which made those pages
// announce a result and answer "how do I check this result" on a page about
// downloading a hall ticket. The title is the authority the reader sees, so use
// it to correct the type — but only when it is unambiguous, i.e. it mentions an
// admit card and no result vocabulary at all.
const ADMIT_WORDS = /\b(?:admit\s*card|hall\s*ticket|e-?admit|call\s*letter)\b/i;
const RESULT_WORDS = /\b(?:result|merit|answer\s*key|score\s*card|marks)\b/i;
function typeOf(item) {
  const title = String(item?.title || '');
  if (ADMIT_WORDS.test(title) && !RESULT_WORDS.test(title)) return 'admit';
  if (item?.type === 'admit-card') return 'admit';
  if (item?.type === 'result') return 'result';
  return 'job';
}

function listingType(item) {
  const type = typeOf(item);
  if (type === 'admit') return 'Admit card';
  if (type === 'result') return 'Result / recruitment update';
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
    // Always-present pair. Many feeds publish only a headline and a link, with
    // no dates, vacancy count or qualification in the record itself. Without
    // these two the page would carry a single FAQ, and a single-question
    // FAQPage block is both thin content and invalid as a rich result.
    list.push({ q: 'How do I confirm the eligibility criteria?', a: `Eligibility is stated in ${short}'s own notification, not in this summary. Open the source link above and read the qualification, age and experience clauses for the post you want before paying any application fee.` });
    list.push({ q: 'Where is the official notification?', a: `The source links section above points to ${short}'s own page or document. This page mirrors the listing headline only, so the official notification remains the authority for post names, pay level, reservation and selection stages.` });
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
  const type = typeOf(item);
  if (type === 'job') {
    const facts = [
      item.vacancies ? `${escapeHTML(item.vacancies)} vacancies are listed` : '',
      item.openDate ? `applications opened ${date(item.openDate)}` : '',
      item.lastDate ? `the listed deadline is ${date(item.lastDate)}` : ''
    ].filter(Boolean).join('; ');
    return `${organization} recruitment${facts ? `: ${facts}` : ''}. Check the authority notice for the complete post-wise requirements and application instructions.`;
  }
  if (type === 'admit') {
    return `${escapeHTML(item.title)} is an examination update from ${organization}. Confirm the exam schedule and candidate instructions on the authority portal before downloading.`;
  }
  const updateDate = item.resultDate || item.publishedDate;
  return `${escapeHTML(item.title)} is a result or examination update from ${organization}${updateDate ? `, listed ${date(updateDate)}` : ''}. Use the authority link to confirm the latest notice and access the result or answer key.`;
}

function urgency(item) {
  if (typeOf(item) !== 'job' || !item.lastDate) return null;
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
    if (state === 'passed') return { cls: 'd-banner--crit', icon: 'closed', text: `The listed closing date has passed — applications are closed as per this record. Reconfirm on the official portal before relying on it.` };
    if (state === 'soon') return { cls: 'd-banner--warn', icon: 'alert', text: `Application window is closing — the listed deadline is <strong>${closing}</strong>. Complete the form and fee before it ends.` };
    return { cls: 'd-banner--ok', icon: 'open', text: `Applications are open — the listed deadline is <strong>${closing}</strong>. Read the official notice before you apply.` };
  }
  if (kind === 'Admit card') {
    const exam = item.examDate ? ` The listed exam date is <strong>${date(item.examDate)}</strong>.` : '';
    return { cls: 'd-banner--info', icon: 'admit', text: `Admit card / hall ticket is available on the official portal linked below.${exam}` };
  }
  return { cls: 'd-banner--info', icon: 'result', text: `Result / update declared on the authority portal${item.resultDate ? ` — listed result date <strong>${date(item.resultDate)}</strong>` : ''}.` };
}

function factTile(label, value, cls = '') {
  return `<div class="d-fact${cls ? ' ' + cls : ''}"><dt>${escapeHTML(label)}</dt><dd>${value}</dd></div>`;
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

// Icon set — Lucide (https://lucide.dev), ISC licence. Geometry is inlined as
// SVG paths rather than loaded as a font or sprite so it inherits currentColor,
// stays crisp at any zoom, and costs ~300 bytes per glyph.
//
// These replace emoji pictographs. Emoji are rendered by the operating system
// as full-colour glyphs: they ignore CSS colour, sit off the text baseline, and
// look different on Windows, Android and iOS — which is why a diagram or badge
// built from emoji never matches the rest of the page.
const ICONS = {
  job: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  admit: '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
  result: '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
  organization: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  closed: '<path d="M4.929 4.929 19.07 19.071"/><circle cx="12" cy="12" r="10"/>',
  open: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};
// Decorative by default (aria-hidden): every icon here sits next to a visible
// text label, so announcing it again would just repeat the label to a screen
// reader. Pass an explicit label only for a genuinely icon-only control.
//
// Icons are referenced through a per-page <symbol> sprite instead of repeating
// the path data at every call site. On the 609-row index that is the difference
// between ~390 KB and ~160 KB of HTML.
const icon = (name, cls = 'd-ic', label = '') => {
  const id = `i-${ICONS[name] ? name : 'info'}`;
  return `<svg class="${cls}"${label ? ` role="img" aria-label="${escapeHTML(label)}"` : ' aria-hidden="true" focusable="false"'}><use href="#${id}"/></svg>`;
};
const iconSprite = () => `<svg class="d-sprite" aria-hidden="true" focusable="false" width="0" height="0">${Object.keys(ICONS)
  .map(name => `<symbol id="i-${name}" viewBox="0 0 24 24">${ICONS[name]}</symbol>`)
  .join('')}</svg>`;

// Crawlable internal link web. The hubs (index/category/results/admit-cards/
// state) render their listing cards with JavaScript, so their HTML source
// contains no links to any detail page. Without detail → detail links Google
// has to discover all pages from sitemap.xml alone, which wastes crawl budget
// on a young domain. This index gives every page real sibling links.
const entries = [];
for (const item of payload.jobs || []) {
  if (!item?.title || !item.id || isNonRecruitmentPage(item)) continue;
  const type = typeOf(item);
  entries.push({ item, slug: slugFor(item), kind: listingType(item), type });
}
const kindLabel = type => type === 'admit' ? 'Admit' : type === 'result' ? 'Result' : 'Job';
const kindClass = type => type === 'admit' ? ' d-rel--admit' : type === 'result' ? ' d-rel--result' : '';

// ---- Duplicate consolidation ----
// The feed ingests the same official notice from several competitors, and each
// copy arrives with a different opaque URL token. Left alone that produces
// several near-identical pages competing for one query (one UPPSC result
// arrived ten times). Duplicates keep their URL so old links still resolve, but
// they canonicalise to the most complete copy, drop out of the sitemap, and are
// never used as internal-link targets.
//
// The key needs the host as well as the title: three different state commissions
// legitimately publish a page titled exactly "Final Results", so title alone
// would wrongly merge them.
const normalizeTitle = value => String(value || '')
  .toLowerCase()
  .replace(/^\s*\d{1,2}\s+[a-z]{3,9}\s+\d{4}\s+/, '') // leading "07 Dec 2026 "
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const hostOf = value => {
  try { return new URL(String(value)).host.replace(/^www\./, ''); } catch { return ''; }
};
const completeness = item => Object.values(item)
  .filter(value => value !== null && value !== undefined && value !== ''
    && !(Array.isArray(value) && value.length === 0)
    && !(typeof value === 'object' && !Array.isArray(value))).length;

const duplicateGroups = new Map();
for (const entry of entries) {
  const key = `${normalizeTitle(entry.item.title)}|${hostOf(entry.item.officialLink || entry.item.link)}`;
  if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
  duplicateGroups.get(key).push(entry);
}
const canonicalOf = new Map(); // duplicate slug -> primary slug
for (const list of duplicateGroups.values()) {
  if (list.length < 2) continue;
  const ranked = [...list].sort((a, b) =>
    completeness(b.item) - completeness(a.item) || String(a.slug).localeCompare(String(b.slug)));
  for (const duplicate of ranked.slice(1)) canonicalOf.set(duplicate.slug, ranked[0].slug);
}
const primaryEntries = entries.filter(entry => !canonicalOf.has(entry.slug));

// ---- Titles ----
// Some feeds expose only a page heading ("Final Results") with the subject
// nowhere in it. Appending the state or category is derived from the record,
// not invented, and it stops several pages sharing one identical <title>.
const isGenericTitle = title => {
  const value = String(title || '').trim();
  return value.length < 24 || /^(?:final results?|results?|notices?|admit cards?|home|click here|latest updates?)$/i.test(value);
};
const displayTitleFor = item => {
  const title = String(item.title || '').replace(/\s+/g, ' ').trim();
  if (!isGenericTitle(title)) return title;
  const qualifier = [item.state, item.category, item.organization]
    .map(value => String(value || '').trim())
    .find(value => value && value.length > 2 && !title.toLowerCase().includes(value.toLowerCase()));
  return qualifier ? `${title} — ${qualifier}` : title;
};

// Meta descriptions are truncated in search results past ~155-160 characters,
// so compose a short factual line instead of prefixing the full title.
const clampText = (value, max) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.55 ? cut.slice(0, space) : cut).replace(/[\s,;:.—–-]+$/, '');
};
const descriptionFor = (item, kind) => {
  const organization = String(item.organization || 'the recruiting authority').replace(/\s+/g, ' ').trim();
  const facts = [];
  if (item.vacancies) facts.push(`${item.vacancies} vacancies`);
  if (item.lastDate) facts.push(`last date ${date(item.lastDate)}`);
  if (item.examDate) facts.push(`exam ${date(item.examDate)}`);
  if (item.resultDate) facts.push(`declared ${date(item.resultDate)}`);
  const detail = facts.length ? facts.join(', ') : 'key dates and the official source link';
  return clampText(`${displayTitleFor(item)} — ${kind.toLowerCase()} from ${organization}: ${detail}.`, 155);
};

const relatedFor = (entry, limit = 6) => {
  const { item, slug, type } = entry;
  const scored = primaryEntries
    .filter(other => other.slug !== slug)
    .map(other => {
      let score = 0;
      if (other.type === type) score += 3;
      if (item.category && other.item.category === item.category) score += 4;
      if (item.state && other.item.state === item.state) score += 2;
      return { other, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || (a.other.slug < b.other.slug ? -1 : 1));
  // Deterministic rotation per page: without it every page would surface the
  // same handful of top-scored siblings and the rest would stay under-linked.
  const offset = scored.length ? seedOf('rel:' + slug) % scored.length : 0;
  const rotated = scored.slice(offset).concat(scored.slice(0, offset));
  return rotated.slice(0, limit).map(entry => entry.other);
};

// Long-form guides that live outside job-details/. Each entry claims the
// listings it is genuinely about, so the guide gets inbound links from real
// content instead of sitting orphaned in the sitemap.
//
// The sector guides are generated from scraper/sectors/*.json, so this list is
// derived rather than hand-maintained: a listing whose authority or title matches
// a sector links to that sector's guide.
const GUIDES = [
  ...loadSectors().map(sector => ({
    href: `guides/${sector.slug}/`,
    label: `${sector.name} sector guide: which qualification unlocks which post, selection stages and live listings`,
    test: sectorMatcher(sector)
  })),
  {
    href: 'upsc-cds-2-2026/',
    label: 'UPSC CDS II 2026 — exam guide: dates, vacancies, result and admit card',
    test: item => /\bCDS\b/i.test(String(item.title || '')) && /UPSC|Union Public Service/i.test(String(item.organization || ''))
  }
];

// ---- Real authority marks ----
// Detail pages are static, so they cannot use the host→logo lookup that
// js/main.js runs in the browser. The mark is chosen from the authority named in
// the record, not the URL host: feeds routinely link a state portal
// (recruitment.rajasthan.gov.in) or a republisher, so host matching misses most
// authorities, while the organisation text is what the reader actually sees.
//
// Every entry points at an image the authority itself publishes. Where no mark
// is on file the page keeps its plain text label rather than inventing a seal.
const MARK_BY_NAME = [
  [/\bRPSC\b|Rajasthan Public Service/i, 'portal-logos/rpsc.png'],
  [/\bUPPSC\b|UP Public Service/i, 'portal-logos/uppsc-official.png'],
  [/\bMPPSC\b|Madhya Pradesh Public Service/i, 'portal-logos/mppsc.png'],
  [/\bGPSC\b|Gujarat Public Service/i, 'portal-logos/gpsc.png'],
  [/\bHPSC\b|Haryana Public Service/i, 'portal-logos/hpsc.png'],
  [/\bTPSC\b|Tripura Public Service/i, 'portal-logos/tpsc-emblem.png'],
  [/\bHSSC\b|Haryana Staff Selection/i, 'portal-logos/hssc.png'],
  [/\bDSSSB\b|Delhi Subordinate Services/i, 'portal-logos/dsssb.png'],
  [/\bMPSC\b|Manipur Public Service/i, 'portal-logos/manipur-mpsc.ico'],
  [/\bSSC\b|Staff Selection Commission/i, 'portal-logos/ssc.webp'],
  [/\bRRB\b|Railway Recruitment|Railways?\b/i, 'portal-logos/railways.png'],
  [/Supreme Court of India/i, 'portal-logos/supreme-court.ico']
];

// Decorative: the authority is already named in the h1, the chips and the source
// table, so alt="" stops a screen reader from hearing it twice. width/height are
// fixed so the hero never shifts, and the image is lazy so a logo can never
// become the LCP element.
const markFor = item => {
  const org = String(item.organization || item.source || item.publisher || '');
  const match = MARK_BY_NAME.find(([pattern]) => pattern.test(org));
  if (!match) return '';
  return `<img class="d-org-mark" src="../../assets/${match[1]}" alt="" width="40" height="40" loading="lazy" decoding="async">`;
};

const urls = [];
for (const item of payload.jobs || []) {
  if (!item?.title || !item.id || isNonRecruitmentPage(item)) continue;
  const slug = slugFor(item);
  const directory = path.join(output, slug);
  fs.mkdirSync(directory, { recursive: true });
  const title = escapeHTML(displayTitleFor(item));
  const kind = listingType(item);
  const type = typeOf(item);
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
  const bannerHtml = banner ? `<div class="d-banner ${banner.cls}"><span class="d-banner-ic">${icon(banner.icon, 'd-ic')}</span><p>${banner.text}</p></div>` : '';
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
  const listedDateFact = type === 'job'
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
      ? (index === 0 && type === 'result' ? 'Open official result page' : index === 0 && type === 'admit' ? 'Download official admit card' : index === 0 ? 'Open official recruitment portal' : 'Official notice or update')
      : `Official ${escapeHTML(entry.label)}`;
    return `<a class="btn${index ? ' btn-outline' : ' btn-primary'}" href="${escapeHTML(entry.url)}" rel="noopener noreferrer" target="_blank">${label} ↗</a>`;
  }).filter(Boolean).join('\n');
  const ctaRow = links
    ? `<div class="d-cta">${links}</div>`
    : '<span class="d-nonelink">No source link was provided in this feed record. Search the recruiting authority website before applying.</span>';
  const chips = [
    `<span class="d-chip">${icon('organization', 'd-ic d-chip-ic')}${escapeHTML(item.organization || 'Recruiting authority named in the notice')}</span>`,
    item.category ? `<span class="d-chip">${icon('folder', 'd-ic d-chip-ic')}${escapeHTML(item.category)}</span>` : '',
    `<span class="d-chip">${icon('pin', 'd-ic d-chip-ic')}${escapeHTML(item.state || 'Location: see notice')}</span>`,
    item.publishedDate ? `<span class="d-chip">${icon('calendar', 'd-ic d-chip-ic')}Listed ${date(item.publishedDate)}</span>` : ''
  ].filter(Boolean).join('');
  const kindId = type;
  const ribbonCls = kindId === 'admit' ? ' d-ribbon--admit' : kindId === 'result' ? ' d-ribbon--result' : '';
  // Breadcrumb structured data mirroring the visible d-crumbs navigation.
  const breadcrumbLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sarkarijobsplus.com/' },
      { '@type': 'ListItem', position: 2, name: `${kind} listings`, item: `https://sarkarijobsplus.com/${type === 'result' ? 'results' : type === 'admit' ? 'admit-cards' : 'category'}.html` },
      { '@type': 'ListItem', position: 3, name: String(item.title || '') }
    ]
  }).replace(/</g, '\\u003c')}</script>`;
  const primarySlug = canonicalOf.get(slug);
  const canonical = `https://sarkarijobsplus.com/job-details/${primarySlug || slug}/`;
  // Sibling links keep every listing reachable in one hop from another listing.
  const related = relatedFor({ item, slug, kind, type });
  const relatedLinks = related.map(rel => {
    const text = String(rel.item.title || '').replace(/\s+/g, ' ').trim();
    const short = text.length > 82 ? text.slice(0, 80).trimEnd() + '\u2026' : text;
    return `<a class="d-rel${kindClass(rel.type)}" href="../${rel.slug}/"><span class="d-rel-tag">${icon(rel.type, 'd-ic d-rel-ic')}<b>${kindLabel(rel.type)}</b></span>${escapeHTML(short)}</a>`;
  }).join('');
  const relatedHtml = relatedLinks
    ? `<section class="d-related"><h2 class="d-section-title">Related listings</h2><div class="d-related-list">${relatedLinks}</div></section>`
    : '';
  // Contextual link to the long-form exam guides. Without this the guides are
  // orphans: they sit in sitemap.xml but no page links to them, so crawlers
  // reach them with no context and no internal PageRank.
  const guideLinks = GUIDES
    .filter(entry => entry.test(item))
    .map(entry => `<section class="d-related d-guide-link"><h2 class="d-section-title">${icon('info', 'd-ic d-index-h-ic')}Deeper guide</h2><div class="d-related-list"><a class="d-rel" href="../../${entry.href}"><span class="d-rel-tag">${icon('folder', 'd-ic d-rel-ic')}<b>Guide</b></span>${escapeHTML(entry.label)}</a></div></section>`)
    .join('');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | SarkariJobs+</title><meta name="description" content="${escapeHTML(descriptionFor(item, kind))}">
<meta name="theme-color" content="#0a1128">
<meta property="og:title" content="${title} | SarkariJobs+"><meta property="og:description" content="${escapeHTML(descriptionFor(item, kind))}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article"><meta property="og:site_name" content="SarkariJobs+">
<link rel="canonical" href="${canonical}">${faqLd}${breadcrumbLd}<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><script src="../../js/analytics-config.js?v=20261022"></script><script src="../../js/analytics.js" defer></script><link rel="stylesheet" href="../../css/style.css"><link rel="stylesheet" href="../../css/detail.css?v=d7">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20'%3E%3Crect width='30' height='7' fill='%23FF9933'/%3E%3Crect y='7' width='30' height='6' fill='%23fff'/%3E%3Crect y='13' width='30' height='7' fill='%23138808'/%3E%3Ccircle cx='15' cy='10' r='2.4' fill='none' stroke='%2306038D' stroke-width='1'/%3E%3C/svg%3E">
</head>
<body>
${iconSprite()}
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
<nav class="d-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a><span class="d-sep" aria-hidden="true"></span><a href="../../${type === 'result' ? 'results.html' : type === 'admit' ? 'admit-cards.html' : 'category.html'}">${escapeHTML(kind)} listings</a></nav>
<div class="d-hero-top">${markFor(item)}<span class="d-ribbon${ribbonCls}">${icon(kindId, 'd-ic d-ribbon-ic')}<span>${escapeHTML(kind)}</span></span></div>
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
<div class="d-caution">${icon('alert', 'd-ic d-caution-ic')}<p>${escapeHTML(guide.caution)}</p></div>
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
${guideLinks}
${relatedHtml}
<nav class="d-discover" aria-label="Explore the site">
<a class="d-disc" href="../../category.html"><span class="d-disc--icon">${icon('bell', 'd-ic d-disc-ic')}</span><span class="d-disc--label">Browse notifications</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
<a class="d-disc" href="../../results.html"><span class="d-disc--icon">${icon('result', 'd-ic d-disc-ic')}</span><span class="d-disc--label">Latest results</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
<a class="d-disc" href="../../admit-cards.html"><span class="d-disc--icon">${icon('admit', 'd-ic d-disc-ic')}</span><span class="d-disc--label">Admit cards</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
<a class="d-disc" href="../../state.html"><span class="d-disc--icon">${icon('map', 'd-ic d-disc-ic')}</span><span class="d-disc--label">State-wise jobs</span><span class="d-disc--arrow" aria-hidden="true"></span></a>
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
<li><a href="../../all-jobs.html">All listings (A–Z)</a></li>
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
  if (!canonicalOf.has(slug)) urls.push(`<url><loc>${canonical}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
}

// ---- Remove pages that should never have been published ----
// The deploy uploads files and never deletes them (delete: 'false'), so a page
// that stops being generated keeps serving its old HTML at HTTP 200 forever.
// Deleting the local file therefore fixes nothing: the remote copy survives.
//
// scraper/retired-slugs.json is the committed record of every URL the tracker
// has ever published and since dropped. Entries flagged `stub: true` are the
// ones that should not exist at all — navigational pages imported from
// competitor indexes (browse hubs, "Post New Jobs", two Tamil nav links, a
// competitor's own brand page). Each is rewritten into a small noindexed stub
// pointing at the live index, which replaces the stale remote HTML without
// touching .htaccess or the deploy workflow.
//
// Real listings that merely rotated out of the feed are NOT stubbed: they keep
// their content, and they are already absent from sitemap.xml and from every
// internal link, so they decay out of the index on their own.
const retiredPath = path.join(__dirname, 'retired-slugs.json');
const builtSlugs = new Set(entries.map(entry => entry.slug));
const retiredRecords = fs.existsSync(retiredPath) ? JSON.parse(fs.readFileSync(retiredPath, 'utf8')) : [];

// A listing can drop out of the feed because a scrape for that source failed,
// not because the notice is gone: data/jobs.json sets "partial": true and the
// per-source error list is long. Stubbing on the first absence would therefore
// replace a live page with a "withdrawn" notice over a transient network error.
//
// So absence has to be confirmed across consecutive builds before the page is
// retired. scraper/retired-state.json counts them, and the counter resets the
// moment the slug reappears in the feed.
const ABSENCE_BUILDS_BEFORE_RETIREMENT = 3;
const SHRINK_GUARD = 0.9; // a feed this much smaller than the baseline is a partial scrape
const retiredStatePath = path.join(__dirname, 'retired-state.json');
let retiredState = {};
try { retiredState = JSON.parse(fs.readFileSync(retiredStatePath, 'utf8')); } catch { }
const nextRetiredState = {};

// A feed that has shrunk sharply is missing whole sources (data/jobs.json sets
// "partial": true and lists per-source errors), so absences in it prove nothing.
// In that build, hold the counters still rather than counting a network failure
// towards retirement.
const baseline = Number(retiredState.baseline) || entries.length;
const shrunken = entries.length < baseline * SHRINK_GUARD;
if (entries.length > baseline) nextRetiredState.baseline = entries.length;
else if (!shrunken) nextRetiredState.baseline = baseline;

// Live pages indexed by normalised title, so a retired URL that is really the
// same notice under an older slug can be consolidated into it. The feed
// re-issues records with new ids, which leaves the previous slug stranded with
// identical content — about 50 of the retired URLs are exactly this.
const liveByTitle = new Map();
for (const entry of primaryEntries) {
  const key = normalizeTitle(entry.item.title);
  if (key && !liveByTitle.has(key)) liveByTitle.set(key, entry);
}

const stubs = [];
const pending = [];
for (const record of retiredRecords) {
  if (!record?.slug) continue;
  if (builtSlugs.has(record.slug)) { delete nextRetiredState[record.slug]; continue; }
  if (record.stub) { stubs.push({ slug: record.slug, kind: 'junk' }); continue; }

  const match = liveByTitle.get(normalizeTitle(record.title));
  // A retired copy of a notice that is still live is safe to retire immediately:
  // the reader is sent to a current page, so nothing is lost.
  if (match) { stubs.push({ slug: record.slug, kind: 'duplicate', target: match.slug }); continue; }

  const count = shrunken
    ? (retiredState[record.slug] || 0) // hold, do not advance
    : (retiredState[record.slug] || 0) + 1;
  nextRetiredState[record.slug] = count;
  if (count >= ABSENCE_BUILDS_BEFORE_RETIREMENT) stubs.push({ slug: record.slug, kind: 'gone' });
  else pending.push(record.slug);
}

const stubSlugs = stubs.map(stub => stub.slug);
// A truncated feed must never be able to blank the site, so refuse to act on a
// suspiciously large set. Confirmed retirements are exempt from the ratio cap:
// they are historical, already validated over several builds, and bounded by the
// size of retired-slugs.json.
const confirmed = stubs.filter(stub => stub.kind === 'gone').length;
const unconfirmed = stubSlugs.length - confirmed;
if (unconfirmed > Math.max(20, Math.floor(entries.length * 0.15))) {
  throw new Error(`Refusing to stub ${unconfirmed} pages: the feed looks truncated, so this build is probably incomplete.`);
}
const stubPage = ({ kind, target }) => {
  const duplicate = kind === 'duplicate';
  const junk = kind === 'junk';
  const canonicalUrl = duplicate
    ? `https://sarkarijobsplus.com/job-details/${target}/`
    : 'https://sarkarijobsplus.com/all-jobs.html';
  const lead = duplicate
    ? 'The tracker republished this notice under a newer URL, so this copy has been retired and points at the current page. Nothing here should be relied on for dates, fees or eligibility.'
    : junk
      ? 'It was never a recruitment notice — the source published a browsing page rather than a post — so it has been removed from the tracker. Nothing here should be relied on for dates, fees or eligibility.'
      : 'It has dropped out of the feed SarkariJobs+ follows, so the summary that used to be here would be out of date. Nothing here should be relied on for dates, fees or eligibility.';
  const kicker = duplicate ? 'Listing moved' : junk ? 'Listing withdrawn' : 'Listing retired';
  const heading = duplicate
    ? 'This listing has moved to a newer page'
    : junk ? 'This listing is no longer tracked' : 'This listing has been retired';
  const howto = duplicate
    ? 'The current page opens automatically in a few seconds, or use the link below.'
    : 'The current official listings are all on the index page. Use the link below; this page also redirects there automatically in a few seconds.';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${duplicate ? 'This listing has moved' : junk ? 'Listing no longer tracked' : 'This listing has been retired'} | SarkariJobs+</title>
<meta name="robots" content="noindex, follow">
<meta name="description" content="This URL has been retired. Open the current SarkariJobs+ page for this notice, or browse every live listing.">
<link rel="canonical" href="${canonicalUrl}">
<meta http-equiv="refresh" content="3;url=${canonicalUrl}">
<meta name="theme-color" content="#0a1128">
<link rel="stylesheet" href="../../css/detail.css?v=d7">
</head><body>
${iconSprite()}
<div class="tricolor-strip"></div>
<main class="d-wrap" style="max-width:720px;margin:0 auto;padding:48px 20px">
<p class="d-kicker">${kicker}</p>
<h1>${heading}</h1>
<p class="d-lead">${lead}</p>
<h2 class="d-section-title">How to use this page</h2>
<p>${howto}</p>
<p><a class="d-disc" href="${duplicate ? `../${target}/` : '../../all-jobs.html'}"><span class="d-disc--icon">${icon(duplicate ? 'info' : 'folder', 'd-ic d-disc-ic')}</span><span class="d-disc--label">${duplicate ? 'Open the current page for this notice' : 'All current listings (A–Z)'}</span><span class="d-disc--arrow" aria-hidden="true"></span></a></p>
<p style="font-size:.85rem;color:#4a5677">If you reached this page from a bookmark, search the index for the authority name — the same recruitment is often republished under a newer notice.</p>
</main>
</body></html>`;
};
for (const stub of stubs) {
  const directory = path.join(output, stub.slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), stubPage(stub));
}

// ---- Crawlable full index (/all-jobs.html) ----
// One plain-HTML page listing every published listing as a real <a> link. This
// is the entry point crawlers use to reach all detail pages even though the
// JavaScript hubs expose no detail links in their HTML source.
const groups = [
  { type: 'job', title: 'Job notifications', anchor: 'jobs' },
  { type: 'admit', title: 'Admit cards', anchor: 'admit-cards' },
  { type: 'result', title: 'Results', anchor: 'results' }
];
const byType = type => primaryEntries
  .filter(entry => entry.type === type)
  .sort((a, b) => String(a.item.title || '').localeCompare(String(b.item.title || '')));
const jumpLinks = groups
  .map(group => `<a href="#${group.anchor}">${icon(group.type, 'd-ic d-jump-ic')}${group.title} <span class="d-jump-count">${byType(group.type).length}</span></a>`)
  .join('');
const groupBlocks = groups.map(group => {
  const rows = byType(group.type).map(entry => {
    const text = String(entry.item.title || '').replace(/\s+/g, ' ').trim();
    return `<a class="d-rel${kindClass(group.type)}" href="job-details/${entry.slug}/"><b>${kindLabel(group.type)}</b>${escapeHTML(text)}</a>`;
  }).join('\n');
  return `<section class="d-index-group" id="${group.anchor}"><h2 class="d-section-title">${icon(group.type, 'd-ic d-index-h-ic')}${group.title}</h2><p class="d-index-count">${byType(group.type).length} live listings, in alphabetical order. Each opens the full summary and the official source link.</p><div class="d-related-list">\n${rows}\n</div></section>`;
}).join('\n');
const indexCanonical = 'https://sarkarijobsplus.com/all-jobs.html';
const indexLd = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sarkarijobsplus.com/' },
    { '@type': 'ListItem', position: 2, name: 'All listings', item: indexCanonical }
  ]
}).replace(/</g, '\\u003c')}</script>`;
const indexHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>All government job listings, admit cards and results | SarkariJobs+</title><meta name="description" content="Complete index of every live government job notification, admit card and result tracked by SarkariJobs+ — ${entries.length} listings, each with key dates and the official source link.">
<meta name="theme-color" content="#0a1128">
<meta property="og:title" content="All government job listings, admit cards and results | SarkariJobs+"><meta property="og:description" content="Complete index of ${entries.length} live listings — jobs, admit cards and results — with key dates and official source links."><meta property="og:url" content="${indexCanonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="SarkariJobs+">
<link rel="canonical" href="${indexCanonical}">${indexLd}<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><script src="js/analytics-config.js?v=20261022"></script><script src="js/analytics.js" defer></script><link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="css/detail.css?v=d6">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20'%3E%3Crect width='30' height='7' fill='%23FF9933'/%3E%3Crect y='7' width='30' height='6' fill='%23fff'/%3E%3Crect y='13' width='30' height='7' fill='%23138808'/%3E%3Ccircle cx='15' cy='10' r='2.4' fill='none' stroke='%2306038D' stroke-width='1'/%3E%3C/svg%3E">
</head>
<body>
${iconSprite()}
<div class="tricolor-strip"></div>
<header><div class="container nav-wrap">
<a class="logo" href="./"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<nav><ul>
<li><a href="category.html">Notifications</a></li>
<li><a href="results.html">Results</a></li>
<li><a href="admit-cards.html">Admit cards</a></li>
<li><a href="state.html">States</a></li>
</ul></nav>
<a class="btn btn-primary" href="results.html" style="padding:9px 18px;font-size:.88rem">Latest results</a>
</div></header>
<main class="d-main">
<section class="d-hero">
<nav class="d-crumbs" aria-label="Breadcrumb"><a href="./">Home</a><span class="d-sep" aria-hidden="true"></span><span>All listings</span></nav>
<span class="d-ribbon">Index</span>
<h1>Every listing on SarkariJobs+</h1>
<div class="d-chiprow"><span class="d-chip">${icon('bell', 'd-ic d-chip-ic')}${entries.length} live listings</span><span class="d-chip">${icon('folder', 'd-ic d-chip-ic')}Jobs, admit cards, results</span><span class="d-chip">${icon('open', 'd-ic d-chip-ic')}Official source on every page</span></div>
<p class="d-lead" style="margin-top:14px">Plain-HTML index of everything the tracker currently follows. Use it to jump straight to a listing instead of scrolling the filterable hubs. Dates, fees and vacancy counts are summarised from the recruiting authority's own notice — always confirm on the official page before applying.</p>
</section>
<section class="d-index-jump" aria-label="Jump to a section">${jumpLinks}</section>
${groupBlocks}
<section class="d-attrib">
<h2>Source attribution</h2>
<p class="d-attrib-note">SarkariJobs+ is an independent information site and is not a recruiting authority. Every listing here links the official notice or portal. Where a source did not state a date, fee or vacancy count, the field is left empty rather than estimated.</p>
</section>
</main>
<footer class="d-foot"><div class="container foot-grid">
<div class="foot-brand"><a class="logo" href="./" style="color:#fff"><span class="logo-flag"></span>Sarkari<span style="color:var(--saffron)">Jobs</span><span style="color:var(--green)">+</span></a>
<p class="foot-note">Independent tracker for government job notifications, results and admit cards across India — always linking the recruiting authority's own portal.</p></div>
<div><h4>Explore</h4><ul>
<li><a href="category.html">Notifications</a></li>
<li><a href="results.html">Results</a></li>
<li><a href="admit-cards.html">Admit cards</a></li>
<li><a href="state.html">State-wise</a></li>
<li><a href="all-jobs.html">All listings (A–Z)</a></li>
</ul></div>
<div><h4>Information</h4><ul>
<li><a href="about.html">About SarkariJobs+</a></li>
<li><a href="editorial-policy.html">Editorial policy</a></li>
<li><a href="privacy.html">Privacy policy</a></li>
<li><a href="contact.html">Contact us</a></li>
</ul></div>
</div>
<p style="font-size:.82rem;line-height:1.7;max-width:640px;margin:0 auto;padding:0 0 18px;">SarkariJobs+ is an independent information site and is not a recruiting authority. Original SarkariJobs+ summaries and page layout © 2026 SarkariJobs+.</p>
<div class="foot-strip"></div>
</footer>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'all-jobs.html'), indexHtml);

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
for (const rel of ['about.html', 'editorial-policy.html', 'privacy.html', 'contact.html', 'all-jobs.html']) {
  const fileHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel)).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
  const prevState = lastmodState[`page:${rel}`];
  const lastmod = prevState && prevState.hash === fileHash ? (prevState.lastmod || null) : feedDate;
  nextLastmodState[`page:${rel}`] = { hash: fileHash, lastmod };
  const loc = `https://sarkarijobsplus.com/${rel}`;
  const pattern = new RegExp(`<url>\\s*<loc>${sitemapRescape(loc)}</loc>\\s*(?:<lastmod>[\\d-]{10}</lastmod>\\s*)?</url>`);
  if (pattern.test(sitemap)) sitemap = sitemap.replace(pattern, '');
  if (lastmod) staticPageBlocks.push(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`);
}
// Sector guide pages (guides/*). Generated from scraper/sectors/*.json and
// folded into this build so one script produces the whole crawlable site.
const guidePages = buildGuides({
  ROOT,
  payload,
  helpers: { escapeHTML, date, feedDate, typeOf, listingType, isNonRecruitmentPage, slugFor }
});

sitemap = sitemap.replace('</urlset>', `${urls.join('\n')}${staticPageBlocks.length ? '\n' + staticPageBlocks.join('\n') : ''}\n</urlset>`);

// Guide pages get the same change-aware treatment as the prose pages: <lastmod>
// moves only when the generated HTML actually changes, so a rebuild that pulled
// no new listing does not falsely bump every guide.
const guidePageBlocks = [];
for (const page of guidePages) {
  const fileHash = crypto.createHash('sha1').update(fs.readFileSync(page.file).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
  const key = `page:${page.rel}`;
  const prevState = lastmodState[key];
  const lastmod = prevState && prevState.hash === fileHash ? (prevState.lastmod || null) : feedDate;
  nextLastmodState[key] = { hash: fileHash, lastmod };
  if (!lastmod) continue;
  const loc = `https://sarkarijobsplus.com/${page.rel}`;
  const pattern = new RegExp(`<url>\\s*<loc>${sitemapRescape(loc)}</loc>\\s*(?:<lastmod>[\\d-]{10}</lastmod>\\s*)?</url>`);
  if (pattern.test(sitemap)) sitemap = sitemap.replace(pattern, '');
  guidePageBlocks.push(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`);
}
if (guidePageBlocks.length) {
  sitemap = sitemap.replace('</urlset>', `${guidePageBlocks.join('\n')}\n</urlset>`);
}

// Canonical serialization independent of the previous file's formatting:
// every <url> block on its own compact line, so repeated builds are
// byte-stable and the deployed file equals the committed one. Stray CR bytes
// from CRLF checkouts are dropped so every line ends uniformly in LF.
const opening = rawSitemap.slice(0, rawSitemap.indexOf('<url>')).replace(/\s+$/, '\n').replace(/\r/g, '');
const blocks = (sitemap.replace(/\r/g, '').match(/<url>[\s\S]*?<\/url>/g) || []);
fs.writeFileSync(sitemapPath, `${opening}${blocks.join('\n')}\n</urlset>\n`);
// Retired slugs no longer produce a page, so keeping their lastmod entry would
// only grow the state file forever.
for (const slug of stubSlugs) delete nextLastmodState[slug];
fs.writeFileSync(lastmodStatePath, JSON.stringify(nextLastmodState, null, 2) + '\n');
// Persist the absence counters so retirement survives across builds, and so a
// listing that reappears (partial feed, fixed scrape) resets instead of being
// retired on the strength of an earlier outage.
fs.writeFileSync(retiredStatePath, JSON.stringify(nextRetiredState, null, 2) + '\n');

// A previous feed imported a third-party privacy-policy page as an admit card.
// Redirect its retired URL to the real first-party policy page after deployment.
const retiredPrivacyPage = path.join(output, 'privacy-policy-1f1c4eba');
fs.mkdirSync(retiredPrivacyPage, { recursive: true });
fs.writeFileSync(path.join(retiredPrivacyPage, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://sarkarijobsplus.com/privacy.html"><meta http-equiv="refresh" content="0;url=../../privacy.html"><title>Privacy policy | SarkariJobs+</title></head><body><p>This page has moved to our <a href="../../privacy.html">privacy policy</a>.</p></body></html>`);
console.log(`Generated ${urls.length} individual detail pages and updated sitemap.xml.`);
