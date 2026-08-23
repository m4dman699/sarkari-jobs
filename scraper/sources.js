/**
 * Source adapters — one per government portal.
 * Each adapter returns normalized job objects:
 * { id, title, source, category, state, link, postedDate, lastDate }
 *
 * Design: keyword-scoring instead of brittle CSS selectors,
 * so layouts can change without breaking everything.
 */

const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 SarkariJobsPlusBot/1.0 (+https://github.com/yourname/sarkari-jobs)';

// Many Indian govt portals run ancient TLS / self-signed certs.
// A permissive agent fixes "fetch failed" without disabling verification globally.
const laxAgent = new https.Agent({
  rejectUnauthorized: false,
  minVersion: 'TLSv1',
  ciphers: 'DEFAULT@SECLEVEL=0',
  keepAlive: false
});

async function fetchPage(url, timeoutMs = 20000) {
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
    const mod = url.startsWith('https') ? https : http;
    if (url.startsWith('https')) opts.agent = laxAgent;
    return await new Promise((resolve, reject) => {
      const req = mod.get(url, opts, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(fetchPage(new URL(res.headers.location, url).href, timeoutMs));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
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
  const re = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let [ , d, mo, y ] = m;
    if (y.length === 2) y = '20' + y;
    const iso = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (!isNaN(new Date(iso))) {
      // look at up to 45 chars before this date for intent keywords
      const before = text.slice(Math.max(0, m.index - 45), m.index);
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
      let kind = 'other';
      if (/last|close|end|due|till|upto/i.test(before + ' ' + after)) kind = 'close';
      else if (/start|open|from|begin|apply/i.test(before + ' ' + after)) kind = 'open';
      out.push({ iso, kind });
    }
  }
  return out;
}

const TITLE_HINTS = /(notification|recruit|vacanc|apply\s*(online)?|online\s*form|exam|posts|jobs|bharti|admit)/i;
const JUNK_HINTS   = /(tender|faq|contact|login|privacy|disclaimer|archive|admit\s*card|call\s*letter|hall\s*ticket|final\s*marks|answer\s*key|interview\s*schedule|\bresults?\b|rejection|withdrawn|corrigendum|order\b)/i;

function isStale(title, lastDate) {
  // Old-year references inside the title (e.g. "Notification No.27/2017") = dead post
  const yearHit = title.match(/\b20(0\d|1\d|2[0-4])\b/);
  if (yearHit && parseInt(yearHit[0], 10) <= 2024) return true;
  // Deadline already passed more than 2 days ago = closed
  if (lastDate) {
    const d = new Date(lastDate);
    if (!isNaN(d) && d.getTime() < Date.now() - 2 * 86400000) return true;
  }
  return false;
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
    if (!title || title.length < 12 || title.length > 220) return;
    if (!TITLE_HINTS.test(title) || JUNK_HINTS.test(title)) return;

    let link;
    try {
      link = new URL(href, baseUrl).href;
    } catch { return; }
    if (!/^https?:/.test(link)) return;

    // Row context = closest tr/li/div text, for date proximity search
    const context = ($el.closest('tr').text() || $el.closest('li').text() || $el.parent().text() || '');
    const found = findDates(context);

    // classify: keyword-tagged dates win, else earliest=open latest=close
    let openDate = null, lastDate = null;
    const taggedOpen = found.filter(d => d.kind === 'open').map(d => d.iso);
    const taggedClose = found.filter(d => d.kind === 'close').map(d => d.iso);
    if (taggedClose.length) lastDate = taggedClose.sort()[0];
    if (taggedOpen.length) openDate = taggedOpen.sort()[0];
    const rest = found.map(d => d.iso).sort();
    if (!lastDate && rest.length > 1) lastDate = rest[rest.length - 1];
    if (!openDate && rest.length) openDate = rest[0];
    if (openDate && lastDate && openDate > lastDate) [openDate, lastDate] = [lastDate, openDate];

    jobs.push({
      id: Buffer.from(link).toString('base64url'),
      title: title.slice(0, 180),
      source: sourceName,
      category,
      state,
      link,
      openDate: openDate || null,
      lastDate: lastDate || null
    });
  });
  // quality gate: drop stale/dead notifications
  return jobs.filter(j => !isStale(j.title, j.lastDate));
}

const CENTRAL_SOURCES = [
  {
    name: 'Employment News (Govt of India)',
    category: 'Central',
    state: 'All India',
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
    urls: ['https://upsc.gov.in/whats-new']
  },
  {
    name: 'IBPS',
    category: 'Banking',
    state: 'All India',
    urls: ['https://www.ibps.in/']
  },
  {
    name: 'RRB',
    category: 'Railways',
    state: 'All India',
    urls: ['https://www.rrbcdg.gov.in/']
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
  { name: 'ISRO',             category: 'PSU', state: 'All India', urls: ['https://www.isro.gov.in/Careers.html'] },
  // ---- Judiciary ----
  { name: 'eCourts',          category: 'Judiciary', state: 'All India', urls: ['https://ecourts.gov.in/recruitments'] },
  { name: 'Calcutta High Court', category: 'Judiciary', state: 'West Bengal', urls: ['https://www.calcuttahighcourt.gov.in/'] },
  // ---- High-yield discovery (links point to official boards; classifier sorts categories) ----
  { name: 'Sarkari Result',   category: 'Central', state: 'All India', urls: ['https://www.sarkariresult.com/latest-jobs/'] },
  { name: 'RRB Apply Portal', category: 'Railways', state: 'All India', urls: ['https://www.rrbapply.gov.in/'] }
];

// One entry per State PSC / recruitment board — scraped daily.
// The generic keyword parser handles any layout; failures are logged, never fatal.
const STATE_SOURCES = [
  { slug: 'uttar-pradesh',   name: 'UPPSC',       category: 'State PSC', state: 'Uttar Pradesh',     urls: ['https://uppsc.up.nic.in/', 'https://psc.up.gov.in/en/whats-new'] },
  { slug: 'bihar',           name: 'BPSC',        category: 'State PSC', state: 'Bihar',             urls: ['https://bpsc.bihar.gov.in/', 'https://www.bpsc.bih.nic.in/'] },
  { slug: 'west-bengal',     name: 'WBPSC',       category: 'State PSC', state: 'West Bengal',       urls: ['https://wbpsc.gov.in/'] },
  { slug: 'madhya-pradesh',  name: 'MPPSC',       category: 'State PSC', state: 'Madhya Pradesh',    urls: ['https://mppsc.mp.gov.in/'] },
  { slug: 'rajasthan',       name: 'RPSC',        category: 'State PSC', state: 'Rajasthan',         urls: ['https://rpsc.rajasthan.gov.in/'] },
  { slug: 'tamil-nadu',      name: 'TNPSC',       category: 'State PSC', state: 'Tamil Nadu',        urls: ['https://www.tnpsc.gov.in/', 'http://www.tnpscexams.net/'] },
  { slug: 'karnataka',       name: 'KPSC',        category: 'State PSC', state: 'Karnataka',         urls: ['https://kpsc.kar.nic.in/'] },
  { slug: 'kerala',          name: 'Kerala PSC',  category: 'State PSC', state: 'Kerala',            urls: ['https://www.keralapsc.gov.in/'] },
  { slug: 'maharashtra',     name: 'MPSC',        category: 'State PSC', state: 'Maharashtra',       urls: ['https://mpsc.gov.in/', 'https://mpsc.gov.in/en/node/whats-new'] },
  { slug: 'gujarat',         name: 'GPSC',        category: 'State PSC', state: 'Gujarat',           urls: ['https://gpsc.gujarat.gov.in/'] },
  { slug: 'andhra-pradesh',  name: 'APPSC',       category: 'State PSC', state: 'Andhra Pradesh',    urls: ['https://psc.ap.gov.in/'] },
  { slug: 'telangana',       name: 'TSPSC',       category: 'State PSC', state: 'Telangana',         urls: ['https://www.tspsc.gov.in/'] },
  { slug: 'himachal-pradesh',name: 'HPPSC',       category: 'State PSC', state: 'Himachal Pradesh',  urls: ['https://hppsc.hp.gov.in/'] },
  { slug: 'haryana',         name: 'HPSC/HSSC',   category: 'State PSC', state: 'Haryana',           urls: ['http://hpsc.gov.in/', 'http://hssc.gov.in/'] },
  { slug: 'jharkhand',       name: 'JPSC',        category: 'State PSC', state: 'Jharkhand',         urls: ['https://www.jpsc.gov.in/'] },
  { slug: 'chhattisgarh',    name: 'CGPSC',       category: 'State PSC', state: 'Chhattisgarh',      urls: ['https://psc.cg.gov.in/'] },
  { slug: 'odisha',          name: 'OPSC',        category: 'State PSC', state: 'Odisha',            urls: ['https://www.opsc.gov.in/'] },
  { slug: 'uttarakhand',     name: 'UKPSC',       category: 'State PSC', state: 'Uttarakhand',       urls: ['https://ukpsc.gov.in/'] },
  { slug: 'punjab',          name: 'PPSC',        category: 'State PSC', state: 'Punjab',            urls: ['https://ppsc.gov.in/'] },
  { slug: 'assam',           name: 'APSC',        category: 'State PSC', state: 'Assam',             urls: ['https://apsc.nic.in/'] },
  { slug: 'jammu-kashmir',   name: 'JKPSC',       category: 'State PSC', state: 'Jammu & Kashmir',   urls: ['https://jkpsc.nic.in/'] },
  { slug: 'goa',             name: 'Goa PSC',     category: 'State PSC', state: 'Goa',               urls: ['https://gpsc.goa.gov.in/'] },
  { slug: 'manipur',         name: 'MPSC Manipur',category: 'State PSC', state: 'Manipur',           urls: ['https://mpscmanipur.gov.in/'] },
  { slug: 'meghalaya',       name: 'MPSC Meghalaya',category:'State PSC',state: 'Meghalaya',        urls: ['http://mpsc.nic.in/'] },
  { slug: 'mizoram',         name: 'Mizoram PSC', category: 'State PSC', state: 'Mizoram',           urls: ['https://mpsc.mizoram.gov.in/'] },
  { slug: 'nagaland',        name: 'NPSC',        category: 'State PSC', state: 'Nagaland',          urls: ['https://npsc.nagaland.gov.in/'] },
  { slug: 'sikkim',          name: 'SPSC Sikkim', category: 'State PSC', state: 'Sikkim',            urls: ['https://spscskm.gov.in/'] },
  { slug: 'tripura',         name: 'TPSC',        category: 'State PSC', state: 'Tripura',           urls: ['http://tpsc.tripura.gov.in/'] },
  { slug: 'delhi',           name: 'DSSSB',       category: 'State PSC', state: 'Delhi',             urls: ['https://dsssb.delhi.gov.in/'] },
  { slug: 'puducherry',      name: 'PPPSC/Puducherry', category: 'State PSC', state: 'Puducherry', urls: ['https://recruitment.puducherry.gov.in/'] },
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

module.exports = { fetchPage, extractJobs, SOURCES, STATE_SOURCES, CENTRAL_SOURCES, classifyJob };
