import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerService } from '../src/services/serverService.js';

test('public listings request only active server records', async () => {
  const calls = [];
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    order(column, options) { calls.push(['order', column, options]); return this; },
    then(resolve) { resolve({ data: [], error: null }); },
  };
  const service = createServerService({ from(table) { calls.push(['from', table]); return query; } });
  await service.listPublic();
  assert.deepEqual(calls[0], ['from', 'server_listings']);
  assert.deepEqual(calls.find((call) => call[0] === 'eq'), ['eq', 'status', 'active']);
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
  const service = createServerService({ functions: { async invoke(name, options) { call = { name, options }; return { data: { checkoutUrl: 'https://checkout.stripe.com/test' }, error: null }; } } });
  const result = await service.startCheckout('plus');
  assert.deepEqual(call, { name: 'create-server-checkout', options: { body: { planCode: 'plus' } } });
  assert.equal(result.data.checkoutUrl, 'https://checkout.stripe.com/test');
});

test('paid listing creation uses the active subscription entitlement', async () => {
  let call;
  const service = createServerService({ async rpc(name, params) { call = { name, params }; return { data: 'listing-id', error: null }; } });
  await service.createListing('subscription-id', { title: 'Servidor Norte' });
  assert.deepEqual(call, { name: 'create_paid_server_listing', params: { p_subscription_id: 'subscription-id', p_payload: { title: 'Servidor Norte' } } });
});
