import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { getLanguage, t } from '../../i18n/index.js';
import { mountLottieMotion } from '../../components/visuals/LottieMotion.js';

export function render({ path }) {
  if (path === '/servers/cancel') {
    const listingId = new URLSearchParams(window.location.search).get('listing_id') || '';
    return `<section class="publish-shell container"><div class="publish-result-layout"><div class="billing-result-motion" data-billing-lottie data-lottie-src="/animations/payment-cancel.lottie"></div><div class="publish-message"><p>${t('servers.result.canceled')}</p><h1>${t('servers.result.noCharge')}</h1><p>${t('servers.result.saved')}</p><a class="button button-primary" href="/servers/publish?listing_id=${escapeHtml(listingId)}" data-link>${t('servers.result.back')}</a><a class="button button-quiet" href="/servers/owners" data-link>${t('servers.result.plans')}</a></div></div></section>`;
  }
  return `<section class="publish-shell container"><div class="publish-result-layout"><div class="billing-result-motion" data-billing-lottie data-lottie-src="/animations/payment-success.lottie"></div><div class="publish-message" data-checkout-result><p>${t('servers.result.received')}</p><h1>${t('servers.result.confirming')}</h1><p>${t('servers.result.webhook')}</p></div></div></section>`;
}

export function bind({ path, authService }) {
  const animationRoot = document.querySelector('[data-billing-lottie]');
  const cleanupAnimation = mountLottieMotion(animationRoot, {
    src: animationRoot?.dataset.lottieSrc,
    label: t(path === '/servers/cancel' ? 'servers.result.canceled' : 'servers.result.received'),
  });
  if (path !== '/servers/success') return cleanupAnimation;
  const service = createServerService(authService.getClient());
  const target = document.querySelector('[data-checkout-result]');
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  let canceled = false;
  async function check(attempt = 0) {
    const result = await service.getMyBilling();
    if (canceled) return;
    const listing = result.data?.listings?.find((item) => item.stripe_checkout_session_id === sessionId);
    if (listing?.status === 'active') {
      const date = new Date(listing.expires_at).toLocaleDateString(getLanguage() === 'es' ? 'es-CR' : 'en-US');
      target.innerHTML = `<p>${t('servers.result.active')}</p><h1>${t('servers.result.published', { title: escapeHtml(listing.title) })}</h1><p>${t('servers.result.validUntil', { plan: escapeHtml(listing.plan_type || listing.plan), date })}</p><a class="button button-primary" href="/servers" data-link>${t('servers.result.directory')}</a><a class="button button-quiet" href="/account/billing" data-link>${t('servers.result.billing')}</a>`;
      return;
    }
    if (result.error) {
      target.innerHTML = `<h1>${t('servers.result.statusError')}</h1><p>${escapeHtml(result.error)}</p>`;
      return;
    }
    if (attempt < 6) window.setTimeout(() => check(attempt + 1), 2000);
    else target.innerHTML = `<p>${t('servers.result.pending')}</p><h1>${t('servers.result.delayed')}</h1><p>${t('servers.result.delayedBody')}</p><a class="button button-primary" href="/servers/publish" data-link>${t('servers.result.myListings')}</a>`;
  }
  check();
  return () => {
    canceled = true;
    cleanupAnimation();
  };
}
