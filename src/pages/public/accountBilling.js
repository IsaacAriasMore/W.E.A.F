import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';
import { formatBillingMoney } from '../../utils/billingPlans.js';
import { getLanguage, t } from '../../i18n/index.js';

const date = (value) => value ? new Date(value).toLocaleDateString(getLanguage() === 'es' ? 'es-CR' : 'en-US') : t('servers.billingPage.notAvailable');

export function render() {
  return `<section class="publish-shell container"><header><a href="/servers/publish" data-link>← ${t('servers.billingPage.listings')}</a><p>${t('servers.billingPage.account')}</p><h1>${t('servers.billingPage.title')}</h1></header><div class="publish-loading" data-billing-workspace><span></span><p>${t('servers.billingPage.loading')}</p></div></section>`;
}

export function bind({ authService }) {
  const service = createServerService(authService.getClient());
  const workspace = document.querySelector('[data-billing-workspace]');

  async function load() {
    const result = await service.getMyBilling();
    workspace.className = 'publish-message billing-account';
    if (result.error) { workspace.innerHTML = `<h2>${t('servers.billingPage.error')}</h2><p>${escapeHtml(result.error)}</p>`; return; }
    const subscriptions = result.data?.subscriptions || [];
    const payments = result.data?.payments || [];
    const listings = result.data?.listings || [];
    workspace.innerHTML = `<section><h2>${t('servers.billingPage.subscriptions')}</h2><div class="billing-list">${subscriptions.length ? subscriptions.map((subscription) => {
      const listing = listings.find((item) => item.id === subscription.listing_id);
      const terminal = ['cancelled', 'expired', 'refunded', 'reversed'].includes(subscription.status);
      return `<article><div><strong>${escapeHtml(listing?.title || subscription.plan_name)}</strong><span>${escapeHtml(subscription.offer_name || subscription.plan_name)} · ${formatBillingMoney(subscription.price_minor, subscription.currency, getLanguage() === 'es' ? 'es-CR' : 'en-US')}</span><small>${t('servers.billingPage.status')}: ${escapeHtml(subscription.status)} · ${t('servers.billingPage.nextCharge')}: ${date(subscription.next_billing_time || subscription.current_period_end)}</small><small>${subscription.auto_renew ? t('servers.billingPage.renews') : t('servers.billingPage.fixed')}</small></div>${terminal ? '' : `<button class="button button-secondary" type="button" data-cancel-subscription="${subscription.id}">${t('servers.billingPage.cancel')}</button>`}</article>`;
    }).join('') : `<p>${t('servers.billingPage.empty')}</p>`}</div></section>
      <section><h2>${t('servers.billingPage.payments')}</h2><div class="billing-list">${payments.length ? payments.map((payment) => `<article><strong>${formatBillingMoney(payment.amount_minor, payment.currency, getLanguage() === 'es' ? 'es-CR' : 'en-US')}</strong><span>${escapeHtml(payment.status)}</span><small>${date(payment.paid_at || payment.created_at)}</small></article>`).join('') : `<p>${t('servers.billingPage.noPayments')}</p>`}</div></section>`;
  }

  workspace.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-cancel-subscription]');
    if (!button) return;
    const reason = window.prompt(t('servers.billingPage.cancelReason'), t('servers.billingPage.defaultReason'));
    if (reason === null || !window.confirm(t('servers.billingPage.cancelConfirm'))) return;
    button.disabled = true;
    const result = await service.cancelSubscription(button.dataset.cancelSubscription, reason);
    if (result.error) { showToast(result.error, 'error'); button.disabled = false; return; }
    showToast(t('servers.billingPage.cancelled'));
    await load();
  });

  load();
}
