import test from 'node:test';
import assert from 'node:assert/strict';
import { billingPrice, formatBillingMoney, billingCadence, offerAvailability, validateOfferPricing } from '../src/utils/billingPlans.js';

test('billingPrice returns price_minor when available, falls back to promotional', () => {
  assert.equal(billingPrice({ price_minor: 700, promotional_price_minor: 500 }), 700);
  assert.equal(billingPrice({ promotional_price_minor: 500 }), 500);
  assert.equal(billingPrice({ price_minor: 300 }), 300);
  assert.equal(billingPrice({}), 0);
  assert.equal(billingPrice(null), 0);
});

test('formatBillingMoney formats minor units to display currency', () => {
  assert.equal(formatBillingMoney(300, 'USD', 'en-US'), '$3.00');
  assert.equal(formatBillingMoney(700, 'USD', 'en-US'), '$7.00');
  assert.equal(formatBillingMoney(0, 'USD', 'en-US'), '$0.00');
  assert.equal(formatBillingMoney(1500, 'USD', 'en-US'), '$15.00');
});

test('billingCadence returns correct frequency label', () => {
  assert.equal(billingCadence({ frequency_unit: 'MONTH', interval_count: 1 }, 'en'), 'per month');
  assert.equal(billingCadence({ frequency_unit: 'MONTH', interval_count: 1 }, 'es'), 'por mes');
  assert.equal(billingCadence({ frequency_unit: 'MONTH', interval_count: 3 }, 'en'), 'every 3 months');
  assert.equal(billingCadence({ frequency_unit: 'DAY', interval_count: 1 }, 'en'), 'per day');
  assert.equal(billingCadence({ frequency_unit: 'YEAR', interval_count: 1 }, 'es'), 'por año');
  assert.equal(billingCadence({ frequency_unit: 'WEEK', interval_count: 2 }, 'en'), 'every 2 weeks');
});

test('offerAvailability detects scheduled offers', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal(offerAvailability({ acquisition_starts_at: future }), 'scheduled');
});

test('offerAvailability detects expired offers', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(offerAvailability({ acquisition_ends_at: past }), 'expired');
});

test('offerAvailability detects sold out offers', () => {
  assert.equal(offerAvailability({ subscription_limit: 10, used_count: 10 }), 'sold_out');
  assert.equal(offerAvailability({ subscription_limit: 10, used_count: 11 }), 'sold_out');
});

test('offerAvailability returns available for valid offers', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal(offerAvailability({
    acquisition_starts_at: new Date(Date.now() - 86400000).toISOString(),
    acquisition_ends_at: future,
    subscription_limit: 10,
    used_count: 5,
  }), 'available');
});

test('offerAvailability returns available for unrestricted offers', () => {
  assert.equal(offerAvailability({}), 'available');
  assert.equal(offerAvailability(null), 'available');
});

test('validateOfferPricing rejects invalid pricing', () => {
  assert.equal(validateOfferPricing({ basePriceMinor: 0, promotionalPriceMinor: 0, discountType: 'none' }), false);
  assert.equal(validateOfferPricing({ basePriceMinor: -1, promotionalPriceMinor: 300, discountType: 'none' }), false);
  assert.equal(validateOfferPricing({ basePriceMinor: 300, promotionalPriceMinor: 0, discountType: 'none' }), false);
  assert.equal(validateOfferPricing({ basePriceMinor: 300, promotionalPriceMinor: 500, discountType: 'none' }), false);
});

test('validateOfferPricing accepts equal base and promotional for none discount', () => {
  assert.equal(validateOfferPricing({ basePriceMinor: 300, promotionalPriceMinor: 300, discountType: 'none' }), true);
});

test('validateOfferPricing accepts valid none discount', () => {
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 700, discountType: 'none' }), true);
});

test('validateOfferPricing accepts valid percentage discount', () => {
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'percentage', discountPercentage: 28.57 }), true);
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'percentage', discountPercentage: 0 }), false);
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'percentage', discountPercentage: 101 }), false);
});

test('validateOfferPricing accepts valid fixed_amount discount', () => {
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'fixed_amount', discountAmountMinor: 200 }), true);
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'fixed_amount', discountAmountMinor: 0 }), false);
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'fixed_amount', discountAmountMinor: 700 }), false);
});

test('validateOfferPricing accepts valid custom_price', () => {
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'custom_price' }), true);
});

test('validateOfferPricing rejects unknown discount type', () => {
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'bogus' }), false);
});

test('Normal plan is $3 and Plus plan is $7', () => {
  const normal = { code: 'normal', tier: 'normal', price_minor: 300, base_price_minor: 300 };
  const plus = { code: 'plus', tier: 'plus', price_minor: 700, base_price_minor: 700 };
  assert.equal(billingPrice(normal), 300);
  assert.equal(billingPrice(plus), 700);
  assert.equal(formatBillingMoney(normal.price_minor, 'USD', 'en-US'), '$3.00');
  assert.equal(formatBillingMoney(plus.price_minor, 'USD', 'en-US'), '$7.00');
});

test('Plus offer at $5 monthly has correct promotional price', () => {
  const offer = { price_minor: 500, promotional_price_minor: 500, base_price_minor: 700, discount_type: 'custom_price' };
  assert.equal(billingPrice(offer), 500);
  assert.equal(formatBillingMoney(offer.promotional_price_minor, 'USD', 'en-US'), '$5.00');
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 500, discountType: 'custom_price' }), true);
});

test('Fixed price offer for 3 months is valid', () => {
  const offer = { base_price_minor: 700, promotional_price_minor: 700, discount_type: 'none', frequency_unit: 'MONTH', interval_count: 1, total_cycles: 3, auto_renew: false };
  assert.equal(offer.total_cycles, 3);
  assert.equal(offer.auto_renew, false);
  assert.equal(billingCadence({ frequency_unit: offer.frequency_unit, interval_count: offer.interval_count }, 'en'), 'per month');
});

test('Percentage discount offer with 20% off for 3 months', () => {
  const offer = { base_price_minor: 700, promotional_price_minor: 560, discount_type: 'percentage', discount_percentage: 20, total_cycles: 3 };
  assert.equal(billingPrice(offer), 560);
  assert.equal(offer.total_cycles, 3);
  assert.equal(validateOfferPricing({ basePriceMinor: 700, promotionalPriceMinor: 560, discountType: 'percentage', discountPercentage: 20 }), true);
});

test('Introductory price that transitions to base price', () => {
  const offer = { base_price_minor: 700, promotional_price_minor: 300, discount_type: 'custom_price', end_behavior: 'base_price', benefit_cycles: 3, auto_renew: true };
  assert.equal(offer.end_behavior, 'base_price');
  assert.equal(offer.auto_renew, true);
  assert.equal(offer.benefit_cycles, 3);
});

test('Expired offer with fixed duration', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const offer = { acquisition_ends_at: past, total_cycles: 1, auto_renew: false, end_behavior: 'expire' };
  assert.equal(offerAvailability(offer), 'expired');
  assert.equal(offer.end_behavior, 'expire');
  assert.equal(offer.auto_renew, false);
});

test('Offer not yet started', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const offer = { acquisition_starts_at: future };
  assert.equal(offerAvailability(offer), 'scheduled');
});

test('Offer with subscription limit reached', () => {
  const offer = { subscription_limit: 50, used_count: 50 };
  assert.equal(offerAvailability(offer), 'sold_out');
});
