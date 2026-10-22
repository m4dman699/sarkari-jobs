/**
 * Source adapters — one per government portal.
 * Each adapter returns normalized announcements:
 * { id, type, title, source, category, state, link, openDate, lastDate, examDate }
 *
 * Design: keyword-scoring instead of brittle CSS selectors,
 * so layouts can change without breaking everything.
 */

const https = require('https');

const UA = 'Mozilla/5.0 (compatible; SarkariJobsPlusBot/1.0; +https://github.com/m4dman699/sarkari-jobs)';
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

async function fetchPage(url, timeoutMs = 12000, redirects = 0) {
  const parsed = new URL(url);
  if (parsed.protocol === 'http:') parsed.protocol = 'https:';
  if (parsed.protocol !== 'https:') throw new Error('Unsupported URL protocol');
  url = parsed.href;
  if (redirects > MAX_REDIRECTS) throw new Error('Too many redirects');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const opts = {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'
    },
    signal: ctrl.signal
  };
  try {
    const mod = https;
    return await new Promise((resolve, reject) => {
      const req = mod.get(url, opts, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(fetchPage(new URL(res.headers.location, url).href, timeoutMs, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        let bytes = 0;
        res.on('data', c => {
          bytes += c.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error('Response exceeds 10 MB limit'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          // Many govt sites serve ISO-8859-1 / windows-1252 — respect their charset
          const ct = (res.headers['content-type'] || '').toLowerCase();
          let charset = 'utf-8';
          const m = ct.match(/charset=([\w-]+)/);
          if (m) charset = m[1];
          else {
            const head = buf.slice(0, 2048).toString('latin1');
            if (/charset=["']?(windows-1252|iso-8859-1|latin1)/i.test(head)) charset = 'windows-1252';
          }
          try {
            resolve(new TextDecoder(charset.replace('iso-8859-1','windows-1252').replace('latin1','windows-1252')).decode(buf));
          } catch {
            resolve(buf.toString('utf8'));
          }
        });
      });
      req.on('error', reject);
      ctrl.signal.addEventListener('abort', () => req.destroy(new Error('Request timed out')), { once: true });
      req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    });
  } finally {
    clearTimeout(t);
  }
}

/** Extract dd/mm/yyyy or dd-mm-yyyy dates near an element,
 *  classified by the words around them */
function findDates(text) {
  const out = [];
  const monthNumbers = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const formats = [
    { re: /(\d{4})-(\d{1,2})-(\d{1,2})/g, parse: m => [m[1], m[2], m[3]] },
    { re: /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*(\d{4})/gi,
      parse: m => [m[3], monthNumbers[m[2].slice(0, 3).toLowerCase()], m[1]] },
    { re: /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s*(\d{4})/gi,
      parse: m => [m[3], monthNumbers[m[1].slice(0, 3).toLowerCase()], m[2]] },
    { re: /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g, parse: m => [m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1]] }
  ];
  for (const { re, parse } of formats) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const [y, mo, d] = parse(m);
    const iso = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso) {
      // look at up to 45 chars before this date for intent keywords
      const before = text.slice(Math.max(0, m.index - 45), m.index);
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
      let kind = 'other';
      if (/last|clos(?:e|ing)|end|due|till|up\s*to|deadline|submission/i.test(before + ' ' + after)) kind = 'close';
      else if (/start|open|from|begin|apply/i.test(before + ' ' + after)) kind = 'open';
      else if (/exam|test|written|interview/i.test(before + ' ' + after)) kind = 'exam';
      else if (/result|declared|published|released|issued|uploaded|dated|date of issue|new updated/i.test(before + ' ' + after)) kind = 'published';
      out.push({ iso, kind });
    }
    }
  }
  return out;
}

