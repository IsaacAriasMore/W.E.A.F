import { createMarketplaceService } from '../../services/marketplaceService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { t } from '../../i18n/index.js';

export function render({ path }) {
  const canceled = path.endsWith('/cancel');
  return `<section class="market-payment-result container" data-market-payment-result><p>${t('marketplace.payment.eyebrow')}</p><h1>${t(canceled ? 'marketplace.payment.canceled' : 'marketplace.payment.processing')}</h1><span>${t(canceled ? 'marketplace.payment.canceledBody' : 'marketplace.payment.webhook')}</span><div class="route-loading"><span class="skeleton skeleton-copy"></span></div><a class="button button-secondary" href="/account/marketplace" data-link>${t('marketplace.mine')}</a></section>`;
}

export function bind({ path, authService }) {
  const root = document.querySelector('[data-market-payment-result]');
  if (path.endsWith('/cancel')) { root.querySelector('.route-loading')?.remove(); return; }
  const paymentId = new URLSearchParams(window.location.search).get('payment_id');
  if (!/^[0-9a-f-]{36}$/i.test(paymentId || '')) { root.querySelector('.route-loading').outerHTML = `<p class="form-message error">${t('marketplace.payment.invalid')}</p>`; return; }
  const service = createMarketplaceService(authService.getClient());
  service.captureFeaturedOrder(paymentId).then(async (result) => {
    if (!root?.isConnected) return;
    if (result.error) { root.querySelector('.route-loading').outerHTML = `<p class="form-message error">${escapeHtml(result.error)}</p>`; return; }
    root.querySelector('h1').textContent = t('marketplace.payment.pending');
    root.querySelector('.route-loading').outerHTML = `<p class="form-message">${t('marketplace.payment.pendingBody')}</p>`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const workspace = await service.getMyWorkspace();
      const payment = workspace.data?.payments?.find((item) => item.id === paymentId);
      if (payment?.status === 'captured') {
        root.querySelector('h1').textContent = t('marketplace.payment.confirmed');
        root.querySelector('.form-message').textContent = t('marketplace.payment.confirmedBody');
        break;
      }
    }
  });
}
