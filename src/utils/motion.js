const REVEAL_SELECTOR = '.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale';

export function applyReducedMotionFallback(root = document) {
  root.querySelectorAll(REVEAL_SELECTOR).forEach((element) => element.classList.add('reveal-visible'));
  document.documentElement.classList.add('public-motion-reduced');
}
export function observeRevealElements(root = document) {
  const elements = [...root.querySelectorAll(REVEAL_SELECTOR)];
  if (!elements.length) return () => {};
  if (!('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('reveal-visible'));
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('reveal-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.14 });

  elements.forEach((element, index) => {
    element.classList.add('reveal-pending');
    element.style.setProperty('--reveal-index', String(index % 6));
    observer.observe(element);
  });
  return () => observer.disconnect();
}

export function initPublicMotion(root = document) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('public-motion-ready');
  if (reduced) {
    applyReducedMotionFallback(root);
    return () => document.documentElement.classList.remove('public-motion-ready', 'public-motion-reduced');
  }
  const cleanupObserver = observeRevealElements(root);
  return () => {
    cleanupObserver();
    document.documentElement.classList.remove('public-motion-ready');
  };
}
