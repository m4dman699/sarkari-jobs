// SarkariJobs+ static-page interactions: scroll-spy table of contents with a
// sliding tricolor indicator, and a gentle reveal of below-the-fold sections.
// Everything is inert without scripting and disabled for reduced-motion users.
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  var cursor = document.createElement('span');
  cursor.className = 'd-toc-cur';
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
