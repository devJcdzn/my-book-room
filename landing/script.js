(function () {
  'use strict';

  const config = window.NOOKLY_CONFIG || {};
  const appStoreUrl = String(config.appStoreUrl || '').trim();

  if (appStoreUrl.startsWith('https://apps.apple.com/')) {
    document.querySelectorAll('[data-app-store-link]').forEach((link) => {
      link.href = appStoreUrl;
    });
  }

  const revealItems = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14 },
  );
  revealItems.forEach((item) => revealObserver.observe(item));
})();
