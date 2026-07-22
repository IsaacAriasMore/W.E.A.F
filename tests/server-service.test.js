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

test('checkout starts in a protected Edge Function without exposing Stripe keys', async () => {
  let call;
  const service = createServerService({ functions: { async invoke(name, options) { call = { name, options }; return { data: { url: 'https://checkout.stripe.com/test' }, error: null }; } } });
  const result = await service.startCheckout('listing-id', 'plus');
  assert.deepEqual(call, { name: 'create-server-listing-checkout', options: { body: { server_listing_id: 'listing-id', plan_type: 'plus' } } });
  assert.equal(result.data.url, 'https://checkout.stripe.com/test');
});

test('listing draft is saved through the owner-scoped RPC before checkout', async () => {
  let call;
  const service = createServerService({ async rpc(name, params) { call = { name, params }; return { data: 'listing-id', error: null }; } });
  await service.saveListingDraft(null, 'normal', { title: 'Servidor Norte' });
  assert.deepEqual(call, {
    name: 'save_server_listing_draft',
    params: { p_listing_id: null, p_plan_type: 'normal', p_payload: { title: 'Servidor Norte' } },
  });
});

test('billing portal is created server-side', async () => {
  let call;
  const service = createServerService({ functions: { async invoke(name, options) { call = { name, options }; return { data: { url: 'https://billing.stripe.com/test' }, error: null }; } } });
  const result = await service.openBillingPortal();
  assert.deepEqual(call, { name: 'create-billing-portal-session', options: { body: {} } });
  assert.equal(result.data.url, 'https://billing.stripe.com/test');
});

test('paid listing creation uses the active subscription entitlement', async () => {
  let call;
  const service = createServerService({ async rpc(name, params) { call = { name, params }; return { data: 'listing-id', error: null }; } });
  await service.createListing('subscription-id', { title: 'Servidor Norte' });
  assert.deepEqual(call, { name: 'create_paid_server_listing', params: { p_subscription_id: 'subscription-id', p_payload: { title: 'Servidor Norte' } } });
});
