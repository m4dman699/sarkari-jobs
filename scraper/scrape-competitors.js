/**
 * Competitor enrichment for the SarkariJobs+ feed.
 *
 * Sources are long-running public competitors that publish a broad index of
 * Indian government job, admit-card and result notices:
 *   - SarkariResult.com (Since 2012)
 *   - FreeJobAlert.com
 *
 * The script does three things:
 *   1. Reads the latest listing indexes from those sources.
 *   2. Merges missing facts (dates, organisation, vacancies, eligibility, fee,
 *      official links) into existing feed records without overwriting facts the
 *      official scraper already established.
 *   3. Imports genuinely new listings that the official portals missed.
 *
 * Every imported record keeps its competitor provenance (`publisher`,
 * `sourceListingUrl`, `discoveredVia`, `factSource`) and prefers the recruiting
 * authority's own link. Original SarkariJobs+ wording is generated later by
 * `build-detail-pages.js`; competitor prose is never copied into the feed.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { classifyJob, isStale, isGenericJobTitle } = require('./sources');

const ROOT = path.join(__dirname, '..');
const FEED = path.join(ROOT, 'data', 'jobs.json');
const DETAIL_CACHE = path.join(__dirname, 'competitor-detail-cache.json');
const GAP_REPORT = path.join(__dirname, 'competitor-gap-report.json');

const DETAIL_WORKERS = 5;
const DETAIL_TIMEOUT_MS = 10000;
const DETAIL_BUDGET = Number(process.env.COMPETITOR_DETAIL_BUDGET || 220);
const CACHE_TTL_MS = 20 * 60 * 60 * 1000;

const COMPETITOR_SOURCES = [
  {
    id: 'sarkariresult',
    name: 'SarkariResult.com',
    publisher: 'SarkariResult.com',
    sections: [
      { type: 'job', url: 'https://www.sarkariresult.com/latestjob/', max: 350 },
      { type: 'admit-card', url: 'https://www.sarkariresult.com/admitcard/', max: 100 },
      { type: 'result', url: 'https://www.sarkariresult.com/result/', max: 100 }
    ]
  },
  {
    id: 'freejobalert',
    name: 'FreeJobAlert.com',
    publisher: 'FreeJobAlert',
    sections: [
      { type: 'job', url: 'https://www.freejobalert.com/government-jobs/', max: 60 },
      { type: 'admit-card', url: 'https://www.freejobalert.com/admit-card/', max: 15 },
      { type: 'result', url: 'https://www.freejobalert.com/exam-results/', max: 15 }
    ]
  }
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_PART = String.raw`\d{1,2}[./-]\d{1,2}[./-]20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2}|[A-Za-z]+\s+\d{1,2},?\s+20\d{2}`;

function plain(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function cleanText(value) {
  return plain(value)
    .replace(/\uFFFD\?~/g, '\u2019')
    .replace(/\uFFFD\?T/g, '\u2019')
    .replace(/\uFFFD\?/g, '\u2013')
    .replace(/\uFFFD/g, '')
    .trim();
}

function parseDate(text) {
  const value = String(text || '');
  let match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (match) {
    return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }
  match = value.match(/(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+(20\d{2})/i);
  if (match) {
    return `${match[3]}-${String(MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }
  match = value.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})/i);
  if (match) {
    return `${match[3]}-${String(MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
  }
  return null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function canonicalTitle(value) {
  return normalizeTitle(value)
    .replace(/\bsci\b/g, 'supreme court')
    .replace(/\b(?:online|form|apply|application|recruitment|notification|vacancy|vacancies|various|post|posts|last|date|today|tomorrow|closing|soon|out|now|updated|update|start|started|available|released|release|declared|download|link|official|website|details|check|here|new|latest|advt|adv|no)\b/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return canonicalTitle(value).split(' ').filter(word => word.length >= 3 && !/^\d+$/.test(word));
}

function editDistance(a, b) {
  if (a === b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = temp;
    }
  }
  return previous[b.length];
}

function tokenMatches(a, b) {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && Math.abs(a.length - b.length) <= 1) return editDistance(a, b) <= 1;
  return false;
}

function tokenSimilarity(aTokens, bTokens) {
  const first = new Set(aTokens);
  const second = new Set(bTokens);
  if (!first.size || !second.size) return { score: 0, shared: 0 };
  let shared = 0;
  const used = new Set();
  for (const left of first) {
    for (const right of second) {
      if (used.has(right)) continue;
      if (tokenMatches(left, right)) {
        shared++;
        used.add(right);
        break;
      }
    }
  }
  const union = first.size + second.size - shared;
  return { score: union ? shared / union : 0, shared };
}

function hasConflictingQualifiers(a, b) {
  const groups = [
    [/\b(?:10\+2|12th|intermediate|undergraduate|ug)\b/i, /\b(?:graduate|degree|post\s*graduate|pg)\b/i],
    [/\b(?:prt|primary\s*teacher)\b/i, /\b(?:tgt|pgt|lecturer|professor)\b/i],
    [/\b(?:je|junior\s*engineer)\b/i, /\b(?:ae|assistant\s*engineer)\b/i]
  ];
  return groups.some(([first, second]) => (first.test(a) && second.test(b)) || (second.test(a) && first.test(b)));
}

function listingType(title) {
  if (/admit\s*card|call\s*letter|hall\s*ticket|e-admit/i.test(title)) return 'admit-card';
  if (/\bresults?\b|merit\s*list|score\s*card|answer\s*key|cut[ -]?off|selection\s*list|eligible\s*list|shortlist|exam\s*(?:date|city)|interview\s*(?:date|schedule)/i.test(title)) return 'result';
  return 'job';
}

function cleanListingTitle(value) {
  return cleanText(value)
    .replace(/\s*\|\s*Last\s*(?:Date)?\s*:?\s*.*$/i, '')
    .replace(/\s*\|\s*\d{1,2}[./-]\d{1,2}[./-]20\d{2}\s*$/i, '')
    .replace(/\s*[-–]\s*Last\s*Date\s*(?:Today|Tomorrow|:?\s*\d{1,2}[./-]\d{1,2}[./-]20\d{2}).*$/i, '')
    .replace(/\s*\|\s*(?:Apply\s*Now|Closing\s*Soon)\s*$/i, '')
    // Drop any trailing pipe segment that contains unrecoverable encoding damage.
    .replace(/\s*\|[^|]*\uFFFD[\s\S]*$/, '')
    .replace(/^[|\s]+|[|\s]+$/g, '')
    .replace(/^\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastDateFromListing(raw) {
  const text = plain(raw);
  const numeric = text.match(/Last\s*(?:Date)?\s*:?\s*(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/i);
  if (numeric) return parseDate(`${numeric[1]}/${numeric[2]}/${numeric[3]}`);
  const named = text.match(/Last\s*(?:Date)?\s*:?\s*(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i);
  if (named) return parseDate(named[1]);
  // Listings like "… Online Form 2026 | 30/07/2026" carry the last date in a bare
  // trailing pipe segment.
  const trailing = text.match(/\|\s*(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\s*$/i);
  if (trailing) return parseDate(`${trailing[1]}/${trailing[2]}/${trailing[3]}`);
  if (/Last\s*(?:Date)?\s*:?\s*Today/i.test(text)) return todayISO();
  if (/Last\s*(?:Date)?\s*:?\s*Tomorrow/i.test(text)) {
    return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  }
  return null;
}

function isNonRecruitmentPage(title, url = '') {
  const normalized = normalizeTitle(title);
  return /^(?:privacy policy|about(?: us)?|contact(?: us)?|disclaimer|terms(?: and conditions)?|sitemap|advertise(?: with us)?|faq|sarkari ?result(?: com(?: cm)?)?|classified jobs|find (?:domestic|international) jobs(?: e migrate)?|advisories for international jobseekers?|jobs in (?:health|government) sector|jobs for (?:differently abled|ex servicemen)|find career center|post new jobs|recruitment agencies(?: international employer)?|career schemes|interview results?|exam results?|admit cards?|answer keys?|syllabus|exam pattern)$/.test(normalized)
    || /\/(?:privacy-policy|about-us|contact-us|disclaimer|terms-and-conditions|sitemap)(?:\/|$)/i.test(url);
}

function inferState(title) {
  const text = String(title || '');
  const rules = [
    ['Andhra Pradesh', /\bandhra\s*pradesh\b|\bappsc\b|\bap\s*(?:psc|police|ssc)\b/i],
    ['Arunachal Pradesh', /\barunachal\b|\bappsc\s*arunachal\b/i],
    ['Assam', /\bassam\b|\bapsc\b|\badre\b/i],
    ['Bihar', /\bbihar\b|\bbpsc\b|\bbtsc\b|\bcsbc\b/i],
    ['Chhattisgarh', /\bchhattisgarh\b|\bcg\s*vyapam\b|\bcgpsc\b/i],
    ['Delhi', /\bdelhi\b|\bdsssb\b|\bdsiidc\b/i],
    ['Goa', /\bgoa\b/i],
    ['Gujarat', /\bgujarat\b|\bgpsc\b|\bgpssb\b|\bgsseb\b/i],
    ['Haryana', /\bharyana\b|\bhssc\b|\bhpsc\b/i],
    ['Himachal Pradesh', /\bhimachal\b|\bhppsc\b|\bhpssb\b/i],
    ['Jammu & Kashmir', /\bjammu\b|\bkashmir\b|\bjkpsc\b|\bjk\b/i],
    ['Jharkhand', /\bjharkhand\b|\bjpsc\b|\bjssc\b/i],
    ['Karnataka', /\bkarnataka\b|\bkpsc\b|\bkea\b/i],
    ['Kerala', /\bkerala\b|\bkeralapsc\b|\bksc\b/i],
    ['Madhya Pradesh', /\bmadhya\s*pradesh\b|\bmppsc\b|\bmpesb\b|\bmp\s*(?:police|high court|psc)\b/i],
    ['Maharashtra', /\bmaharashtra\b|\bmpsc\b|\bmaha\s*ssc\b/i],
    ['Manipur', /\bmanipur\b/i],
    ['Meghalaya', /\bmeghalaya\b/i],
    ['Mizoram', /\bmizoram\b/i],
    ['Nagaland', /\bnagaland\b/i],
    ['Odisha', /\bodisha\b|\borissa\b|\bopsc\b|\bossc\b/i],
    ['Puducherry', /\bpuducherry\b|\bpondicherry\b/i],
    ['Punjab', /\bpunjab\b|\bppsc\b|\bpsssb\b/i],
    ['Rajasthan', /\brajasthan\b|\brpsc\b|\brsmssb\b|\brrb\s*rajasthan\b/i],
    ['Sikkim', /\bsikkim\b/i],
    ['Tamil Nadu', /\btamil\s*nadu\b|\btnpsc\b|\btnusrb\b/i],
    ['Telangana', /\btelangana\b|\btgpsc\b|\btspsc\b/i],
    ['Tripura', /\btripura\b|\btpsc\b/i],
    ['Uttar Pradesh', /\buttar\s*pradesh\b|\bupsssc\b|\buppsc\b|\buppbpb\b|\bup\s*(?:police|psc|sssc|board|anganwadi|cooperative)\b/i],
    ['Uttar Pradesh', /\bUP\b/],
    ['Uttarakhand', /\buttarakhand\b|\bukpsc\b|\buk\b/i],
    ['West Bengal', /\bwest\s*bengal\b|\bwbpsc\b|\bwb\s*police\b/i]
  ];
  for (const [state, pattern] of rules) {
    if (pattern.test(text)) return state;
  }
  if (/\b(?:railway|rrb|ibps|sbi|rbi|ssc|upsc|supreme\s*court|high\s*court|army|navy|air\s*force|coast\s*guard|itbp|bsf|cisf|crpf|nia|ongc|bhel|isro|drdo|lic|nicl|uiic|national\s*insurance|india\s*post|ecgc|nabard)\b/i.test(text)) {
    return 'All India';
  }
  return 'See linked notice';
}

function hostOf(value) {
  try {
    return new URL(String(value || '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isCompetitorHost(host) {
  return /(?:^|\.)(?:sarkariresult\.com(?:\.cm)?|freejobalert\.com|sarkaridon\.com|sarkariexam\.com)$/i.test(host);
}

function fetchHTML(url, timeoutMs = DETAIL_TIMEOUT_MS) {
  return fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(timeoutMs)
  }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
}

/**
 * Extract structured facts from a SarkariResult or FreeJobAlert detail page.
 * The two sites use different layouts but both expose the same facts in tables.
 */
