import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PayPalError } from '../supabase/functions/_shared/paypal.ts';
import { resolveMarketplacePayPalCapture } from '../supabase/functions/_shared/paypalCaptureFlow.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const edge = read('../supabase/functions/capture-marketplace-paypal-order/index.ts');
const flow = read('../supabase/functions/_shared/paypalCaptureFlow.ts');
const migration = read('../supabase/migrations/20260731233000_marketplace_capture_api_reconciliation.sql');

const completedCapture = {
  id: 'CAPTURE1', status: 'COMPLETED',
  amount: { value: '3.00', currency_code: 'USD' },
  create_time: '2026-07-31T12:00:00Z', update_time: '2026-07-31T12:00:05Z',
  supplementary_data: { related_ids: { order_id: 'ORDER1' } },
};

const makeDeps = (overrides = {}) => ({
  prepared: {
    payment_id: 'p1',
    listing_id: 'l1',
    paypal_order_id: 'ORDER1',
    idempotency_key: 'ik1',
    already_captured: false,
    payment_status: 'approved',
    paypal_capture_id: null,
    amount_minor: 300,
    currency: 'USD',
    environment: 'sandbox',
  },
  userId: 'u1',
  getCapture: async () => completedCapture,
  postCapture: async () => completedCapture,
  confirm: async () => ({ data: { confirmed: true, reused: false } }),
  recordResponse: async () => ({}),
  ...overrides,
});

test('already_captured returns confirmed with reused=true without calling PayPal', async () => {
  let called = false;
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({ prepared: { ...makeDeps().prepared, already_captured: true, payment_status: 'captured', paypal_capture_id: 'CAPTURE1' }, getCapture: async () => { called = true; return {}; } }),
  );
  assert.deepEqual(outcome, { ok: true, status: 'confirmed', listing_id: 'l1', reused: true });
  assert.equal(called, false);
});

test('flow A: GET with a COMPLETED capture and matching order id confirms immediately', async () => {
  const confirmCalls = [];
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      prepared: { ...makeDeps().prepared, paypal_capture_id: 'CAPTURE1' },
      confirm: async (args) => { confirmCalls.push(args); return { data: { confirmed: true, reused: false } }; },
    }),
  );
  assert.deepEqual(outcome, { ok: true, status: 'confirmed', listing_id: 'l1', reused: false });
  assert.equal(confirmCalls.length, 1);
  assert.equal(confirmCalls[0].p_capture_id, 'CAPTURE1');
  assert.equal(confirmCalls[0].p_order_id, 'ORDER1');
  assert.equal(confirmCalls[0].p_amount_minor, 300);
  assert.equal(confirmCalls[0].p_currency, 'USD');
  assert.equal(confirmCalls[0].p_captured_at, '2026-07-31T12:00:00Z');
});

test('flow A: GET is used and POST is never sent when a capture id exists', async () => {
  const postCalls = [];
  await resolveMarketplacePayPalCapture(
    makeDeps({
      prepared: { ...makeDeps().prepared, paypal_capture_id: 'CAPTURE1' },
      postCapture: async (orderId) => { postCalls.push(orderId); return {}; },
    }),
  );
  assert.equal(postCalls.length, 0);
});

test('flow A: order id mismatch raises marketplace_capture_reconciliation_failed', async () => {
  const confirmCalls = [];
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      prepared: { ...makeDeps().prepared, paypal_capture_id: 'CAPTURE1' },
      getCapture: async () => ({ ...completedCapture, supplementary_data: { related_ids: { order_id: 'OTHER-ORDER' } } }),
      confirm: async (args) => { confirmCalls.push(args); return { data: { confirmed: true, reused: false } }; },
    }),
  );
  assert.deepEqual(outcome, { ok: false, code: 'marketplace_capture_reconciliation_failed', status: 409 });
  assert.equal(confirmCalls.length, 0);
});

test('flow A: amount mismatch raises marketplace_capture_reconciliation_failed', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      prepared: { ...makeDeps().prepared, paypal_capture_id: 'CAPTURE1' },
      getCapture: async () => ({ ...completedCapture, amount: { value: '3.50', currency_code: 'USD' } }),
    }),
  );
  assert.deepEqual(outcome, { ok: false, code: 'marketplace_capture_reconciliation_failed', status: 409 });
});

test('flow A: a non-COMPLETED capture is reported as pending without re-recording', async () => {
  const recordCalls = [];
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      prepared: { ...makeDeps().prepared, paypal_capture_id: 'CAPTURE1' },
      getCapture: async () => ({ ...completedCapture, status: 'PENDING' }),
      recordResponse: async (paymentId, userId, captureId, status) => { recordCalls.push([paymentId, userId, captureId, status]); return {}; },
    }),
  );
  assert.deepEqual(outcome, { ok: true, status: 'pending_confirmation', listing_id: 'l1' });
  assert.equal(recordCalls.length, 0);
});