function parseDate(text, order = 'dmy') {
  const match = String(text || '').match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (match) {
    const [, first, second, year] = match;
    const day = order === 'mdy' ? second : first;
    const month = order === 'mdy' ? first : second;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const found = findDates(text).find(date => date.kind === 'other' || date.kind === 'published');
  return found?.iso || null;
}

const JOB_TITLE_HINTS = /(notification|recruit|vacanc|apply\s*(online)?|online\s*form|posts|jobs|bharti|career|advertisement|apprentice|engagement|fellowship)/i;
const UPDATE_TITLE_HINTS = /(admit\s*card|call\s*letter|hall\s*ticket|e-admit|\bresults?\b|merit\s*list|scorecard|cut[ -]?off|selection\s*list|shortlist(?:ing)?)/i;
const GENERIC_JOB_LINK = /^(?:apply(?: online| now)?|jobs?(?: through ncs)?|careers?|recruitments?|recruitment (?:advertisements?|calendar|rules)|advertisements?(?: \d{4}[-–]\d{4}(?: ng)?)?|current (?:vacancies|advertisements?)|old vacancies|old results|latest results?|written results?|recruitment calendar|advertisement calendar|otr\s*\/\s*apply online(?: \(recruitment portal\))?|online recruitment application(?: \(ora\))?|exams? view and apply exams?\.? open|notifications? browse and view all the notifications issued\. open|(?:screening |lde |departmental |mlp |induction )?notifications?(?: (?:ng|lde|departmental|20\d{2}[-–]20\d{2}))?|web advertisement|new advertisement policy|career article|government of india,? ministry of railways railway recruitment board|welcome to the new website of railway recruitment boards\.?|status of posts|how to apply(?: & pay)?|processing fees to unblock call letter|download call letter|download hallticket|download hall ticket|download admit card|apply for advt no\.? \d+\/\d{4}|direct recruitment|advertisement \(direct recruitment\)|screening notification(?: [a-z])?|click here|read more|view (?:all|details)|download)$/i;
const GENERIC_ANNOUNCEMENT = /^(notifications?|what'?s new|latest news|announcements?|recruitment|results?|admit cards?)$/i;
const JUNK_HINTS   = /(tender|faq|contact|login|privacy|disclaimer|archive|final\s*marks|answer\s*key|interview\s*schedule|rejection|withdrawn|corrigendum|order\b|\brti\b|right to information|reporting vacancies|press release regarding email|email id for general queries|cancelled|canceled|use of calculator)/i;
const TRUSTED_RECRUITMENT_HOSTS = ['digialm.com', 'hryssc.com', 'tnpsconline.com', 'tnpscexams.in', 'opscechayan.in'];

function isOfficialPortalLink(link) {
  let hostname;
  try { hostname = new URL(link).hostname.toLowerCase().replace(/\.$/, ''); }
  catch { return false; }
  if (/\.(gov\.in|nic\.in|mil\.in|gov)$/.test(hostname)) return true;
  return TRUSTED_RECRUITMENT_HOSTS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

function classifyAnnouncement(title) {
  if (/admit\s*card|call\s*letter|hall\s*ticket|e-admit/i.test(title)) return 'admit-card';
  if (/\bresults?\b|merit\s*list|scorecard|cut[ -]?off|selection\s*list|eligible\s*list|recommendation\s*list|shortlist(?:ing)?|(?:exam|interview)\s*(?:schedule|programme|program)|programme\s+of\s+(?:main|interview)|summary of written examination|document submission|recruitment rules|scheme of examination|computer based recruitment test|interview.{0,50}(?:personality|test)|roll no\.?\s*wise marks/i.test(title)) return 'result';
  return 'job';
}

function isStale(title, lastDate, publishedDate) {
  // Old-year references inside the title (e.g. "Notification No.27/2017") = dead post
  const yearHit = title.match(/\b20(0\d|1\d|2[0-4])\b/);
  if (yearHit && parseInt(yearHit[0], 10) <= 2024) return true;
  // HSSC's CET Group D 05/2026 application closed in July 2026.
  if (/CET Group D\s*[-–]?\s*05\/2026/i.test(title) && Date.now() > Date.parse('2026-07-10T23:59:59+05:30')) return true;
  // Deadline already passed more than 2 days ago = closed
  if (lastDate) {
    const d = new Date(lastDate);
    if (!isNaN(d) && d.getTime() < Date.now() - 2 * 86400000) return true;
  }
  // A job with no published deadline should not stay listed indefinitely;
  // after 120 days it is likely stale and cannot be confirmed open from this feed.
  if (!lastDate && publishedDate) {
    const published = new Date(`${publishedDate}T00:00:00Z`);
    if (!isNaN(published) && published.getTime() < Date.now() - 120 * 86400000) return true;
  }
  return false;
}

function isGenericJobTitle(title) {
  return GENERIC_JOB_LINK.test(String(title || '').replace(/\s+/g, ' ').trim());
}

/**
 * Generic resilient parser: score every <a> on the page,
 * keep job-looking links with their row context for date extraction.
 */
function extractJobs($, baseUrl, sourceName, category, state) {
  const jobs = [];
  $('a').each((_, el) => {
    const $el = $(el);
    const title = ($el.text() || '').replace(/\s+/g, ' ').trim();
    const href = $el.attr('href');
    if (!title || title.length < 5 || title.length > 220) return;
    if (GENERIC_ANNOUNCEMENT.test(title) || isGenericJobTitle(title) || /\{\{.*\}\}/.test(title)) return;
    if (JUNK_HINTS.test(title)) return;
    const type = classifyAnnouncement(title);
    if (type === 'job' && !JOB_TITLE_HINTS.test(title)) return;
    if (type === 'job' && isGenericJobTitle(title)) return;
    if (type !== 'job' && !UPDATE_TITLE_HINTS.test(title)) return;
    if (!href || /^\s*(?:#|javascript:|mailto:|tel:)/i.test(href) || /(?:undefined|null)$/i.test(href.trim())) return;

    let link;
    try {
      const target = new URL(href, baseUrl);
      if (target.protocol === 'http:') target.protocol = 'https:';
      // MPSC officially migrated its RPA from the old NIC domain in September 2025.
      if (target.hostname === 'megrecruitment.nic.in' && target.pathname.startsWith('/rpa/')) {
        target.href = 'https://rpa.meghalaya.gov.in/rpaonline';
      }
      // APPSC's published hall-ticket route uses a trailing slash.
      if (target.hostname === 'portal-psc.ap.gov.in' && target.pathname === '/Download_HallTickets') {
        target.pathname += '/';
      }
      // This legacy Army CEE login endpoint returns HTTP 500; send candidates to the official portal.
      if (target.hostname === 'cdn.digialm.com' && target.pathname === '/EForms/configuredHtml/1258/2000519/login.html') {
        target.href = 'https://joinindianarmy.nic.in/';
      }
      link = target.href;
    } catch { return; }
    if (!/^https?:/.test(link) || !isOfficialPortalLink(link)) return;

    // Row context = closest tr/li/div text, for date proximity search
    const contextEl = $el.closest('tr, article, .views-row, .card, .job-listing, .item, li').length
      ? $el.closest('tr, article, .views-row, .card, .job-listing, .item, li')
      : $el.parent();
    const context = contextEl.text() || '';
    const dateTimes = contextEl.find('time[datetime]').map((__, time) => `${$(time).text()} ${$(time).attr('datetime')}`).get().join(' ');
    const found = findDates(`${context} ${dateTimes}`);

    // classify: keyword-tagged dates win, else earliest=open latest=close
    let openDate = null, lastDate = null, examDate = null, publishedDate = null;
    const taggedOpen = found.filter(d => d.kind === 'open').map(d => d.iso);
    const taggedClose = found.filter(d => d.kind === 'close').map(d => d.iso);
    const taggedExam = found.filter(d => d.kind === 'exam').map(d => d.iso);
    const taggedPublished = found.filter(d => d.kind === 'published').map(d => d.iso);
    // Extensions/corrigenda can move the deadline later; keep the latest stated close date.
    if (taggedClose.length) lastDate = taggedClose.sort().at(-1);
    if (taggedOpen.length) openDate = taggedOpen.sort()[0];
    if (taggedExam.length) examDate = taggedExam.sort()[0];
    if (taggedPublished.length) publishedDate = taggedPublished.sort().at(-1);

    jobs.push({
      id: Buffer.from(link).toString('base64url'),
      type,
      title: title.slice(0, 180),
      source: sourceName,
      category,
      state,
      link,
      openDate: openDate || null,
      lastDate: type === 'job' ? (lastDate || null) : null,
      examDate: examDate || null,
      publishedDate: publishedDate || null
    });
  });
  // quality gate: drop stale/dead notifications
  return jobs.filter(j => j.type !== 'job' || !isStale(j.title, j.lastDate, j.publishedDate));
}

/** MPSC's advertisement index is a table of dated notices, not individual job links.
 * Extract actual post names from each current-year advertisement row and retain
 * its issue date and PDF link instead of treating portal navigation as jobs.
 */
function extractMeghalayaJobs($, baseUrl, sourceName = 'MPSC Meghalaya', category = 'State PSC', state = 'Meghalaya') {
  const jobs = [];
  const verifiedDeadlines = {
    'No.1/2026': '2026-04-17',
    'No.2/2026': '2026-05-08',
    'No.3/2026': '2026-06-25'
  };
  const cutoff = new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00Z`);

  $('tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.children('td');
    if (cells.length < 3) return;
    const adNumber = cells.eq(0).text().replace(/\s+/g, ' ').trim();
    if (!/^No\.\s*\d+\/20\d{2}$/i.test(adNumber)) return;

    const link = cells.eq(1).find('a[href]').first();
    if (!link.length) return;
    const href = link.attr('href');
    if (!href || !/(?:^|\/)advt\/[^?#]+\.pdf(?:[?#]|$)/i.test(href)) return;
    const url = new URL(href, baseUrl).href;

    const issueMatch = cells.eq(2).text().match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (!issueMatch) return;
    const publishedDate = `${issueMatch[3]}-${issueMatch[2].padStart(2, '0')}-${issueMatch[1].padStart(2, '0')}`;
    if (new Date(`${publishedDate}T00:00:00Z`) < cutoff) return;

    const postNames = link.find('ol li').map((__, item) => $(item).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
    if (!postNames.length) {
      const text = link.text().replace(/\s+/g, ' ').trim();
      if (!/applications are invited/i.test(text)) return;
      postNames.push(text.replace(/^.*?recruitment to the post\(s\) mentioned below\s*:?\s*/i, '').slice(0, 180));
    }

    for (const postName of postNames) {
      const title = `${adNumber} — ${postName}`;
      jobs.push({
        id: Buffer.from(`${url}#${postName}`).toString('base64url'),
        type: 'job',
        title,
        source: sourceName,
        category,
        state,
        link: url,
        openDate: publishedDate,
        lastDate: verifiedDeadlines[adNumber] || null,
        examDate: null,
        publishedDate
      });
    }
  });
  return jobs;
}