function parseDetail($, type = 'job') {
  const article = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
  article.find('script,style,noscript,iframe,form').remove();
  const text = plain(article.text());
  const h1 = plain($('h1').first().text());

  const pairs = [];
  article.find('tr').each((_, tr) => {
    const cells = $(tr).find('td,th').map((_, cell) => plain($(cell).text())).get();
    if (cells.length >= 2 && cells[0] && cells[1]) pairs.push({ label: cells[0], value: cells.slice(1).join(' ') });
  });
  const pairValue = (pattern) => {
    const found = pairs.find(pair => pattern.test(pair.label));
    return found ? found.value : '';
  };
  const dateFromPair = (pattern) => parseDate(pairValue(pattern));

  const publishedDate = dateFromPair(/notification release date|post date|update date/i)
    || parseDate((text.match(/Post\s*Date\s*\/?\s*Update\s*:\s*([^|]{6,40})/i) || [])[1] || '')
    || parseDate((text.match(/Updated\s+([A-Za-z]+\s+\d{1,2},?\s+20\d{2})/i) || [])[1] || '');
  const openDate = dateFromPair(/application (?:begin|start)|online application start/i)
    || parseDate((text.match(/Application\s+(?:Begin|Start(?:s| Date)?)\s*:\s*(.{6,30}?)(?=\s*(?:Last Date|Pay|$))/i) || [])[1] || '');
  const lastDate = dateFromPair(/application last date|last date to apply|last date for apply|last date of application/i)
    // Capture generously and let parseDate find the first date in the fragment;
    // strict lookaheads break on dates followed by other labels.
    || parseDate((text.match(/Last\s*Date\s*(?:for\s*)?(?:Apply\s*Online|to\s*Apply(?:\s*Online)?|of\s*Application)?\s*:\s*([^a-z]{6,40})/i) || [])[1] || '');

  const milestones = [];
  const seen = new Set();
  const addMilestone = (label, value) => {
    const date = parseDate(value);
    if (!date) return;
    const cleanLabel = plain(label).replace(/[:\-–]+$/, '').trim();
    if (!cleanLabel || cleanLabel.length > 70) return;
    if (/short information|www\.|sarkari\s*result|apply\s*online\s*for|notification\s*\d{4}\s*apply/i.test(cleanLabel)) return;
    if (!/date|result|score|answer|admit|exam|interview|merit|document|verification|available|release|declared|city|cut.?off/i.test(cleanLabel)) return;
    const key = `${cleanLabel.toLowerCase()}|${date}`;
    if (seen.has(key)) return;
    seen.add(key);
    milestones.push({ label: cleanLabel, date, dateText: plain(value).slice(0, 90) });
  };
  for (const pair of pairs) addMilestone(pair.label, pair.value);

  const datesSection = (text.match(/Important\s+Dates\s+(.{0,1400}?)(?=Application\s+Fee|Age\s+Limit|Vacancy\s+Details|$)/i) || [])[1] || '';
  const labelPattern = new RegExp(`([A-Za-z][A-Za-z0-9/&().\\- ]{2,60}?)\\s*:\\s*(${DATE_PART})`, 'g');
  let match;
  while ((match = labelPattern.exec(datesSection))) addMilestone(match[1], match[2]);

  const pickMilestone = (pattern) => milestones
    .filter(entry => pattern.test(entry.label))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const resultMilestone = pickMilestone(/\bresult\b|score\s*card|merit|answer\s*key/i);
  const examMilestone = pickMilestone(/exam\s*date|mains exam|pre exam|cbt|written exam/i);
  const admitMilestone = pickMilestone(/admit\s*card|call\s*letter/i);
  const interviewMilestone = pickMilestone(/interview/i);

  let ageLimit = '';
  const minAge = text.match(/Minimum\s*Age\s*:\s*(\d+)\s*Years?/i);
  const maxAge = text.match(/Maximum\s*Age\s*:\s*(\d+)\s*Years?/i);
  if (minAge && maxAge) ageLimit = `${minAge[1]}–${maxAge[1]} years`;
  else if (minAge) ageLimit = `Minimum ${minAge[1]} years`;
  else if (maxAge) ageLimit = `Maximum ${maxAge[1]} years`;
  else ageLimit = pairValue(/^age limit$/i);

  let vacancies = '';
  const totalMatch = text.match(/(?:Vacancy\s*Details\s*)?Total\s*:\s*([\d,]+)\s*(?:Post|Posts|Vacancy|Vacancies)/i);
  if (totalMatch) vacancies = totalMatch[1];
  else {
    const pair = pairValue(/total vacancies|vacancies|vacancy|total posts/i);
    if (pair) vacancies = (pair.match(/[\d,]+/) || [''])[0];
  }

  let eligibility = '';
  const qualification = pairValue(/qualification|eligibility/i);
  if (qualification && qualification.length > 8 && !/^total\b/i.test(qualification)) eligibility = qualification.slice(0, 500);
  if (!eligibility) {
    article.find('table').each((_, table) => {
      if (eligibility) return;
      let column = -1;
      $(table).find('tr').each((_, tr) => {
        if (eligibility) return;
        const cells = $(tr).find('td,th').map((_, cell) => plain($(cell).text())).get();
        if (column < 0) {
          const index = cells.findIndex(cell => /eligibility/i.test(cell));
          if (index >= 0) column = index;
          return;
        }
        const value = cells[column];
        if (value && value.length > 12 && !/^\d+$/.test(value) && !/click here/i.test(value)) {
          eligibility = value.slice(0, 500);
        }
      });
    });
  }

  let applicationFee = '';
  const feePair = pairValue(/application fee/i);
  if (feePair) applicationFee = feePair.slice(0, 350);
  else {
    const feeMatch = text.match(/Application\s*Fee\s+(.{5,400}?)(?=(?:Pay\s+the\s+Exam(?:ination)?\s+Fee|Fee\s+Mode\s+Only|Age\s+Limit|Vacancy\s+Details|Sarkari\s*Result|$))/i);
    if (feeMatch) applicationFee = plain(feeMatch[1]).slice(0, 350);
  }
  applicationFee = applicationFee
    .replace(/\s*(?:Pay\s+the\s+Exam(?:ination)?\s+Fee|Fee\s+Mode\s+Only)[\s\S]*$/i, '')
    .replace(/\s+(?:Age\s+Limit|Vacancy\s+Details|Sarkari\s*Result|[A-Z][A-Za-z ]{3,45}\s+20\d{2}\s*:)[\s\S]*$/, '')
    .slice(0, 320)
    .trim();

  let organization = pairValue(/^(?:organization|organisation|company name)$/i);
  if (!organization) {
    const shortInfo = text.match(/Short\s+Information\s+(.{2,220}?)\s+(?:has|have)\s+(?:released|invited|published|announced|issued|invites|is recruiting)/i);
    if (shortInfo) organization = plain(shortInfo[1]).replace(/[,:;\s]+$/, '');
  }
  if (!organization) {
    const orgMatch = text.match(/^(.{2,110}?)\s+(?:has|have)\s+(?:released|invited|published|announced|issued|invites|is recruiting)/i);
    if (orgMatch) organization = plain(orgMatch[1]).replace(/[,:;\s]+$/, '');
  }
  if (!organization) {
    organization = h1.replace(/\s*(?:recruitment|online form|notification|apply online|admit card|result|score card|exam).*$/i, '').trim();
  }

  const links = [];
  const seenLinks = new Set();
  const badHost = /sarkariresult\.com|sarkariresultportal\.com|freejobalert\.com|facebook\.com|twitter\.com|x\.com|t\.me|telegram|whatsapp|instagram|youtube|youtu\.be|play\.google|apple\.com|linkedin|google\.com/i;
  const badLabel = /tools|join|telegram|whatsapp|instagram|facebook|twitter|video|app\b|resizer|compress|calculator/i;
  const pushLink = (href, label) => {
    if (!href || !/^https?:\/\//i.test(href) || seenLinks.has(href) || badHost.test(href)) return;
    const cleanLabel = plain(label);
    if (badLabel.test(cleanLabel)) return;
    seenLinks.add(href);
    links.push({ url: href, label: cleanLabel });
  };
  article.find('tr').each((_, tr) => {
    const cells = $(tr).find('td,th').map((_, cell) => plain($(cell).text())).get();
    const label = cells[0] || '';
    const anchor = $(tr).find('a[href]').first();
    const href = anchor.attr('href');
    if (!href) return;
    if (!/apply|online|notification|admit|result|score|answer|merit|official website|download|interview|document|city|cut.?off/i.test(`${label} ${anchor.text()}`)) return;
    pushLink(href, label);
  });
  article.find('a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    const label = plain($(anchor).text());
    if (!href || !/click here|official website/i.test(label)) return;
    const rowLabel = plain($(anchor).closest('tr').find('td,th').first().text());
    if (rowLabel) pushLink(href, rowLabel);
  });

  const byLabel = (pattern) => links.find(link => pattern.test(link.label));
  const preferred = type === 'admit-card'
    ? (byLabel(/admit\s*card|call\s*letter/i) || byLabel(/download/i) || byLabel(/official website/i) || links[0])
    : type === 'result'
      ? (byLabel(/result|score\s*card|merit|answer\s*key/i) || byLabel(/official website/i) || links[0])
      : (byLabel(/apply\s*online|apply now|online form/i) || byLabel(/official website/i) || links[0]);
  const notification = byLabel(/notification|advertisement/i);

  return {
    organization,
    publishedDate,
    openDate,
    lastDate,
    examDate: examMilestone?.date || null,
    resultDate: resultMilestone?.date || null,
    admitCardDate: admitMilestone?.date || null,
    interviewDate: interviewMilestone?.date || null,
    vacancies,
    ageLimit,
    eligibility,
    applicationFee,
    milestones,
    officialLink: preferred?.url,
    notificationLink: notification?.url,
    officialLinks: links.slice(0, 10)
  };
}

