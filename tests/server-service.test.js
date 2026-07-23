import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerService } from '../src/services/serverService.js';

test('public listings request only active server records', async () => {
  const calls = [];
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    or(filter) { calls.push(['or', filter]); return this; },
    order(column, options) { calls.push(['order', column, options]); return this; },
    then(resolve) { resolve({ data: [], error: null }); },
  };
  const service = createServerService({ from(table) { calls.push(['from', table]); return query; } });
  await service.listPublic();
  assert.deepEqual(calls[0], ['from', 'server_listings']);
  assert.deepEqual(calls.find((call) => call[0] === 'eq'), ['eq', 'status', 'active']);
  assert.deepEqual(calls.find((call) => call[0] === 'or'), ['or', 'payment_status.eq.paid,and(billing_source.eq.manual,payment_status.eq.not_required)']);
});

test('server event tracking sends only the listing and event type', async () => {
  let call;
  const service = createServerService({
    functions: { async invoke(name, options) { call = { name, options }; return { data: { recorded: true }, error: null }; } },
  });
  await service.track('listing-id', 'discord_click');
  assert.deepEqual(call, { name: 'track-server-event', options: { body: { listingId: 'listing-id', eventType: 'discord_click' } } });
});

test('server event tracking failures are non-blocking', async () => {
  const service = createServerService({
    functions: { async invoke() { return { data: null, error: new Error('tracking_failed') }; } },
  });
  assert.deepEqual(await service.track('listing-id', 'impression'), { data: null, error: null });
});

test('server event tracking also swallows transport failures', async () => {
  const service = createServerService({
    functions: { async invoke() { throw new Error('network unavailable'); } },
  });
  assert.deepEqual(await service.track('listing-id', 'website_click'), { data: null, error: null });
});

test('PayPal subscription starts in a protected Edge Function without exposing secrets', async () => {
  let call;
  const service = createServerService({ functions: { async invoke(name, options) { call = { name, options }; return { data: { url: 'https://sandbox.paypal.com/webapps/billing/subscriptions?token=TEST' }, error: null }; } } });
  const result = await service.startSubscription('listing-id', 'plan-version-id', 'idempotency-key');
  assert.deepEqual(call, { name: 'create-paypal-subscription', options: { body: { server_listing_id: 'listing-id', plan_version_id: 'plan-version-id', idempotency_key: 'idempotency-key' } } });
  assert.ok(result.data.url.includes('paypal.com'));
});

test('listing draft is saved through the PayPal-scoped RPC before checkout', async () => {
  let call;
  const service = createServerService({ async rpc(name, params) { call = { name, params }; return { data: 'listing-id', error: null }; } });
  await service.saveListingDraft(null, 'normal', { title: 'Servidor Norte' });
  assert.deepEqual(call, {
    name: 'save_paypal_server_listing_draft',
    params: { p_listing_id: null, p_plan_type: 'normal', p_payload: { title: 'Servidor Norte' } },
  });
});

test('billing data is fetched through authenticated RPC', async () => {
  let call;
  const service = createServerService({ async rpc(name, params) { call = { name, params }; return { data: { subscriptions: [], payments: [], listings: [] }, error: null }; } });
  const result = await service.getMyBilling();
  assert.equal(call.name, 'get_my_server_billing');
  assert.deepEqual(result.data, { subscriptions: [], payments: [], listings: [] });
});

test('paid listing creation uses the active subscription entitlement', async () => {
  let call;
  const service = createServerService({ async rpc(name, params) { call = { name, params }; return { data: 'listing-id', error: null }; } });
  await service.createListing('subscription-id', { title: 'Servidor Norte' });
  assert.deepEqual(call, { name: 'create_paid_server_listing', params: { p_subscription_id: 'subscription-id', p_payload: { title: 'Servidor Norte' } } });
});
