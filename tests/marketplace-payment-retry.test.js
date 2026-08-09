import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getFeaturedCheckoutAction, startFeaturedCheckout } from '../src/utils/marketplaceFeaturedCheckout.js';

const listing = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'QA ASA listing',
  game: 'ascended',
  status: 'active',
  is_featured: false,
  published_at: '2026-08-01T00:00:00.000Z',
  expires_at: '2026-08-08T00:00:00.000Z',
};
const settings = { featured_enabled: true, payments_enabled: true, qa_eligible: true };
const retryPayment = {
  listing_id: listing.id,
  provider: 'paypal',
  environment: 'sandbox',
  status: 'created',
  amount_minor: 300,
  currency: 'USD',
  paypal_order_id: 'ORDER_FOR_TESTS_ONLY',
  paypal_capture_id: null,
  paid_at: null,
};
const retryMigration = readFileSync(new URL('../supabase/migrations/20260809171235_marketplace_payment_retry_reuse.sql', import.meta.url), 'utf8');

test('only a single compatible created Sandbox order receives a retry CTA', () => {
  assert.equal(getFeaturedCheckoutAction(listing, [retryPayment], settings), 'retry');
  assert.equal(getFeaturedCheckoutAction(listing, [], settings), 'start');
});

test('retry CTA is hidden for incompatible, terminal, or ineligible states', () => {
  for (const payment of [
    { ...retryPayment, environment: 'live' },
    { ...retryPayment, amount_minor: 301 },
    { ...retryPayment, currency: 'EUR' },
    { ...retryPayment, paypal_capture_id: 'capture' },
    { ...retryPayment, paid_at: '2026-08-01T00:00:00.000Z' },
    { ...retryPayment, status: 'approved' },
    { ...retryPayment, status: 'captured' },
    { ...retryPayment, status: 'failed' },
    { ...retryPayment, status: 'refunded' },
    { ...retryPayment, status: 'reversed' },
  ]) assert.equal(getFeaturedCheckoutAction(listing, [payment], settings), null);

  assert.equal(getFeaturedCheckoutAction({ ...listing, is_featured: true }, [], settings), null);
  assert.equal(getFeaturedCheckoutAction({ ...listing, featured_started_at: '2026-08-01T00:00:00.000Z', featured_expires_at: '2099-08-08T00:00:00.000Z' }, [], settings), null);
  assert.equal(getFeaturedCheckoutAction({ ...listing, game: 'evolved' }, [], settings), null);
  assert.equal(getFeaturedCheckoutAction(listing, [retryPayment], { ...settings, payments_enabled: false }), null);
  assert.equal(getFeaturedCheckoutAction(listing, [retryPayment], { ...settings, qa_eligible: false }), null);
  assert.equal(getFeaturedCheckoutAction(listing, [retryPayment, retryPayment], settings), null);
});

test('account markup labels the safe retry without rendering payment or order identifiers', () => {
  const account = readFileSync(new URL('../src/pages/app/marketplaceAccount.js', import.meta.url), 'utf8');
  assert.match(account, /data-featured-checkout/);
  assert.match(account, /marketplace\.retryFeaturedPayment/);
  assert.doesNotMatch(account, /data-payment-id|data-paypal-order-id|data-paypal-capture-id/);
});

test('checkout accepts a reused approval response and creates one request per invocation', async () => {
  const calls = [];
  const redirects = [];
  const service = {
    startFeaturedOrder: async (listingId, key) => {
      calls.push([listingId, key]);
      return { data: { url: 'https://www.sandbox.paypal.com/checkoutnow', reused: true }, error: null };
    },
  };
  const result = await startFeaturedCheckout(listing.id, service, {
    createIdempotencyKey: () => '22222222-2222-2222-2222-222222222222',
    redirect: (url) => redirects.push(url),
  });
  assert.deepEqual(result, { ok: true, reused: true });
  assert.equal(calls.length, 1);
  assert.equal(redirects.length, 1);
});

test('checkout errors and unsafe approval URLs do not redirect', async () => {
  const redirects = [];
  const result = await startFeaturedCheckout(listing.id, {
    startFeaturedOrder: async () => ({ data: { url: 'https://evil.example/checkout' }, error: null }),
  }, { redirect: (url) => redirects.push(url) });
  assert.equal(result.ok, false);
  assert.equal(redirects.length, 0);

  const rejected = await startFeaturedCheckout(listing.id, {
    startFeaturedOrder: async () => { throw new Error('network'); },
  }, { redirect: (url) => redirects.push(url) });
  assert.equal(rejected.ok, false);
  assert.equal(redirects.length, 0);
});

test('click handling prevents a second in-flight checkout call and the cancel route is non-mutating', () => {
  const account = readFileSync(new URL('../src/pages/app/marketplaceAccount.js', import.meta.url), 'utf8');
  const resultPage = readFileSync(new URL('../src/pages/app/marketplacePaymentResult.js', import.meta.url), 'utf8');
  assert.match(account, /if \(checkout\.disabled\) return;/);
  assert.match(account, /checkout\.disabled = true;/);
  assert.match(account, /await startFeaturedCheckout\(checkout\.dataset\.featuredCheckout, service\)/);
  assert.match(resultPage, /if \(path\.endsWith\('\/cancel'\)\) \{ root\.querySelector\('\.route-loading'\)\?\.remove\(\); return; \}/);
});

test('retry migration is server-only, lock-serialized, and reuses only the immutable Sandbox shape', () => {
  assert.match(retryMigration, /security definer/);
  assert.match(retryMigration, /set search_path = ''/);
  assert.match(retryMigration, /owner_user_id = p_user_id[\s\S]*?for update/);
  assert.match(retryMigration, /p\.provider = 'paypal'[\s\S]*?p\.environment = 'sandbox'[\s\S]*?p\.status = 'created'/);
  assert.match(retryMigration, /p\.amount_minor = 300[\s\S]*?p\.currency = 'USD'/);
  assert.match(retryMigration, /p\.paypal_order_id is not null[\s\S]*?p\.paypal_capture_id is null[\s\S]*?p\.paid_at is null/);
  assert.match(retryMigration, /reusable_count = 1/);
  assert.match(retryMigration, /reusable_count > 1[\s\S]*?marketplace_payment_in_progress/);
  assert.match(retryMigration, /revoke all on function public\.prepare_marketplace_paypal_order[\s\S]*?from public, anon, authenticated/);
  assert.match(retryMigration, /grant execute on function public\.prepare_marketplace_paypal_order[\s\S]*?to service_role/);
  assert.doesNotMatch(retryMigration, /delete\s+from\s+public\.marketplace_payments/i);
});
