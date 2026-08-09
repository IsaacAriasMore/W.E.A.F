import { t } from '../i18n/index.js';
import { trustedPayPalSandboxApprovalUrl } from './safeUrl.js';

export function getFeaturedCheckoutAction(listing, payments = [], settings = {}) {
  const hasActiveFeaturedBenefit = listing?.is_featured
    || (listing?.featured_started_at && Date.parse(listing.featured_expires_at || '') > Date.now());
  if (!listing
    || listing.game !== 'ascended'
    || listing.status !== 'active'
    || hasActiveFeaturedBenefit
    || settings.featured_enabled !== true
    || settings.payments_enabled !== true
    || settings.qa_eligible !== true
  ) return null;

  const related = payments.filter((payment) => payment.listing_id === listing.id);
  if (!related.length) return 'start';
  const retryable = related.filter((payment) => payment.provider === 'paypal'
    && payment.environment === 'sandbox'
    && payment.status === 'created'
    && Number(payment.amount_minor) === 300
    && payment.currency === 'USD'
    && Boolean(payment.paypal_order_id)
    && !payment.paypal_capture_id
    && !payment.paid_at);
  return retryable.length === 1 && related.length === 1 ? 'retry' : null;
}

export async function startFeaturedCheckout(listingId, service, {
  createIdempotencyKey = () => crypto.randomUUID(),
  redirect = (url) => window.location.assign(url),
} = {}) {
  try {
    const order = await service.startFeaturedOrder(listingId, createIdempotencyKey());
    const approval = trustedPayPalSandboxApprovalUrl(order.data?.url);
    if (order.error || !approval) return { ok: false, error: order.error || t('marketplace.errors.paymentStart') };
    redirect(approval);
    return { ok: true, reused: order.data?.reused === true };
  } catch {
    return { ok: false, error: t('marketplace.errors.paymentStart') };
  }
}
