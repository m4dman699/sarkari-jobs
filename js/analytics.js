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
})();
