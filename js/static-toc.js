// SarkariJobs+ static-page interactions: scroll-spy table of contents with a
// sliding tricolor indicator, and a gentle reveal of below-the-fold sections.
// Everything is inert without scripting and disabled for reduced-motion users.
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- ?q search ---------------------------------------------------------
  // all-jobs.html is the target of the homepage segmented search and of the
  // SearchAction sitelinks box, so a query in the URL filters the A-Z rows in
  // place. Without it the param silently did nothing.
  (function () {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    var q = params ? (params.get('q') || '').trim() : '';
    if (!q) return;
    var needle = q.toLowerCase();
    var groups = Array.prototype.slice.call(document.querySelectorAll('.d-index-group'));
    if (!groups.length) return;
    var shown = 0;
    groups.forEach(function (group) {
      var groupShown = 0;
      Array.prototype.slice.call(group.querySelectorAll('.d-rel')).forEach(function (row) {
        var hit = (row.textContent || '').toLowerCase().indexOf(needle) !== -1;
        row.style.display = hit ? '' : 'none';
        if (hit) groupShown++;
      });
      group.style.display = groupShown ? '' : 'none';
      shown += groupShown;
    });
    var lead = document.querySelector('.d-lead');
    if (lead) {
      var note = document.createElement('p');
      note.className = 'd-lead';
      note.style.marginTop = '12px';
      var clean = document.createElement('a');
      clean.href = window.location.pathname;
      clean.textContent = 'clear search';
      note.appendChild(document.createTextNode(shown + ' match' + (shown === 1 ? '' : 'es') + ' for “' + q + '” — '));
      note.appendChild(clean);
      lead.parentNode.insertBefore(note, lead.nextSibling);
      if (shown) window.scrollTo(0, Math.min(220, lead.getBoundingClientRect().top + window.scrollY + 40));
    }
  })();

  // --- gentle reveal of prose sections below the fold -----------------
  var prose = document.querySelector('.d-prose');
  if (prose && !reduce && 'IntersectionObserver' in window) {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var children = Array.prototype.slice.call(prose.children);
    var startHidden = children.filter(function (el) {
      return el.getBoundingClientRect().top > vh * 0.9;
    });
    if (startHidden.length) {
      startHidden.forEach(function (el) { el.classList.add('d-pre'); });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('d-vis'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      startHidden.forEach(function (el) { io.observe(el); });
    }
  }

  // --- scroll-spy TOC ---------------------------------------------------
  var toc = document.querySelector('.d-toc');
  if (!toc) return;
  var list = toc.querySelector('ul');
  var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  if (!list || !links.length) return;

  // Keep the indicator inside the list as an <li> so the list keeps valid
  // semantics; it is decorative, so hide it from assistive technology.
  var cursor = document.createElement('li');
  cursor.className = 'd-toc-cur';
  cursor.setAttribute('aria-hidden', 'true');
  list.appendChild(cursor);

  var targets = links
    .map(function (a) {
      var raw = a.getAttribute('href').slice(1);
      try { raw = decodeURIComponent(raw); } catch (e) { }
      return document.getElementById(raw);
    })
    .filter(Boolean);
  if (!targets.length) return;

  function setActive(id) {
    var li = null;
    links.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      a.parentElement.classList.toggle('on', on);
      if (on) li = a.parentElement;
    });
    if (!li) return;
    cursor.style.opacity = '1';
    cursor.style.top = li.offsetTop + 'px';
    cursor.style.height = li.offsetHeight + 'px';
  }

  var ticking = false;
  function update() {
    ticking = false;
    var sy = window.scrollY || document.documentElement.scrollTop || 0;
    var line = sy + 96;
    var doc = document.documentElement;
    var atBottom = doc.scrollHeight - (sy + window.innerHeight) < 60;
    var active = targets[0];
    for (var i = 0; i < targets.length; i++) {
      var top = targets[i].getBoundingClientRect().top + sy;
      if (top <= line) active = targets[i];
    }
    if (atBottom && targets.length) active = targets[targets.length - 1];
    if (active) setActive(active.id);
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(update);
    else setTimeout(update, 16);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', onScroll);
  onScroll();
})();