/** Employment News publishes issue and last dates in an official Ministry of I&B table. */
function extractEmploymentNewsJobs($, baseUrl, sourceName = 'Employment News (Govt of India)', category = 'Central', state = 'All India') {
  const jobs = [];
  $('tr').each((_, row) => {
    const cells = $(row).children('td');
    if (cells.length < 5) return;
    const issuedText = cells.eq(0).text().replace(/\s+/g, ' ').trim();
    const organisation = cells.eq(1).text().replace(/\s+/g, ' ').trim();
    const post = cells.eq(2).text().replace(/\s+/g, ' ').trim();
    const method = cells.eq(3).text().replace(/\s+/g, ' ').trim();
    const lastText = cells.eq(4).text().replace(/\s+/g, ' ').trim();
    // Values in the Ministry table are DD/MM/YYYY (including dates such as 31/08/2026,
    // despite the issue-date header's inconsistent MM/DD label).
    const publishedDate = parseDate(issuedText, 'dmy');
    const lastDate = parseDate(lastText, 'dmy');
    if (!publishedDate || !organisation || !post || !lastDate || !/recruit|deput|contract|engage/i.test(method)) return;
    const title = `${organisation} — ${post}`;
    jobs.push({
      id: Buffer.from(`${baseUrl}#${publishedDate}#${title}`).toString('base64url'),
      type: 'job', title: title.slice(0, 180), source: sourceName, category, state,
      link: baseUrl, openDate: null, lastDate, examDate: null, publishedDate
    });
  });
  return jobs.filter(job => !isStale(job.title, job.lastDate, job.publishedDate));
}