// ---------------------------------------------------------------------------
// Legacy parser (kept for the one-off SarkariResult CSV audit script)
// ---------------------------------------------------------------------------

function extractMilestones($) {
  const milestones = [];
  const seen = new Set();
  $('li, p, td').each((_, node) => {
    const text = plain($(node).text());
    if (text.length > 190) return;
    const match = text.match(/^([^:–-]{3,75}?)\s*[:–-]\s*(.+)$/);
    if (!match) return;
    const label = plain(match[1]).replace(/\s+/g, ' ');
    const value = plain(match[2]);
    const date = parseDate(value);
    if (!date || !/date|result|answer\s*key|admit\s*card|exam|application|fee|interview|city|correction|merit|score|document|verification/i.test(label)) return;
    const key = `${label.toLowerCase()}|${date}`;
    if (seen.has(key)) return;
    seen.add(key);
    milestones.push({ label, date, dateText: value.slice(0, 90) });
  });
  return milestones;
}

async function legacyEnrichListing(item) {
  const $ = cheerio.load(await fetchHTML(item.link, 12000));
  const body = plain($('main').text() || $('article').text() || $('body').text());
  const intro = $('h1').first().nextAll('p').filter((_, node) => plain($(node).text()).length > 70).first();
  const summary = plain(intro.text()).slice(0, 420);
  const orgMatch = summary.match(/^(.{2,110}?)(?:,?\s+has released|,?\s+invites|,?\s+has invited|,?\s+has published|,?\s+has announced|,?\s+is recruiting)/i);
  const dateMatch = body.match(/Post\s*Date\s*:\s*([A-Za-z]+\s+\d{1,2},?\s+20\d{2})/i);
  const publishedDate = dateMatch ? parseDate(dateMatch[1]) : null;
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
      const host = url.hostname.toLowerCase();
      const trustedAuthorityHost = /\.(?:gov\.in|nic\.in|ac\.in)$/.test(host)
        || /(?:^|\.)rbi\.org\.in$/.test(host)
        || /(?:^|\.)sbi\.co\.in$/.test(host)
        || /(?:^|\.)ibps\.in$/.test(host)
        || /(?:^|\.)digialm\.com$/.test(host)
        || host === 'ongcindia.com' || host === 'www.ongcindia.com';
      const expiringSignedUrl = [...url.searchParams.keys()].some(key => /^(?:x-amz-signature|x-amz-credential|signature|token|expires)$/i.test(key));
      if (trustedAuthorityHost && !expiringSignedUrl && !official.some(link => link.url === url.href)) {
        const rowContext = plain($(node).closest('tr').text());
        const parentContext = plain($(node).parent().text());
        const context = rowContext.length > plain($(node).text()).length ? rowContext : parentContext;
        const label = context.length > 3 && context.length <= 120 ? context : plain($(node).text());
        official.push({ url: url.href, label: label || 'Official recruitment portal' });
      }
    } catch { /* Ignore malformed external links. */ }
  });
  const preferred = official.find(link => /result|answer key|admit card|download|apply|application|official website/i.test(link.label)) || official[0];
  const notification = official.find(link => /notification|advertisement/i.test(link.label));
  const milestones = extractMilestones($);
  const resultMilestone = milestones.filter(entry => /final result|result declare|result date|result released/i.test(entry.label)).at(-1);
  return {
    ...(orgMatch ? { organization: orgMatch[1].replace(/[,:;\s]+$/, '') } : {}),
    ...(publishedDate ? { publishedDate } : {}),
    ...(openDate ? { openDate } : {}),
    ...(ageMatch ? { ageLimit: `${ageMatch[1]}–${ageMatch[2]} years` } : {}),
    ...(vacancyMatch ? { vacancies: vacancyMatch[1] } : {}),
    ...(examMatch ? { examDate: parseDate(examMatch[1]) } : {}),
    ...(eligibility ? { eligibility } : {}),
    ...(applicationFee ? { applicationFee } : {}),
    ...(preferred ? { officialLink: preferred.url } : {}),
    ...(notification ? { notificationLink: notification.url } : {}),
    ...(official.length ? { officialLinks: official.slice(0, 8) } : {}),
    ...(milestones.length ? { milestones } : {}),
    ...(resultMilestone ? { resultDate: resultMilestone.date } : {})
  };
}

