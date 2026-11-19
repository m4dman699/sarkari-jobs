(() => {
  const id = window.SARKARI_JOBS_GA_ID;
  if (!/^G-[A-Z0-9]+$/.test(id || '')) return;

  // Never send hits from a local preview. Opening the site through the dev
  // server (127.0.0.1:8099) or straight off disk would otherwise create
  // hostname rows for localhost and inflate page views in the live property.
  const host = location.hostname;
  if (
    location.protocol === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '::1'
  ) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(tag);

  // The only thing a visitor can actually complete here is leaving for the
  // recruiting authority's own portal: applying, downloading a hall ticket or
  // reading a result. GA4 showed 0 key events because the site sent page_view
  // and nothing else, so an outbound click is now recorded as its own event.
  // Register `outbound_click` as a key event in the property for it to count.
  const siteHost = host.replace(/^www\./, '');
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target ? target.closest('a[href]') : null;
    if (!link) return;

    let url;
    try { url = new URL(link.getAttribute('href'), location.href); } catch { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    const linkHost = url.hostname.replace(/^www\./, '');
    if (!linkHost || linkHost === siteHost) return;

    window.gtag('event', 'outbound_click', {
      link_url: url.href,
      link_domain: linkHost,
      link_text: (link.innerText || link.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      page_path: location.pathname + location.search
    });
  }, true);
})();