/** ISRO exposes a first-party opportunities table with opening and submission dates. */
function extractISROJobs($, baseUrl, sourceName = 'ISRO', category = 'PSU', state = 'All India') {
  const jobs = [];
  $('.row.list').each((_, row) => {
    const columns = $(row).children('.subthemed-grid-col').toArray();
    // ISRO renders six direct cells per opportunity; chunking them avoids merging
    // neighboring listings into a single title/date, even in archived tabs.
    for (let index = 0; index + 5 < columns.length; index += 6) {
      const $cells = columns.slice(index, index + 6).map(cell => $(cell));
      const field = selector => $cells.map(item => item.find(selector)).find(item => item.length);
      const title = field('.post')?.text().replace(/\s+/g, ' ').trim();
      const adNumber = field('.advtNum')?.text().replace(/\s+/g, ' ').trim();
      const openDate = parseDate(field('.opendate')?.text());
      const lastDate = parseDate(field('.closedate')?.text());
      const details = $cells.flatMap(item => item.find('a[href]').toArray()).map(anchor => $(anchor).attr('href')).find(Boolean);
      if (!title || !lastDate || !details) continue;
      let link;
      try { link = new URL(details, baseUrl).href; } catch { continue; }
      jobs.push({
        id: Buffer.from(link).toString('base64url'), type: 'job',
        title: `${adNumber ? `${adNumber} — ` : ''}${title}`.slice(0, 180),
        source: sourceName, category, state, link,
        openDate, lastDate, examDate: null, publishedDate: openDate
      });
    }
  });
  return jobs.filter(job => !isStale(job.title, job.lastDate, job.publishedDate));
}