async function enrichListing(item) {
  const host = hostOf(item.link);
  if (/(?:^|\.)sarkariresult\.com$/i.test(host) || /(?:^|\.)freejobalert\.com$/i.test(host)) {
    const $ = cheerio.load(await fetchHTML(item.link, DETAIL_TIMEOUT_MS));
    return parseDetail($, item.type || 'job');
  }
  return legacyEnrichListing(item);
}

// ---------------------------------------------------------------------------
// Listing extraction
// ---------------------------------------------------------------------------

function extractSarkariResultListings($, section) {
  const listings = [];
  $('ul.sarkari-quick-list > li > a').each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (!href) return;
    let url;
    try { url = new URL(href, section.url); } catch { return; }
    if (!/(?:^|\.)sarkariresult\.com$/i.test(url.hostname)) return;
    if (/^\/(?:latestjob|admitcard|result|admission|syllabus|up-scholarship)\/?$/i.test(url.pathname)) return;
    const raw = plain($(anchor).text());
    const title = cleanListingTitle(raw);
    if (!title || title.length < 12 || isNonRecruitmentPage(title, url.pathname)) return;
    listings.push({
      title,
      url: url.href,
      lastDate: section.type === 'job' ? lastDateFromListing(raw) : null
    });
  });
  return listings;
}

