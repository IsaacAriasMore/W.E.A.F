const ALLOWED_PATHS = new Set([
  '/',
  '/servers',
  '/servers/owners',
  '/servers/publish',
  '/servers/success',
  '/servers/cancel',
]);

export function initGsapMotion(root = document, { pathname = window.location.pathname } = {}) {
  if (!ALLOWED_PATHS.has(pathname)) return () => {};
  if (document.body.dataset.routeKind === 'admin') return () => {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  let disposed = false;
  let context = null;
  let observer = null;

  import('gsap').then((module) => {
    if (disposed) return;
    const gsap = module.gsap || module.default;
    if (!gsap) return;

    context = gsap.context(() => {
      const groups = [...root.querySelectorAll('[data-gsap-stagger]')];
      if (!groups.length || !('IntersectionObserver' in window)) return;

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const items = entry.target.querySelectorAll('[data-gsap-item]');
          gsap.fromTo(items,
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.055, ease: 'power4.out', clearProps: 'opacity,visibility,transform' });
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -5% 0px', threshold: 0.16 });
      groups.forEach((group) => observer.observe(group));
    }, root);
  }).catch(() => {});

  return () => {
    disposed = true;
    observer?.disconnect();
    context?.revert();
  };
}