/** Puducherry's official recruitment index publishes both dates and notification PDFs. */
function extractPuducherryJobs($, baseUrl, sourceName = 'Government of Puducherry', category = 'State PSC', state = 'Puducherry') {
  const jobs = [];
  $('li.views-row').each((_, row) => {
    const $row = $(row);
    const title = $row.find('.views-field-title').text().replace(/\s+/g, ' ').trim();
    const publishedDate = $row.find('.views-field-field-important-notice-date [content]').attr('content')?.slice(0, 10)
      || parseDate($row.find('.views-field-field-important-notice-date').text());
    const lastDate = $row.find('.views-field-field-expiry-date [content]').attr('content')?.slice(0, 10)
      || parseDate($row.find('.views-field-field-expiry-date').text());
    const href = $row.find('.views-field-field-upload-pdf a[href]').first().attr('href');
    if (!title || !publishedDate || !lastDate || !href) return;
    let link;
    try { link = new URL(href, baseUrl).href; } catch { return; }
    jobs.push({
      id: Buffer.from(link).toString('base64url'), type: 'job',
      title: title.slice(0, 180), source: sourceName, category, state, link,
      openDate: null, lastDate, examDate: null, publishedDate
    });
  });
  return jobs.filter(job => !isStale(job.title, job.lastDate, job.publishedDate));
}

