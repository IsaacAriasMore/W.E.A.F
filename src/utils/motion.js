const REVEAL_SELECTOR = [
  '.reveal',
  '.reveal-up',
  '.reveal-left',
  '.reveal-right',
  '.reveal-scale',
  '.stagger-group .stagger-item',
].join(', ');

const CARD_SELECTOR = '.glow-card, .cinematic-card, .interactive-card';
const activeCleanups = new Set();

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function registerCleanup(cleanup) {
  activeCleanups.add(cleanup);
  return () => {
    if (!activeCleanups.delete(cleanup)) return;
    cleanup();
  };
}

function showElement(element) {
  element.classList.add('reveal-visible', 'visible');
}

export function applyReducedMotionFallback(root = document) {
  root.querySelectorAll(REVEAL_SELECTOR).forEach(showElement);
  document.documentElement.classList.add('motion-reduced');
}

function prepareStaggerGroups(root) {
  root.querySelectorAll('.stagger-group').forEach((group) => {
    group.querySelectorAll(':scope > .stagger-item').forEach((item, index) => {
      item.style.setProperty('--stagger-index', String(Math.min(index, 8)));
    });
  });
}

export function initScrollAnimations(root = document) {
  const elements = [...root.querySelectorAll(REVEAL_SELECTOR)]
    .filter((element) => !element.closest('[data-motion="none"]'));

  if (!elements.length) return () => {};
  prepareStaggerGroups(root);

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    elements.forEach(showElement);
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      showElement(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.12 });

  elements.forEach((element, index) => {
    element.classList.add('reveal-pending', 'pending');
    element.style.setProperty('--reveal-index', String(index % 5));
    observer.observe(element);
  });

  return () => observer.disconnect();
}

export function initCardHoverEffects(root = document) {
  if (prefersReducedMotion() || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    return () => {};
  }

  const controllers = [...root.querySelectorAll(CARD_SELECTOR)].map((card) => {
    const onPointerMove = (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
    };
    const onPointerLeave = () => {
      card.style.removeProperty('--pointer-x');
      card.style.removeProperty('--pointer-y');
    };
    card.addEventListener('pointermove', onPointerMove, { passive: true });
    card.addEventListener('pointerleave', onPointerLeave, { passive: true });
    return () => {
      card.removeEventListener('pointermove', onPointerMove);
      card.removeEventListener('pointerleave', onPointerLeave);
      onPointerLeave();
    };
  });

  return () => controllers.forEach((cleanup) => cleanup());
}

function initMotion(root, kind, { pathname = window.location.pathname, gsap = false } = {}) {
  document.documentElement.classList.add(`${kind}-motion-ready`);

  if (prefersReducedMotion()) {
    applyReducedMotionFallback(root);
    return registerCleanup(() => {
      document.documentElement.classList.remove(`${kind}-motion-ready`, 'motion-reduced');
    });
  }

  const cleanupScroll = initScrollAnimations(root);
  const cleanupCards = initCardHoverEffects(root);
  let cleanupGsap = () => {};
  let disposed = false;

  if (gsap) {
    import('./gsapMotion.js')
      .then(({ initGsapMotion }) => {
        if (disposed) return;
        cleanupGsap = initGsapMotion(root, { pathname });
      })
      .catch(() => {});
  }

  return registerCleanup(() => {
    disposed = true;
    cleanupGsap();
    cleanupScroll();
    cleanupCards();
    document.documentElement.classList.remove(`${kind}-motion-ready`);
  });
}

export function initPublicMotion(root = document, options = {}) {
  return initMotion(root, 'public', { ...options, gsap: true });
}

export function initUserMotion(root = document, options = {}) {
  return initMotion(root, 'user', options);
}

export function cleanupMotion() {
  [...activeCleanups].forEach((cleanup) => cleanup());
  activeCleanups.clear();
  document.documentElement.classList.remove('public-motion-ready', 'user-motion-ready', 'motion-reduced');
}

export const observeRevealElements = initScrollAnimations;