function extractFreeJobAlertListings($, section) {
  const listings = [];
  const selector = section.type === 'job'
    ? 'td[class^="qlink"] a, div.fja-row a, div.fja-ldr-item a, li a'
    : 'td[class^="qlink"] a';
  $(selector).each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (!href) return;
    let url;
    try { url = new URL(href, section.url); } catch { return; }
    if (!/(?:^|\.)freejobalert\.com$/i.test(url.hostname)) return;
    if (!/\/articles\//i.test(url.pathname)) return;
    const raw = plain($(anchor).text());
    const title = cleanListingTitle(raw);
    if (!title || title.length < 12 || isNonRecruitmentPage(title, url.pathname)) return;
    if (listingType(title) !== section.type) return;
    listings.push({
      title,
      url: url.href,
      lastDate: section.type === 'job' ? lastDateFromListing(raw) : null
    });
  });
  return listings;
}

// ---------------------------------------------------------------------------
// Matching and merging
// ---------------------------------------------------------------------------

function buildEntry(item) {
  return {
    item,
    type: item.type || 'job',
    normalized: normalizeTitle(item.title),
    canonical: canonicalTitle(item.title),
    tokens: tokenize(item.title)
  };
}

function findMatch(title, type, index) {
  const normalized = normalizeTitle(title);
  const canonical = canonicalTitle(title);
  const tokens = tokenize(title);
  let best = null;
  let bestScore = 0;
  let bestShared = 0;

  for (const entry of index) {
    if (entry.type !== type) continue;
    if (entry.normalized === normalized) return { entry, score: 1, shared: entry.tokens.length };
    if (hasConflictingQualifiers(title, entry.item.title)) continue;
    if (canonical && entry.canonical) {
      const containment = entry.canonical === canonical
        || (entry.canonical.includes(canonical) && canonical.length >= 18)
        || (canonical.includes(entry.canonical) && entry.canonical.length >= 18);
      if (containment) return { entry, score: 0.95, shared: Math.min(entry.tokens.length, tokens.length) };
    }
    const similarity = tokenSimilarity(tokens, entry.tokens);
    if (similarity.score > bestScore) {
      best = entry;
      bestScore = similarity.score;
      bestShared = similarity.shared;
    }
  }
  if (best && bestScore >= 0.58 && bestShared >= 2) {
    return { entry: best, score: bestScore, shared: bestShared };
  }
  return null;
}

function needsDetails(item) {
  const type = item.type || 'job';
  if (type === 'job') {
    return !item.publishedDate
      || !item.openDate
      || !item.lastDate
      || !item.organization
      || !item.vacancies
      || !item.eligibility
      || !item.applicationFee
      || (!item.officialLink && !item.link)
      || (item.publisher === 'SarkariResult.com.cm');
  }
  if (type === 'admit-card') {
    return !item.publishedDate || !item.organization || (!item.officialLink && !item.link);
  }
  return !item.publishedDate || !item.resultDate || !item.organization || (!item.officialLink && !item.link);
}

function priorityFor(target) {
  if (target.kind === 'existing') {
    const type = target.item.type || 'job';
    if (type === 'job' && !target.item.lastDate) return 100;
    if (type === 'job' && !target.item.publishedDate && !target.item.openDate) return 95;
    if (type !== 'job' && !target.item.publishedDate) return 88;
    if (!target.item.organization) return 90;
    if (!target.item.vacancies || !target.item.eligibility || !target.item.applicationFee) return 85;
    if (target.item.publisher === 'SarkariResult.com.cm') return 80;
    return 50;
  }
  if (target.section.type === 'job') return target.listing.lastDate ? 70 : 60;
  return 40;
}