const CENTRAL_SOURCES = [
  {
    name: 'Employment News (Govt of India)',
    category: 'Central',
    state: 'All India',
    slug: 'employment-news',
    urls: ['https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All']
  },
  {
    name: 'SSC',
    category: 'SSC',
    state: 'All India',
    urls: ['https://ssc.gov.in/', 'https://ssc.gov.in/home/quick-links/notifications']
  },
  {
    name: 'UPSC',
    category: 'UPSC',
    state: 'All India',
    urls: ['https://www.upsc.gov.in/', 'https://upsc.gov.in/whats-new']
  },
  {
    name: 'National Career Service (government-sector jobs)',
    category: 'Central',
    state: 'All India',
    urls: ['https://ncs.gov.in/job-listing?isGovernmentJob=true']
  },
  {
    name: 'IBPS',
    category: 'Banking',
    state: 'All India',
    urls: ['https://www.ibps.in/']
  },
  {
    name: 'Railway Recruitment Boards',
    category: 'Railways',
    state: 'All India',
    urls: ['https://rrb.indianrailways.gov.in/']
  },
  // ---- Defence ----
  { name: 'Indian Army',      category: 'Defence', state: 'All India', urls: ['https://joinindianarmy.nic.in/'] },
  { name: 'Indian Navy',      category: 'Defence', state: 'All India', urls: ['https://www.joinindiannavy.gov.in/'] },
  { name: 'Indian Air Force', category: 'Defence', state: 'All India', urls: ['https://indianairforce.nic.in/'] },
  // ---- Teaching ----
  { name: 'KVS',              category: 'Teaching', state: 'All India', urls: ['https://kvs.gov.in/'] },
  { name: 'NVS',              category: 'Teaching', state: 'All India', urls: ['https://navodaya.gov.in/'] },
  { name: 'CBSE/CTET',        category: 'Teaching', state: 'All India', urls: ['https://www.cbse.gov.in/'] },
  // ---- PSU ----
  { name: 'NTPC',             category: 'PSU', state: 'All India', urls: ['https://careers.ntpc.co.in/'] },
  { name: 'SAIL',             category: 'PSU', state: 'All India', urls: ['https://sail.co.in/web/careers'] },
  { slug: 'isro', name: 'ISRO', category: 'PSU', state: 'All India', urls: ['https://www.isro.gov.in/CurrentOpportunities.html'] },
  // ---- Judiciary ----
  { name: 'Supreme Court of India', category: 'Judiciary', state: 'All India', urls: ['https://www.sci.gov.in/recruitments/'] },
  { name: 'Calcutta High Court', category: 'Judiciary', state: 'West Bengal', urls: ['https://www.calcuttahighcourt.gov.in/'] },
  // NIC's official e-Pariksha portal carries recruitment notices and exam updates.
  { name: 'NIC e-Pariksha', category: 'Central', state: 'All India', urls: ['https://pariksha.nic.in/'] }
];

