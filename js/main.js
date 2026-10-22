/* SarkariJobs+ — Map interactions, ticker, job cards, countdowns */

// ---------- Text cleanup (fixes mojibake from scraped sources) ----------
function cleanText(s) {
  return String(s == null ? '' : s)
    .replace(/\uFFFD\?~/g, '\u2018')
    .replace(/\uFFFD\?T/g, '\u2019')
    .replace(/\uFFFD/g, '')
    .trim();
}

function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function officialURL(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch (_) {
    return null;
  }
}

// ---------- Inline India map: viewBox + hover tooltip + click + Delhi inset ----------
function wireState(el, data, tip) {
  el.classList.add('state-path');
  el.setAttribute('role', 'link');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `${data.name} — ${data.psc} — open job listings`);
  const showTip = e => {
    tip.innerHTML = `<b>📍 ${data.name}</b><small>${data.psc}</small>`;
    tip.style.left = Math.min(e.clientX + 18, window.innerWidth - 230) + 'px';
    tip.style.top = (e.clientY - 64) + 'px';
    tip.classList.add('show');
  };
  el.addEventListener('mouseenter', showTip);
  el.addEventListener('mousemove', showTip);
  el.addEventListener('mouseleave', () => tip.classList.remove('show'));
  el.addEventListener('click', () => {
    window.location.href = `state.html#${data.slug}`;
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
}

function svgElMake(NS, tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Magnified bubble for tiny UTs (no dots — a proper zoom lens)
function addTinyStateInsets(svgEl, tip) {
  const NS = 'http://www.w3.org/2000/svg';
  const INSETS = [
    { focus: 'DL', ctx: ['HR', 'UP'] },
    { focus: 'SK', ctx: ['WB', '—'] }
  ];
  const b = svgEl.getBBox();
  let slot = 0;

  INSETS.forEach(({ focus, ctx }) => {
    const focusPath = svgEl.querySelector(`#IN-${focus}`);
    if (!focusPath) return;
    const data = STATES[focus];
    if (!data) return;

    const fb = focusPath.getBBox();
    const fcx = fb.x + fb.width / 2;
    const fcy = fb.y + fb.height / 2;

    // Lens position: top-left corner for Delhi, below it for Sikkim
    const R = Math.max(36, b.width * 0.068);
    const ix = b.x + R + b.width * 0.03;
    const iy = b.y + R + b.height * 0.02 + slot * (R * 2 + 34);

    const s = Math.min(((R * 1.05) / Math.max(fb.width, fb.height)) * 1.15, 7);
    const tf = `translate(${ix - s * fcx},${iy - s * fcy}) scale(${s})`;

    const g = svgElMake(NS, 'g', { class: 'map-inset' });
    g.appendChild(svgElMake(NS, 'circle', { cx: ix, cy: iy, r: R, class: 'inset-bg' }));

    const clipId = `inset-clip-${focus}`;
    const cp = svgElMake(NS, 'clipPath', { id: clipId });
    cp.appendChild(svgElMake(NS, 'circle', { cx: ix, cy: iy, r: R }));
    g.appendChild(cp);

    const inner = svgElMake(NS, 'g', { 'clip-path': `url(#${clipId})` });
    ctx.filter(c => c !== '—').forEach(code => {
      const src = svgEl.querySelector(`#IN-${code}`);
      if (!src) return;
      const clone = svgElMake(NS, 'path', {
        d: src.getAttribute('d'),
        class: 'inset-ctx',
        transform: tf
      });
      inner.appendChild(clone);
    });
    const focusClone = svgElMake(NS, 'path', {
      d: focusPath.getAttribute('d'),
      class: 'inset-focus',
      transform: tf
    });
    inner.appendChild(focusClone);
    g.appendChild(inner);

    g.appendChild(svgElMake(NS, 'circle', { cx: ix, cy: iy, r: R, class: 'inset-ring' }));
    g.appendChild(svgElMake(NS, 'text', {
      x: ix, y: iy + R + 16,
      'text-anchor': 'middle',
      class: 'inset-label'
    })).textContent = data.name.split(' ')[0];

    // Dashed leader from lens to the real location + small anchor ring there
    const ang = Math.atan2(fcy - iy, fcx - ix);
    g.appendChild(svgElMake(NS, 'line', {
      x1: ix + Math.cos(ang) * (R + 2),
      y1: iy + Math.sin(ang) * (R + 2),
      x2: fcx - Math.cos(ang) * 6,
      y2: fcy - Math.sin(ang) * 6,
      class: 'inset-leader'
    }));
    g.appendChild(svgElMake(NS, 'circle', { cx: fcx, cy: fcy, r: 4.5, class: 'inset-anchor' }));

    svgEl.appendChild(g);
    wireState(focusClone, data, tip);
    slot++;
  });
}

function initMap() {
  const host = document.getElementById('india-map');
  const svgEl = host && host.querySelector('svg');
  if (!svgEl) return;

  // SVG ships without viewBox — compute one from real geometry
  try {
    const b = svgEl.getBBox();
    svgEl.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
  } catch (_) { /* non-fatal */ }

  const tip = document.createElement('div');
  tip.className = 'state-tip';
  document.body.appendChild(tip);

  svgEl.querySelectorAll('path[id^="IN-"]').forEach(path => {
    const data = STATES[path.id.replace('IN-', '')];
    if (!data) return;
    wireState(path, data, tip);
  });

  try { addTinyStateInsets(svgEl, tip); } catch (_) { /* non-fatal */ }
}

// ---------- Render category cards ----------
function renderCategories(jobs = []) {
  const grid = document.getElementById('cat-grid');
  if (!grid) return;
  const counts = new Map();
  jobs.forEach(job => {
    if (job.type && job.type !== 'job') return;
    const name = String(job.category || '').toLowerCase();
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  grid.innerHTML = CATEGORIES.map(c => `
    <a class="cat-card" href="category.html#${encodeURIComponent(c.name.toLowerCase())}">
      <div class="ico">${escapeHTML(c.icon)}</div>
      <h3>${escapeHTML(c.name)}</h3>
      <p>${escapeHTML(c.desc)}</p>
      <span class="count">${counts.get(c.name.toLowerCase()) || 0} in feed</span>
    </a>`).join('');
  const categoryCount = document.getElementById('category-count');
  if (categoryCount) categoryCount.textContent = String(CATEGORIES.length);
}

// ---------- Countdown helper ----------
function daysUntil(dateStr) {
  if (!dateStr || dateStr === 'TBA') return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.ceil((d.setHours(23,59,59,999) - Date.now()) / 86400000);
}
function countdownBadge(d) {
  const n = daysUntil(d);
  if (n === null) return '<span class="countdown cd-ok">TBA</span>';
  if (n < 0)   return '<span class="countdown cd-crit">Closed</span>';
  if (n <= 7)  return `<span class="countdown cd-crit">${n}d left ⏰</span>`;
  if (n <= 21) return `<span class="countdown cd-warn">${n}d left</span>`;
  return `<span class="countdown cd-ok">${n}d left</span>`;
}

function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return 'TBA';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', opts);
}

// ---------- Render job cards ----------
function jobCardHTML(j) {
  const close = j.lastDate || null;
  const exam = j.examDate || null;
  const n = daysUntil(close);
  const cls = n !== null && n >= 0 && n <= 7 ? 'crit'
            : n !== null && n >= 0 && n <= 21 ? 'warn' : '';
  const link = officialURL(j.link);
  return `
    <article class="job-card ${cls}">
      <h3>${escapeHTML(cleanText(j.title))}</h3>
      <div class="job-meta">
        <span class="tag saff">${escapeHTML(cleanText(j.category))}</span>
        <span class="tag">📍 ${escapeHTML(cleanText(j.state))}</span>
        ${j.publisher
          ? `<span class="tag">🔗 From ${escapeHTML(cleanText(j.publisher))}</span><span class="tag">🏢 ${escapeHTML(cleanText(j.organization || j.source))}</span>`
          : `<span class="tag">🔗 ${escapeHTML(cleanText(j.source))}</span>`}
      </div>
      ${j.openDate ? `<div class="dates"><span>Applications open: <b>${escapeHTML(fmtDate(j.openDate))}</b></span></div>` : ''}
      ${close ? `<div class="dates"><span>Form closes: <b>${escapeHTML(fmtDate(close))}</b></span>${countdownBadge(close)}</div>`
        : '<div class="dates"><span>Application deadline: <b>Check official notice</b></span></div>'}
      ${j.publishedDate ? `<div class="dates"><span>Posted: <b>${escapeHTML(fmtDate(j.publishedDate))}</b></span></div>` : ''}
      ${exam ? `<div class="dates"><span>Exam date: <b>${escapeHTML(fmtDate(exam))}</b></span></div>` : ''}
      ${link
        ? `<a class="btn btn-outline" style="margin-top:10px; text-align:center; font-size:.85rem;"
             href="${escapeHTML(link)}" target="_blank" rel="noopener nofollow">${j.publisher ? `Details on ${escapeHTML(cleanText(j.publisher))}` : 'Open source link'} ↗</a>`
        : '<span class="link-unavailable" aria-label="Source link unavailable">Source link unavailable</span>'}
    </article>`;
}

function announcementCardHTML(item) {
  if (!item.type || item.type === 'job') return jobCardHTML(item);
  const isAdmitCard = item.type === 'admit-card';
  const heading = isAdmitCard ? 'Admit card / hall ticket' : 'Result / merit list';
  const link = officialURL(item.link);
  return `
    <article class="job-card announcement-card ${isAdmitCard ? 'admit-card' : 'result-card'}">
      <span class="tag saff">${heading}</span>
      <h3>${escapeHTML(cleanText(item.title))}</h3>
      <div class="job-meta">
        <span class="tag">${escapeHTML(cleanText(item.category))}</span>
        <span class="tag">📍 ${escapeHTML(cleanText(item.state))}</span>
        ${item.publisher
          ? `<span class="tag">🔗 From ${escapeHTML(cleanText(item.publisher))}</span><span class="tag">🏢 ${escapeHTML(cleanText(item.organization || item.source))}</span>`
          : `<span class="tag">🔗 ${escapeHTML(cleanText(item.source))}</span>`}
      </div>
      ${item.publishedDate ? `<div class="dates"><span>Published: <b>${escapeHTML(fmtDate(item.publishedDate))}</b></span></div>` : ''}
      ${item.resultDate ? `<div class="dates"><span>Result declared: <b>${escapeHTML(fmtDate(item.resultDate))}</b></span></div>` : ''}
      ${item.examDate ? `<div class="dates"><span>Exam date: <b>${escapeHTML(fmtDate(item.examDate))}</b></span></div>` : ''}
      ${item.detail ? `<p class="announcement-detail">${escapeHTML(cleanText(item.detail))}</p>` : ''}
      ${link
        ? `<a class="btn btn-outline" style="margin-top:10px; text-align:center; font-size:.85rem;"
             href="${escapeHTML(link)}" target="_blank" rel="noopener nofollow">${item.publisher ? `Details on ${escapeHTML(cleanText(item.publisher))}` : 'Open official link'} ↗</a>`
        : '<span class="link-unavailable">Source link unavailable</span>'}
      ${item.detailPage ? `<a class="announcement-guide" href="${escapeHTML(item.detailPage)}">Read the full guide →</a>` : ''}
    </article>`;
}

function renderAnnouncementSections(items, generatedAt, partial = false) {
  [
    { type: 'result', grid: 'results-grid', status: 'results-status', empty: 'No result links were found in the latest scrape.' },
    { type: 'admit-card', grid: 'admit-cards-grid', status: 'admit-cards-status', empty: 'No admit-card links were found in the latest scrape.' }
  ].forEach(section => {
    const matching = items.filter(item => item.type === section.type)
      .sort((a, b) => String(b.publishedDate || '').localeCompare(String(a.publishedDate || '')));
    const grid = document.getElementById(section.grid);
    const status = document.getElementById(section.status);
    if (status) status.textContent = matching.length
      ? `${matching.length} listings · ${feedUpdatedLabel({ generatedAt })}${partial ? ' Some portals could not be reached.' : ''}`
      : section.empty;
    if (grid) grid.innerHTML = matching.length
      ? matching.slice(0, 12).map(announcementCardHTML).join('')
      : `<p class="jobs-message">${escapeHTML(section.empty)} Check the relevant official board for updates.</p>`;
  });
}

function renderJobList(list, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = list.map(announcementCardHTML).join('');
}

let allJobs = [];
let searchQuery = '';
let showAllJobs = false;

function setJobsMessage(message) {
  const grid = document.getElementById('jobs-grid');
  if (grid) grid.innerHTML = `<p class="jobs-message">${escapeHTML(message)}</p>`;
}

function feedUpdatedLabel(payload) {
  const generated = Date.parse(payload.generatedAt || '');
  if (!Number.isFinite(generated)) return 'Feed update time unavailable.';
  const date = new Date(generated);
  const ageDays = Math.floor((Date.now() - generated) / 86400000);
  const updated = date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  return ageDays > 1
    ? `Feed last updated ${updated}; the data may be out of date.`
    : `Feed updated ${updated}.`;
}

function matchingJobs(query) {
  const q = query.toLocaleLowerCase();
  return allJobs.filter(job => [job.title, job.category, job.state, job.source]
    .some(value => String(value || '').toLocaleLowerCase().includes(q)));
}

function displayJobs() {
  const grid = document.getElementById('jobs-grid');
  const heading = document.getElementById('jobs-heading');
  const more = document.getElementById('show-all-jobs');
  const status = document.getElementById('search-status');
  if (!grid) return;

  const query = searchQuery.trim();
  const jobItems = allJobs.filter(job => !job.type || job.type === 'job');
  let visible;
  if (query) {
    visible = matchingJobs(query);
    if (heading) heading.textContent = `Search results for “${query}”`;
    if (status) status.textContent = `${visible.length} matching notifications.`;
  } else {
    const validDated = jobItems.filter(job => {
      const days = daysUntil(job.lastDate);
      return days !== null && days >= 0;
    }).sort((a, b) => String(a.lastDate).localeCompare(String(b.lastDate)));
    const undated = jobItems.filter(job => !job.lastDate || daysUntil(job.lastDate) === null);
    const expired = jobItems.filter(job => daysUntil(job.lastDate) !== null && daysUntil(job.lastDate) < 0)
      .sort((a, b) => String(b.lastDate).localeCompare(String(a.lastDate)));
    const available = [...validDated, ...undated];
    visible = showAllJobs ? [...available, ...expired] : available.slice(0, 9);
    if (heading) heading.textContent = showAllJobs ? 'All available notifications' : 'Available notifications';
    if (status) status.textContent = `${jobItems.length} job notifications in the current feed.`;
  }

  if (more) {
    more.hidden = Boolean(query) || showAllJobs || jobItems.length <= 9;
    more.textContent = `Show all ${jobItems.length.toLocaleString('en-IN')} job notifications →`;
  }

  if (!visible.length) {
    setJobsMessage(query ? 'No notifications match that search.' : 'No notifications are available in the feed.');
    return;
  }
  renderJobList(visible, 'jobs-grid');
}

function initSearch() {
  const form = document.getElementById('job-search-form');
  const input = document.getElementById('job-search');
  if (!form || !input) return;
  const search = () => {
    searchQuery = input.value.trim();
    showAllJobs = false;
    displayJobs();
    document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    search();
  });
  input.addEventListener('input', () => {
    if (!input.value.trim() && searchQuery) {
      searchQuery = '';
      showAllJobs = false;
      displayJobs();
    }
  });
  document.getElementById('show-all-jobs')?.addEventListener('click', () => {
    showAllJobs = true;
    displayJobs();
  });
}

function renderJobs() {
  fetch('data/jobs.json')
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then(payload => {
      allJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
      const jobCount = allJobs.filter(item => !item.type || item.type === 'job').length;
      const countEl = document.getElementById('feed-job-count');
      if (countEl) countEl.textContent = jobCount.toLocaleString('en-IN');
      const status = document.getElementById('jobs-status');
      if (status) status.textContent = `${jobCount.toLocaleString('en-IN')} jobs · ${allJobs.length - jobCount} results/admit cards · ${feedUpdatedLabel({ generatedAt: payload.jobsGeneratedAt || payload.generatedAt })}${payload.partial ? ' Some portals could not be reached this run.' : ''}`;
      renderCategories(allJobs);
      displayJobs();
      renderAnnouncementSections(allJobs, payload.generatedAt, payload.partial);
      renderTicker(allJobs, payload.jobsGeneratedAt || payload.generatedAt);
    })
    .catch(() => {
      const countEl = document.getElementById('feed-job-count');
      if (countEl) countEl.textContent = '—';
      const status = document.getElementById('jobs-status');
      if (status) status.textContent = 'The notifications feed could not be loaded.';
      setJobsMessage('Could not load notifications. Please try again later.');
      renderCategories([]);
      renderAnnouncementSections([], null);
      const more = document.getElementById('show-all-jobs');
      if (more) more.hidden = true;
    });
}

// ---------- Ticker ----------
function renderTicker(jobs = [], generatedAt) {
  const t = document.getElementById('ticker');
  if (!t) return;
  const wrap = document.getElementById('ticker-wrap');
  const generated = Date.parse(generatedAt || '');
  const now = Date.now();
  const fresh = Number.isFinite(generated) && generated <= now && now - generated < 86400000;
  if (!fresh) {
    if (wrap) wrap.hidden = true;
    t.innerHTML = '';
    return;
  }
  const items = jobs.filter(job => (!job.type || job.type === 'job') && (() => {
    const days = daysUntil(job.lastDate);
    return days !== null && days >= 0 && days <= 21;
  })()).slice(0, 6).map(job =>
    `<span>⏰ <b>${escapeHTML(cleanText(job.title))}</b> closes ${escapeHTML(fmtDate(job.lastDate, { day: 'numeric', month: 'short' }))}</span>`
  ).join('');
  if (wrap) wrap.hidden = !items;
  if (!items) {
    t.innerHTML = '';
    return;
  }
  // duplicate for seamless loop
  t.innerHTML = items + items;
}

// ---------- Count-up hero stats ----------
function animateCounts() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const dur = 1400;
    const t0 = performance.now();
    const fmt = n => n.toLocaleString('en-IN') + (target >= 1000 ? '+' : '');
    const step = now => {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-current-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
  initSearch();
  initMap();
  renderCategories([]);
  renderJobs();
  animateCounts();
});