function createPlaceholder(listing, source, section) {
  const id = `competitor-${source.id}-${crypto.createHash('sha256').update(listing.url).digest('hex').slice(0, 16)}`;
  const item = {
    id,
    type: section.type,
    title: listing.title,
    source: `${source.name} listing (recruiting authority named in notice)`,
    publisher: source.publisher,
    category: section.type === 'job' ? 'Government jobs' : section.type === 'admit-card' ? 'Admit cards' : 'Results',
    state: inferState(listing.title),
    link: null,
    sourceListingUrl: listing.url,
    discoveredVia: section.url,
    factSource: `${source.name} listing and linked notice; verify with the recruiting authority`,
    factCheckedAt: todayISO(),
    ...(listing.lastDate ? { lastDate: listing.lastDate } : {})
  };
  if (section.type === 'job') classifyJob(item);
  return item;
}

/**
 * SarkariResult reuses one detail page across its job/admit-card/result
 * sections (for example "Exam Date", "Admit Card" and "Result" links all point
 * at the same page). A record should be typed by the newest exam-stage event on
 * that page, not by whichever section happened to list it first.
 */
function refineTypeFromMilestones(item) {
  if (!item.publisher) return false;
  const milestones = (Array.isArray(item.milestones) ? item.milestones : [])
    .filter(entry => entry && entry.date)
    .filter(entry => !/post\s*date|update|release\s*date|application\s*begin|last\s*date|pay\s*(?:exam)?\s*fee|correction/i.test(String(entry.label || '')))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const newest = milestones[0];
  if (!newest) return false;
  const label = String(newest.label || '');
  let refined = null;
  if (/admit\s*card|call\s*letter|hall\s*ticket|interview\s*letter/i.test(label)) refined = 'admit-card';
  else if (/\bresults?\b|merit|score\s*card|answer\s*key|e-?certificate/i.test(label)) refined = 'result';
  if (!refined || refined === item.type) return false;
  item.type = refined;
  // The preferred official link depends on the record type, so re-pick it.
  const links = Array.isArray(item.officialLinks) ? item.officialLinks : [];
  const byLabel = pattern => links.find(link => pattern.test(String(link.label || '')));
  const preferred = refined === 'admit-card'
    ? (byLabel(/admit\s*card|call\s*letter/i) || byLabel(/download/i) || byLabel(/official website/i) || links[0])
    : (byLabel(/\bresult\b|score\s*card|merit|answer\s*key|certificate/i) || byLabel(/official website/i) || links[0]);
  if (preferred) {
    item.officialLink = preferred.url;
    item.link = preferred.url;
  }
  return true;
}

function fillMissing(item, details, target) {
  const source = target.source;
  const score = target.score;
  let changed = false;
  const fill = (field, value) => {
    if (value && !item[field]) {
      item[field] = value;
      changed = true;
    }
  };
  for (const field of ['organization', 'publishedDate', 'openDate', 'lastDate', 'examDate', 'resultDate', 'vacancies', 'ageLimit', 'eligibility', 'applicationFee', 'notificationLink']) {
    fill(field, details[field]);
  }
  if (details.officialLinks?.length) {
    const existing = Array.isArray(item.officialLinks) ? item.officialLinks : [];
    const merged = [...existing];
    for (const link of details.officialLinks) {
      if (link?.url && !merged.some(entry => entry.url === link.url)) merged.push(link);
    }
    if (merged.length !== existing.length) {
      item.officialLinks = merged.slice(0, 10);
      changed = true;
    }
  }
  if (details.officialLink && !item.officialLink) {
    item.officialLink = details.officialLink;
    changed = true;
  }
  if (!item.link && item.officialLink) {
    item.link = item.officialLink;
    changed = true;
  }
  if (details.milestones?.length && !(item.milestones || []).length) {
    item.milestones = details.milestones;
    changed = true;
  }

  // A competitor record whose only link still points at a competitor page
  // should be upgraded to the recruiting authority's own link.
  const currentHost = hostOf(item.officialLink || item.link);
  if (item.publisher && isCompetitorHost(currentHost) && details.officialLink) {
    item.officialLink = details.officialLink;
    item.link = details.officialLink;
    changed = true;
  }

  // Replace copycat ".cm" provenance with the genuine long-running source.
  if (item.publisher === 'SarkariResult.com.cm' && source.publisher === 'SarkariResult.com' && score >= 0.7) {
    item.publisher = source.publisher;
    item.source = `${source.name} listing (recruiting authority named in notice)`;
    item.factSource = `${source.name} listing and linked notice; verify with the recruiting authority`;
    item.sourceListingUrl = target.listing.url;
    item.discoveredVia = target.section.url;
    changed = true;
  }
  refineTypeFromMilestones(item);
  return changed;
}

function applyDetails(item, details) {
  for (const field of ['organization', 'publishedDate', 'openDate', 'lastDate', 'examDate', 'resultDate', 'vacancies', 'ageLimit', 'eligibility', 'applicationFee', 'notificationLink']) {
    if (details[field]) item[field] = details[field];
  }
  if (details.officialLinks?.length) item.officialLinks = details.officialLinks.slice(0, 10);
  if (details.officialLink) item.officialLink = details.officialLink;
  if (details.milestones?.length) item.milestones = details.milestones;
  item.link = item.officialLink || null;
}

function gapStats(items) {
  const list = Array.isArray(items) ? items : [];
  const jobs = list.filter(item => (item.type || 'job') === 'job');
  const admitCards = list.filter(item => item.type === 'admit-card');
  const results = list.filter(item => item.type === 'result');
  return {
    total: list.length,
    jobs: jobs.length,
    admitCards: admitCards.length,
    results: results.length,
    jobsMissingPublicationDate: jobs.filter(item => !item.publishedDate && !item.openDate).length,
    jobsMissingClosingDate: jobs.filter(item => !item.lastDate).length,
    jobsMissingOrganization: jobs.filter(item => !item.organization).length,
    jobsMissingVacancies: jobs.filter(item => !item.vacancies).length,
    jobsMissingEligibility: jobs.filter(item => !item.eligibility).length,
    jobsMissingApplicationFee: jobs.filter(item => !item.applicationFee).length,
    jobsMissingOfficialLink: jobs.filter(item => !item.officialLink && !item.link).length,
    admitCardsMissingPublishedDate: admitCards.filter(item => !item.publishedDate).length,
    resultsMissingPublishedDate: results.filter(item => !item.publishedDate).length,
    resultsMissingResultDate: results.filter(item => !item.resultDate).length
  };
}