// One entry per State PSC / recruitment board — scraped daily.
// The generic keyword parser handles any layout; failures are logged, never fatal.
const STATE_SOURCES = [
  { slug: 'uttar-pradesh',   name: 'UPPSC',       category: 'State PSC', state: 'Uttar Pradesh',     urls: ['https://uppsc.up.nic.in/'] },
  { slug: 'bihar',           name: 'BPSC',        category: 'State PSC', state: 'Bihar',             urls: ['https://bpsc.bihar.gov.in/', 'https://www.bpsc.bih.nic.in/'] },
  { slug: 'west-bengal',     name: 'WBPSC',       category: 'State PSC', state: 'West Bengal',       urls: ['https://wbpsc.gov.in/'] },
  { slug: 'madhya-pradesh',  name: 'MPPSC',       category: 'State PSC', state: 'Madhya Pradesh',    urls: ['https://mppsc.mp.gov.in/'] },
  { slug: 'rajasthan',       name: 'RPSC',        category: 'State PSC', state: 'Rajasthan',         urls: ['https://rpsc.rajasthan.gov.in/'] },
  { slug: 'tamil-nadu',      name: 'TNPSC',       category: 'State PSC', state: 'Tamil Nadu',        urls: ['https://www.tnpsc.gov.in/'] },
  { slug: 'karnataka',       name: 'KPSC',        category: 'State PSC', state: 'Karnataka',         urls: ['https://kpsc.kar.nic.in/'] },
  { slug: 'kerala',          name: 'Kerala PSC',  category: 'State PSC', state: 'Kerala',            urls: ['https://www.keralapsc.gov.in/'] },
  { slug: 'maharashtra',     name: 'MPSC',        category: 'State PSC', state: 'Maharashtra',       urls: ['https://mpsc.gov.in/'] },
  { slug: 'gujarat',         name: 'GPSC',        category: 'State PSC', state: 'Gujarat',           urls: ['https://gpsc.gujarat.gov.in/'] },
  { slug: 'andhra-pradesh',  name: 'APPSC',       category: 'State PSC', state: 'Andhra Pradesh',    urls: ['https://psc.ap.gov.in/'] },
  { slug: 'telangana',       name: 'TGPSC',       category: 'State PSC', state: 'Telangana',         urls: ['https://www.tgpsc.gov.in/'] },
  { slug: 'himachal-pradesh',name: 'HPPSC',       category: 'State PSC', state: 'Himachal Pradesh',  urls: ['https://hppsc.hp.gov.in/'] },
  { slug: 'haryana',         name: 'HPSC/HSSC',   category: 'State PSC', state: 'Haryana',           urls: ['https://hpsc.gov.in/', 'https://hssc.gov.in/'] },
  { slug: 'jharkhand',       name: 'JPSC',        category: 'State PSC', state: 'Jharkhand',         urls: ['https://www.jpsc.gov.in/'] },
  { slug: 'chhattisgarh',    name: 'CGPSC',       category: 'State PSC', state: 'Chhattisgarh',      urls: ['https://psc.cg.gov.in/'] },
  { slug: 'odisha',          name: 'OPSC',        category: 'State PSC', state: 'Odisha',            urls: ['https://www.opsc.gov.in/'] },
  { slug: 'uttarakhand',     name: 'UKPSC',       category: 'State PSC', state: 'Uttarakhand',       urls: ['https://ukpsc.gov.in/'] },
  { slug: 'punjab',          name: 'PPSC',        category: 'State PSC', state: 'Punjab',            urls: ['https://ppsc.gov.in/'] },
  { slug: 'assam',           name: 'APSC',        category: 'State PSC', state: 'Assam',             urls: ['https://apsc.nic.in/'] },
  { slug: 'jammu-kashmir',   name: 'JKPSC',       category: 'State PSC', state: 'Jammu & Kashmir',   urls: ['https://jkpsc.nic.in/'] },
  { slug: 'goa',             name: 'Goa PSC',     category: 'State PSC', state: 'Goa',               urls: ['https://gpsc.goa.gov.in/'] },
  { slug: 'manipur',         name: 'MPSC Manipur',category: 'State PSC', state: 'Manipur',           urls: ['https://mpscmanipur.gov.in/'] },
  { slug: 'meghalaya',       name: 'MPSC Meghalaya',category:'State PSC',state: 'Meghalaya',        urls: ['https://mpsc.meghalaya.gov.in/advertisements.html'] },
  { slug: 'mizoram',         name: 'Mizoram PSC', category: 'State PSC', state: 'Mizoram',           urls: ['https://mpsc.mizoram.gov.in/'] },
  { slug: 'nagaland',        name: 'NPSC',        category: 'State PSC', state: 'Nagaland',          urls: ['https://npsc.nagaland.gov.in/'] },
  { slug: 'sikkim',          name: 'SPSC Sikkim', category: 'State PSC', state: 'Sikkim',            urls: ['https://spscskm.gov.in/'] },
  { slug: 'tripura',         name: 'TPSC',        category: 'State PSC', state: 'Tripura',           urls: ['https://tpsc.tripura.gov.in/'] },
  { slug: 'delhi',           name: 'DSSSB',       category: 'State PSC', state: 'Delhi',             urls: ['https://dsssb.delhi.gov.in/'] },
  { slug: 'puducherry',      name: 'Government of Puducherry', category: 'State PSC', state: 'Puducherry', urls: ['https://www.py.gov.in/recruitment'] },
  // ---- State Police boards (category: Police) ----
  { slug: 'uttar-pradesh',   name: 'UP Police (UPPRPB)', category: 'Police', state: 'Uttar Pradesh', urls: ['https://uppbpb.gov.in/'] },
  { slug: 'bihar',           name: 'CSBC (Bihar Police)', category: 'Police', state: 'Bihar',        urls: ['https://csbc.bih.nic.in/'] },
  { slug: 'west-bengal',     name: 'WB Police',   category: 'Police', state: 'West Bengal',       urls: ['https://wbpolice.gov.in/'] },
  { slug: 'rajasthan',       name: 'Rajasthan Police', category: 'Police', state: 'Rajasthan',     urls: ['https://police.rajasthan.gov.in/'] },
  { slug: 'tamil-nadu',      name: 'TNUSRB',      category: 'Police', state: 'Tamil Nadu',        urls: ['https://www.tnusrb.tn.gov.in/'] }
];

