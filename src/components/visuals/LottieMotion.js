function isUsableLottieResponse(response) {
  if (!response.ok) return false;
  const type = response.headers.get('content-type') || '';
  return !type.includes('text/html') && !type.includes('text/plain');
}

function getFallbackVariant(src) {
  if (src.includes('payment-success')) return 'success';
  if (src.includes('payment-cancel')) return 'cancel';
  if (src.includes('empty-tribe')) return 'empty';
  if (src.includes('server-featured')) return 'featured';
  return 'brand';
}

export function mountLottieMotion(container, {
  src,
  label = '',
  autoplay = true,
  loop = false,
} = {}) {
  if (!container || !src) return () => {};

  container.classList.add('lottie-motion', 'lottie-fallback');
  container.dataset.lottieState = 'fallback';
  container.dataset.lottieVariant = getFallbackVariant(src);
  if (label) container.setAttribute('aria-label', label);

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  const controller = new AbortController();
  let animation = null;
  let disposed = false;
  let visibilityHandler = null;

  fetch(src, { method: 'HEAD', signal: controller.signal })
    .then((response) => {
      if (!isUsableLottieResponse(response)) throw new Error('Animation asset unavailable');
      return import('@lottiefiles/dotlottie-web');
    })
    .then(({ DotLottie }) => {
      if (disposed) return;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      container.append(canvas);
      animation = new DotLottie({ canvas, src, autoplay, loop });
      container.classList.remove('lottie-fallback');
      container.classList.add('lottie-ready');
      container.dataset.lottieState = 'ready';
      visibilityHandler = () => (document.hidden ? animation?.pause() : animation?.play());
      document.addEventListener('visibilitychange', visibilityHandler);
    })
    .catch(() => {});

  return () => {
    disposed = true;
    controller.abort();
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    animation?.destroy();
    container.querySelector('canvas')?.remove();
  };
}
