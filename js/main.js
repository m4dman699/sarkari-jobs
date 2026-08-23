/* SarkariJobs+ — Map interactions, ticker, job cards, countdowns */

// ---------- Text cleanup (fixes mojibake from scraped sources) ----------
function cleanText(s) {
  return String(s == null ? '' : s)
    .replace(/\uFFFD\?~/g, '\u2018')
    .replace(/\uFFFD\?T/g, '\u2019')
    .replace(/\uFFFD/g, '')
    .trim();
}

// ---------- Inline India map: viewBox + hover tooltip + click + Delhi inset ----------
function wireState(el, data, tip) {
  el.classList.add('state-path');
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
function renderCategories() {
  const grid = document.getElementById('cat-grid');
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(c => `
    <a class="cat-card" href="category.html#${encodeURIComponent(c.name.toLowerCase())}">
      <div class="ico">${c.icon}</div>
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      <span class="count">${c.count}</span>
    </a>`).join('');
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
  return `
    <article class="job-card ${cls}">
      <h3>${cleanText(j.title)}</h3>
      <div class="job-meta">
        <span class="tag saff">${cleanText(j.category)}</span>
        <span class="tag">📍 ${cleanText(j.state)}</span>
        <span class="tag">🔗 ${cleanText(j.source)}</span>
      </div>
      <div class="dates">
        <span>Form closes: <b>${fmtDate(close)}</b></span>
        ${countdownBadge(close)}
      </div>
      ${exam ? `<div class="dates"><span>Exam date: <b>${fmtDate(exam)}</b></span></div>` : ''}
      <a class="btn btn-outline" style="margin-top:10px; text-align:center; font-size:.85rem;"
         href="${j.link}" target="_blank" rel="noopener nofollow">View official notification ↗</a>
    </article>`;
}

function renderJobList(list, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = list.map(jobCardHTML).join('');
}

const SAMPLE_JOBS_MAPPED = () => SAMPLE_JOBS.map(s => ({
  title: s.title, category: s.cat, state: s.state,
  lastDate: s.close, examDate: s.exam === 'TBA' ? null : s.exam,
  link: '#', source: 'Official'
}));

// "Closing Soon" must always show REAL countdowns:
// dated jobs (live + curated samples) sorted by deadline first,
// undated live notifications only used as filler if slots remain.
function mergeClosingSoon(liveJobs) {
  const keyOf = j => cleanText(j.title).toLowerCase().slice(0, 40);
  const seen = new Set();
  const out = [];
  const push = list => list.forEach(j => {
    const k = keyOf(j);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(j);
  });

  const liveDated = liveJobs
    .filter(j => j.lastDate && !isNaN(new Date(j.lastDate)))
    .sort((a,b) => String(a.lastDate).localeCompare(String(b.lastDate)));
  push(liveDated);
  push(SAMPLE_JOBS_MAPPED());

  const liveUndated = liveJobs.filter(j => !j.lastDate);
  const remaining = Math.max(0, 9 - out.length);
  push(liveUndated.slice(0, remaining));
  return out.slice(0, 9);
}

function renderJobs() {
  fetch('data/jobs.json')
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(payload => renderJobList(mergeClosingSoon(payload.jobs || []), 'jobs-grid'))
    .catch(() => renderJobList(mergeClosingSoon([]), 'jobs-grid'));
}

// ---------- Ticker ----------
function renderTicker() {
  const t = document.getElementById('ticker');
  if (!t) return;
  const items = SAMPLE_JOBS.map(j =>
    `<span>🔴 <b>${j.title.split('—')[0].trim()}</b> closes ${fmtDate(j.close, { day: 'numeric', month: 'short' })} · Apply now</span>`
  ).join('');
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
  initMap();
  renderCategories();
  renderJobs();
  renderTicker();
  animateCounts();
});