// Generic sources (Central / Employment News) get re-classified by title keywords
// so every category page on the site stays populated with relevant posts only.
const CATEGORY_RULES = [
  { cat: 'Defence',   re: /(army|navy|air\s*force|agniveer|agnipath|coast\s*guard|bsf|cisf|itbp|ssb\b|crpf|defence)/i },
  { cat: 'Police',    re: /(police|constable|sub\s*inspector|\bsi\b|cid|sspb|fireman|jail\s*warder|ksp|prison)/i },
  { cat: 'Teaching',  re: /(tet\b|teacher|teaching|principal|pgt\b|\btgt\b|prt\b|assistant\s*professor|shikshak|vidyalaya|education)/i },
  { cat: 'PSU',       re: /(\bntpc\b|\bongc\b|\bsail\b|\bisro\b|\bdrdo\b|\bbhel\b|\bgail\b|\biocl\b|\bhal\b|\bbel\b|coal\s*india|\bpsu\b|\bgate\b)/i },
  { cat: 'Judiciary', re: /(high\s*court|district\s*court|judicial|civil\s*judge|\bjmfc\b|district\s*judge|court\b)/i },
  { cat: 'Banking',   re: /(\bibps\b|\bsbi\b|\brbi\b|bank\b|banking|po\b|clerk)/i },
  { cat: 'Railways',  re: /(railway|\brrb\b|\bntpc\b.*rail|group\s*d|alp\b|technician)/i },
  { cat: 'SSC',       re: /(\bssc\b|cgl\b|chsl\b|mts\b|gd\s*constable|selection\s*posts)/i },
  { cat: 'UPSC',      re: /(\bupsc\b|civil\s*services|\bcds\b|\bnda\b|capf\b|ies\b|ifs\b)/i }
];

function classifyJob(job) {
  // Authoritative sources keep their tag (SSC stays SSC even if title says "constable").
  const authoritative = ['SSC', 'Banking', 'Railways', 'UPSC', 'Defence'];
  if (!authoritative.includes(job.category)) {
    for (const { cat, re } of CATEGORY_RULES) {
      if (re.test(job.title)) { job.category = cat; break; }
    }
  }
  return job;
}

const SOURCES = [...CENTRAL_SOURCES, ...STATE_SOURCES];

module.exports = { fetchPage, findDates, extractJobs, extractMeghalayaJobs, extractEmploymentNewsJobs, extractISROJobs, extractPuducherryJobs, SOURCES, STATE_SOURCES, CENTRAL_SOURCES, classifyJob, isOfficialPortalLink, isGenericJobTitle, isStale };