test('flow B: POST with a COMPLETED capture confirms immediately', async () => {
  const requestIds = [];
  const confirmCalls = [];
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      postCapture: async (orderId, requestId) => { requestIds.push([orderId, requestId]); return completedCapture; },
      confirm: async (args) => { confirmCalls.push(args); return { data: { confirmed: true, reused: false } }; },
    }),
  );
  assert.deepEqual(outcome, { ok: true, status: 'confirmed', listing_id: 'l1', reused: false });
  assert.deepEqual(requestIds, [['ORDER1', 'ik1-capture']]);
  assert.equal(confirmCalls.length, 1);
});

test('flow B: a PENDING capture records the response and reports pending_confirmation', async () => {
  const recordCalls = [];
  const confirmCalls = [];
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      postCapture: async () => ({ ...completedCapture, status: 'PENDING' }),
      recordResponse: async (paymentId, userId, captureId, status) => { recordCalls.push([paymentId, userId, captureId, status]); return {}; },
      confirm: async (args) => { confirmCalls.push(args); return { data: { confirmed: true, reused: false } }; },
    }),
  );
  assert.deepEqual(outcome, { ok: true, status: 'pending_confirmation', listing_id: 'l1' });
  assert.deepEqual(recordCalls, [['p1', 'u1', 'CAPTURE1', 'PENDING']]);
  assert.equal(confirmCalls.length, 0);
});

test('flow B: missing capture id raises marketplace_capture_reconciliation_failed', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({ postCapture: async () => ({ ...completedCapture, id: undefined }) }),
  );
  assert.deepEqual(outcome, { ok: false, code: 'marketplace_capture_reconciliation_failed', status: 409 });
});

test('flow B: amount mismatch on the POST response raises reconciliation_failed', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({ postCapture: async () => ({ ...completedCapture, amount: { value: '3.01', currency_code: 'USD' } }) }),
  );
  assert.deepEqual(outcome, { ok: false, code: 'marketplace_capture_reconciliation_failed', status: 409 });
});

test('a confirm RPC error maps to marketplace_capture_reconciliation_failed 500', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({ confirm: async () => ({ error: { message: 'rpc failed' } }) }),
  );
  assert.deepEqual(outcome, { ok: false, code: 'marketplace_capture_reconciliation_failed', status: 500 });
});

test('a confirm RPC that reports reused=true returns reused to the caller', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({ confirm: async () => ({ data: { confirmed: true, reused: true } }) }),
  );
  assert.deepEqual(outcome, { ok: true, status: 'confirmed', listing_id: 'l1', reused: true });
});

test('a recordResponse error maps to marketplace_capture_reconciliation_failed 500', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      postCapture: async () => ({ ...completedCapture, status: 'PENDING' }),
      recordResponse: async () => ({ error: { message: 'rpc failed' } }),
    }),
  );
  assert.deepEqual(outcome, { ok: false, code: 'marketplace_capture_reconciliation_failed', status: 500 });
});

test('PayPal API errors propagate their code and status', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      prepared: { ...makeDeps().prepared, paypal_capture_id: 'CAPTURE1' },
      getCapture: async () => { throw new PayPalError('paypal_api_error', 422); },
    }),
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.code, 'paypal_api_error');
    assert.equal(outcome.status, 422);
  }
});

test('unexpected errors map to marketplace_capture_failed 502', async () => {
  const outcome = await resolveMarketplacePayPalCapture(
    makeDeps({
      prepared: { ...makeDeps().prepared, paypal_capture_id: 'CAPTURE1' },
      getCapture: async () => { throw new Error('boom'); },
    }),
  );
  assert.deepEqual(outcome, { ok: false, code: 'marketplace_capture_failed', status: 502 });
});

test('edge function wires GET-for-known-capture and POST-only-once and never exposes PayPal ids', () => {
  assert.match(edge, /getCapture/);
  assert.match(edge, /postCapture/);
  assert.match(edge, /confirm_marketplace_paypal_capture_from_api/);
  assert.match(edge, /record_marketplace_capture_response/);
  assert.match(edge, /pending_confirmation/);
  assert.match(edge, /\/v2\/payments\/captures\//);
  assert.match(edge, /\/v2\/checkout\/orders\/\$\{encodeURIComponent\(orderId\)\}\/capture/);
  assert.doesNotMatch(edge, /paypal_capture_id/);
  assert.match(flow, /marketplace_capture_reconciliation_failed/);
  assert.match(migration, /create or replace function public\.confirm_marketplace_paypal_capture_from_api/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /revoke all on function public\.prepare_marketplace_paypal_capture\(uuid,uuid\),public\.confirm_marketplace_paypal_capture_from_api\(uuid,uuid,text,text,integer,text,timestamptz\),public\.process_marketplace_paypal_event\(text,text,jsonb,jsonb\) from public,anon,authenticated/);
  assert.match(migration, /grant execute on function public\.prepare_marketplace_paypal_capture\(uuid,uuid\),public\.confirm_marketplace_paypal_capture_from_api\(uuid,uuid,text,text,integer,text,timestamptz\),public\.process_marketplace_paypal_event\(text,text,jsonb,jsonb\) to service_role/);
  assert.match(migration, /capture_confirmed_from_api/);
  assert.match(migration, /confirmation_source','paypal_api/);
  assert.match(migration, /reused/);
  assert.doesNotMatch(migration, /password|authorization/i);
});