function gapSamples(items, predicate, limit = 20) {
  return items
    .filter(item => (item.type || 'job') === 'job' && predicate(item))
    .slice(0, limit)
    .map(item => item.title);
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(DETAIL_CACHE, 'utf8'));
  } catch {
    return {};
  }
}

function isFreshCache(entry) {
  if (!entry || !entry.attemptedAt) return false;
  const age = Date.now() - Date.parse(entry.attemptedAt);
  return entry.parser === 'v2' && Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Main pass
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const payload = JSON.parse(fs.readFileSync(FEED, 'utf8'));
  const before = gapStats(payload.jobs || []);
  const previousTotal = (payload.jobs || []).length;

  const today = todayISO();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  // Competitor jobs without a closing date are only trustworthy while they are
  // fresh; older undated records are almost always enquiries that already closed.
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  let removedStale = 0;
  let removedUncertain = 0;
  let removedNavigation = 0;
  const removalLog = [];
  const logRemoval = (reason, item) => {
    if (removalLog.length < 60) {
      removalLog.push({
        reason,
        type: item.type || 'job',
        publisher: item.publisher || '(official)',
        title: String(item.title || '').slice(0, 120)
      });
    }
  };
  const isUncertainJob = (item) => {
    if (item.publisher && (item.type || 'job') === 'job' && !item.lastDate) {
      const anchor = item.publishedDate || item.openDate;
      return !anchor || anchor < twoWeeksAgo;
    }
    return false;
  };
  payload.jobs = (payload.jobs || []).filter(item => {
    if (isNonRecruitmentPage(item.title, item.sourceListingUrl || item.discoveredVia || item.link || '')) {
      removedNavigation++;
      logRemoval('navigation/non-recruitment', item);
      return false;
    }
    if (item.publisher && (item.type || 'job') === 'job' && item.lastDate && item.lastDate < twoDaysAgo) {
      removedStale++;
      logRemoval('expired closing date', item);
      return false;
    }
    if (isUncertainJob(item)) {
      removedUncertain++;
      logRemoval('stale competitor job without dates', item);
      return false;
    }
    return true;
  });

  const errors = [];
  const cache = loadCache();
  const byId = new Map(payload.jobs.map(item => [item.id, item]));
  let index = payload.jobs.map(buildEntry);
  let matchedExisting = 0;
  const filledIds = new Set();
  const plannedIds = new Set();
  const imported = { job: 0, 'admit-card': 0, result: 0 };
  let skippedClosed = 0;
  let detailsFetched = 0;
  let cacheHits = 0;

  // Two listings can point at the same existing record; keep one detail target.
  const detailTargets = new Map();

  for (const source of COMPETITOR_SOURCES) {
    for (const section of source.sections) {
      try {
        const $ = cheerio.load(await fetchHTML(section.url, 15000));
        const extracted = source.id === 'sarkariresult'
          ? extractSarkariResultListings($, section)
          : extractFreeJobAlertListings($, section);
        const seen = new Set();
        const listings = extracted
          .filter(listing => !seen.has(listing.url) && seen.add(listing.url))
          .slice(0, section.max);
        console.log(`${source.name} ${section.type}: parsed ${extracted.length} links, retained ${listings.length}`);

        for (const listing of listings) {
          const match = findMatch(listing.title, section.type, index);
          if (match) {
            const item = match.entry.item;
            // The listing matched a record created earlier in this same pass
            // (for example the same recruitment on both competitor sources).
            if (plannedIds.has(item.id)) {
              if (listing.lastDate && !item.lastDate) item.lastDate = listing.lastDate;
              continue;
            }
            matchedExisting++;
            // Refresh competitor titles with the cleaner current listing wording
            // (drops "… | Last : date | Date Extended" style leftovers).
            if (item.publisher) {
              const cleanedTitle = cleanListingTitle(item.title) || item.title;
              if (cleanedTitle !== item.title) {
                item.title = cleanedTitle;
                filledIds.add(item.id);
              }
            }
            if (listing.lastDate && !item.lastDate) {
              item.lastDate = listing.lastDate;
              filledIds.add(item.id);
            }

            if (needsDetails(item)) {
              const key = `existing:${item.id}`;
              const candidate = { kind: 'existing', item, listing, source, section, score: match.score };
              candidate.priority = priorityFor(candidate);
              if (!detailTargets.has(key) || detailTargets.get(key).priority < candidate.priority) {
                detailTargets.set(key, candidate);
              }
            }
            continue;
          }

          // A listing whose closing date has already passed cannot become a new
          // open job, but it was still available above to fill an existing record.
          if (section.type === 'job' && listing.lastDate && listing.lastDate < today) {
            skippedClosed++;
            continue;
          }

          const item = createPlaceholder(listing, source, section);
          if (byId.has(item.id)) {
            if (process.env.DEBUG_COMPETITOR) {
              console.log(`COLLISION ${source.name} ${section.type}: id exists as ${byId.get(item.id).type || 'job'} / ${(byId.get(item.id).title || '').slice(0, 60)}  vs  new ${(listing.title || '').slice(0, 60)}`);
            }
            // Same listing URL already exists in the feed (or earlier in this
            // pass) but titles drifted apart: keep ONE record, refresh it.
            const existing = byId.get(item.id);
            const fresh = item;
            fresh.discoveredVia = existing.discoveredVia || fresh.discoveredVia;
            for (const field of ['publishedDate', 'openDate', 'lastDate', 'organization', 'vacancies', 'eligibility', 'applicationFee', 'milestones', 'officialLink', 'notificationLink', 'officialLinks']) {
              if (!fresh[field]) fresh[field] = existing[field];
            }
            byId.set(item.id, fresh);
            index = index.map(entry => (entry.item.id === fresh.id ? buildEntry(fresh) : entry));
            const candidate = { kind: 'existing', item: fresh, listing, source, section, score: 0.95 };
            candidate.priority = priorityFor(candidate);
            detailTargets.set(`existing:${fresh.id}`, candidate);
            continue;
          }
          byId.set(item.id, item);
          index.push(buildEntry(item));
          plannedIds.add(item.id);
          const candidate = { kind: 'new', item, listing, source, section, score: 1 };
          candidate.priority = priorityFor(candidate);
          detailTargets.set(`new:${item.id}`, candidate);
        }
      } catch (error) {
        errors.push({ source: `Competitor: ${source.name}`, url: section.url, error: error.message });
        console.warn(`${source.name} ${section.type}: ${error.message}`);
      }
    }
  }

  // Fetch detail pages within a bounded budget, newest/most incomplete first.
  const targets = [...detailTargets.values()].sort((a, b) => b.priority - a.priority);
  let next = 0;
  async function detailWorker() {
    while (next < targets.length) {
      const target = targets[next++];
      const cached = cache[target.listing.url];
      if (isFreshCache(cached)) {
        target.details = cached.details || {};
        cacheHits++;
        continue;
      }
      if (detailsFetched >= DETAIL_BUDGET) {
        target.details = cached?.details || {};
        continue;
      }
      detailsFetched++;
      try {
        const details = await enrichListing({ title: target.listing.title, link: target.listing.url, type: target.section.type });
        cache[target.listing.url] = { attemptedAt: new Date().toISOString(), parser: 'v2', details };
        target.details = details;
      } catch (error) {
        cache[target.listing.url] = { attemptedAt: new Date().toISOString(), parser: 'v2', error: error.message, details: {} };
        target.details = {};
        errors.push({ source: `Competitor: ${target.source.name}`, url: target.listing.url, error: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: DETAIL_WORKERS }, detailWorker));

  for (const target of targets) {
    const details = target.details || {};
    if (target.kind === 'existing') {
      if (fillMissing(target.item, details, target)) filledIds.add(target.item.id);
      continue;
    }

    applyDetails(target.item, details);
    if (!target.item.sourceListingUrl) target.item.sourceListingUrl = target.listing.url;
    if (!target.item.discoveredVia) target.item.discoveredVia = target.section.url;
    refineTypeFromMilestones(target.item);

    const type = target.item.type || 'job';
    const skip = type === 'job' && (
      (target.item.lastDate && target.item.lastDate < today)
      || (isStale(target.item.title, target.item.lastDate, target.item.publishedDate))
      // Undated competitor jobs are only worth keeping while fresh.
      || (isUncertainJob(target.item))
    );
    if (skip) {
      byId.delete(target.item.id);
      const indexEntry = index.find(entry => entry.item.id === target.item.id);
      if (indexEntry) index.splice(index.indexOf(indexEntry), 1);
      skippedClosed++;
      continue;
    }
    imported[type] = (imported[type] || 0) + 1;
  }

  payload.jobs = [...byId.values()].sort((a, b) =>
    String(a.lastDate || '9999-99-99').localeCompare(String(b.lastDate || '9999-99-99'))
  );
  payload.total = payload.jobs.length;
  payload.quality = {
    ...(payload.quality || {}),
    jobsMissingPublicationDate: payload.jobs.filter(item => (item.type || 'job') === 'job' && !item.publishedDate && !item.openDate).length,
    jobsMissingClosingDate: payload.jobs.filter(item => (item.type || 'job') === 'job' && !item.lastDate).length,
    genericNavigationItems: payload.jobs.filter(item => isGenericJobTitle(item.title)).length
  };
  payload.errors = [
    ...(payload.errors || []).filter(item => !String(item.source || '').startsWith('Competitor: ')),
    ...errors
  ];

  const after = gapStats(payload.jobs);
  const filledItems = filledIds.size;
  const changed = Object.values(imported).some(Boolean) || filledItems > 0 || removedStale > 0 || removedUncertain > 0 || skippedClosed > 0;
  if (changed || payload.jobs.length !== previousTotal) {
    payload.generatedAt = new Date().toISOString();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    sources: COMPETITOR_SOURCES.map(source => source.name),
    before,
    after,
    imported,
    matchedExisting,
    filledItems,
    removedStale,
    removedUncertain,
    skippedClosed,
    removedNavigation,
    removalLog,
    detailPages: {
      targets: targets.length,
      fetched: detailsFetched,
      cacheHits
    },
    remainingGaps: {
      jobsMissingDate: gapSamples(payload.jobs, item => !item.publishedDate && !item.openDate),
      jobsMissingClosingDate: gapSamples(payload.jobs, item => !item.lastDate),
      jobsMissingOrganization: gapSamples(payload.jobs, item => !item.organization),
      jobsMissingVacancies: gapSamples(payload.jobs, item => !item.vacancies),
      jobsMissingOfficialLink: gapSamples(payload.jobs, item => !item.officialLink && !item.link)
    },
    errors: errors.map(error => ({ source: error.source, url: error.url, error: error.error }))
  };

  fs.writeFileSync(FEED, JSON.stringify(payload, null, 2) + '\n');
  fs.writeFileSync(DETAIL_CACHE, JSON.stringify(cache, null, 2) + '\n');
  fs.writeFileSync(GAP_REPORT, JSON.stringify(report, null, 2) + '\n');

  console.log(`\nCompetitor pass finished in ${report.durationSeconds}s.`);
  console.log(`Imported ${imported.job} jobs, ${imported['admit-card']} admit cards, ${imported.result} results; matched ${matchedExisting} existing listings; filled ${filledItems} records.`);
  console.log(`Detail pages: ${detailsFetched} fetched, ${cacheHits} cache hits (${targets.length} targets).`);
  if (removedStale) console.log(`Removed ${removedStale} expired competitor jobs.`);
  if (removedUncertain) console.log(`Removed ${removedUncertain} stale competitor jobs with no verifiable dates.`);
  if (skippedClosed) console.log(`Skipped ${skippedClosed} competitor jobs that had already closed.`);
  console.log(`Feed: ${before.total} → ${payload.total} records.`);
  console.log(`Jobs: ${before.jobs} → ${after.jobs}; missing closing date ${before.jobsMissingClosingDate} → ${after.jobsMissingClosingDate}; missing publication/open date ${before.jobsMissingPublicationDate} → ${after.jobsMissingPublicationDate}.`);
  console.log(`Admit cards: ${before.admitCards} → ${after.admitCards}; results: ${before.results} → ${after.results}.`);
  if (errors.length) console.log(`⚠️  ${errors.length} competitor source/detail errors (see competitor-gap-report.json).`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = {
  enrichListing,
  parseDetail,
  parseDate,
  extractMilestones,
  normalizeTitle,
  isNonRecruitmentPage,
  cleanListingTitle,
  inferState,
  canonicalTitle,
  tokenSimilarity,
  findMatch
};
