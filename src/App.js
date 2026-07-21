import { createPublicHeader, bindPublicHeader, setActiveNavigation } from './components/layout/PublicHeader.js';
import { createFooter } from './components/layout/Footer.js';
import { createRouter } from './router.js';
import { showToast } from './utils/feedback.js';

export function startApp(root) {
  root.innerHTML = `
    ${createPublicHeader()}
    <main id="main-content" tabindex="-1"></main>
    ${createFooter()}
    <div class="toast-region" aria-live="polite" aria-atomic="true"></div>
  `;

  const router = createRouter({
    outlet: root.querySelector('#main-content'),
    onRouteChange(pathname) {
      setActiveNavigation(pathname);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
  });

  bindPublicHeader(router.navigate);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (link && link.origin === window.location.origin) {
      event.preventDefault();
      router.navigate(link.pathname);
      return;
    }

    const pending = event.target.closest('[data-coming-soon]');
    if (pending) {
      showToast(pending.dataset.comingSoon || 'Esta función llega en una fase posterior.');
    }
  });

  router.start();
}
