/* SarkariJobs+ — dynamic state detail page (#<slug>) */

function slugToKey(slug) {
  return Object.keys(STATES).find(k => STATES[k].slug === slug);
}

function sortByDeadline(list) {
  const upcoming = list.filter(j => daysUntil(j.lastDate) !== null && daysUntil(j.lastDate) >= 0)
    .sort((a,b) => String(a.lastDate).localeCompare(String(b.lastDate)));
  const undated = list.filter(j => daysUntil(j.lastDate) === null);
  const expired = list.filter(j => daysUntil(j.lastDate) !== null && daysUntil(j.lastDate) < 0)
    .sort((a,b) => String(b.lastDate).localeCompare(String(a.lastDate)));
  return [...upcoming, ...undated, ...expired];
}

function fillGrid(list) {
  const grid = document.getElementById('state-jobs-grid');
  if (!list.length) {
    grid.innerHTML = '<p class="jobs-message">No matching notifications are available in the feed right now.</p>';
    return;
  }
  grid.innerHTML = sortByDeadline(list).map(jobCardHTML).join('');
}

function renderStatePage() {
  // hash-based routing (survives clean-URL redirects); fall back to ?s=
  const slug = window.location.hash.slice(1) ||
    new URLSearchParams(window.location.search).get('s') || '';
  const key = slugToKey(slug);

  if (!key) {
    document.getElementById('state-title').textContent = 'State not found';
    document.getElementById('state-psc').style.display = 'none';
    document.getElementById('state-desc').textContent = 'Pick a state from the interactive map on the homepage.';
    return;
  }

  const s = STATES[key];
  document.title = `${s.name} Government Jobs ${new Date().getFullYear()} — ${s.psc} Notifications | SarkariJobs+`;
  document.getElementById('state-title').textContent = `${s.name} Government Jobs`;
  document.getElementById('state-psc').textContent = `🏛️ ${s.psc}`;
  document.getElementById('state-desc').textContent = s.desc ||
    `Recruitment notifications from ${s.psc} and state-level boards, with available form deadlines, exam dates and official links.`;

  // Hero image if generated art exists for this state (assets/states/<slug>.png);
  // otherwise the animated tricolor gradient stays as the hero.
  const img = new Image();
  img.onload = () => {
    const bg = document.getElementById('hero-bg');
    bg.style.backgroundImage = `url('assets/states/${s.slug}.png')`;
    bg.classList.add('loaded');
  };
  img.src = `assets/states/${s.slug}.png`;

  // Priority: per-state scraped file → filter main feed by this state →
  // clearly-labelled central jobs → curated samples. Never mismatched filler.
  fetch(`data/states/${s.slug}.json`)
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(p => {
      document.getElementById('jobs-heading').textContent = `${s.name} notifications`;
      const stateJobs = (p.jobs || []).filter(job => !job.type || job.type === 'job');
      if (stateJobs.length) {
        fillGrid(stateJobs);
        return;
      }
      return fetch('data/jobs.json')
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(feed => filterMainFeed(feed.jobs || [], s.name));
    })
    .catch(() =>
      fetch('data/jobs.json')
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(p => filterMainFeed(p.jobs || [], s.name))
        .catch(() => {
          document.getElementById('jobs-heading').textContent = 'Notifications unavailable';
          fillGrid([]);
        })
    );
}

function filterMainFeed(jobs, s) {
  const own = jobs.filter(j => (!j.type || j.type === 'job') &&
    j.state && j.state.toLowerCase().includes(s.name.toLowerCase()));
  if (own.length) {
    document.getElementById('jobs-heading').textContent = `${s.name} notifications`;
    fillGrid(own);
    return;
  }
  // Honest fallback: only central/all-India posts, clearly labelled
  const national = jobs.filter(j => (!j.type || j.type === 'job') && /all india|central/i.test(j.state || ''));
  document.getElementById('jobs-heading').textContent =
    'Central notifications open to ' + s.name + ' candidates';
  fillGrid(national.slice(0, 6));
}

document.addEventListener('DOMContentLoaded', renderStatePage);
