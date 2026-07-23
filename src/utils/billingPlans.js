export function billingPrice(plan) {
  return Number(plan?.price_minor ?? plan?.promotional_price_minor ?? 0);
}

export function formatBillingMoney(minor, currency = 'USD', locale = 'es-CR') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(minor || 0) / 100);
}

export function billingCadence(plan, language = 'es') {
  const count = Number(plan?.interval_count || 1);
  const unit = String(plan?.frequency_unit || 'MONTH').toLowerCase();
  const names = language === 'en'
    ? { day: 'day', week: 'week', month: 'month', year: 'year' }
    : { day: 'día', week: 'semana', month: 'mes', year: 'año' };
  const label = names[unit] || unit;
  return count === 1 ? `${language === 'en' ? 'per' : 'por'} ${label}` : `${language === 'en' ? 'every' : 'cada'} ${count} ${label}${count === 1 ? '' : 's'}`;
}

export function offerAvailability(offer, now = new Date()) {
  const time = now.getTime();
  if (offer?.acquisition_starts_at && new Date(offer.acquisition_starts_at).getTime() > time) return 'scheduled';
  if (offer?.acquisition_ends_at && new Date(offer.acquisition_ends_at).getTime() <= time) return 'expired';
  if (offer?.subscription_limit != null && Number(offer.used_count || 0) >= Number(offer.subscription_limit)) return 'sold_out';
  return 'available';
}

export function validateOfferPricing({ basePriceMinor, promotionalPriceMinor, discountType, discountPercentage, discountAmountMinor }) {
  const base = Number(basePriceMinor);
  const promotional = Number(promotionalPriceMinor);
  if (!Number.isInteger(base) || !Number.isInteger(promotional) || base <= 0 || promotional <= 0 || promotional > base) return false;
  if (discountType === 'percentage') return Number(discountPercentage) > 0 && Number(discountPercentage) <= 100;
  if (discountType === 'fixed_amount') return Number(discountAmountMinor) > 0 && Number(discountAmountMinor) < base;
  return ['none', 'custom_price'].includes(discountType);
}
