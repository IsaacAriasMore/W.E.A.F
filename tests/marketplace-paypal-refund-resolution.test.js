import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMarketplaceCaptureId } from '../supabase/functions/_shared/paypal.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const webhook = read('../supabase/functions/paypal-webhook/index.ts');
const migration = read('../supabase/migrations/20260809193432_marketplace_refund_original_capture_resolution.sql');

const refundId = 'REFUND-12345678';
const captureId = 'CAPTURE-12345678';
const captureLink = (host = 'api.sandbox.paypal.com', path = `/v2/payments/captures/${captureId}`) => ({
  rel: 'up', method: 'GET', href: `https://${host}${path}`,
});

test('refund resolver prefers a valid related capture identifier', async () => {
  const result = await resolveMarketplaceCaptureId('PAYMENT.CAPTURE.REFUNDED', {
    id: refundId,
    supplementary_data: { related_ids: { capture_id: captureId } },
    links: [captureLink('evil.example')],
  });
  assert.equal(result, captureId);
});

test('sanitized real refund shape resolves the original capture through a payload up link', async () => {
  const result = await resolveMarketplaceCaptureId('PAYMENT.CAPTURE.REFUNDED', {
    id: refundId,
    supplementary_data: { related_ids: {} },
    links: [
      { rel: 'self', method: 'GET', href: `https://api.sandbox.paypal.com/v2/payments/refunds/${refundId}` },
      captureLink(),
    ],
  });
  assert.equal(result, captureId);
});

test('refund resolver falls back to a server-side refund lookup only when the payload has no capture link', async () => {
  const calls = [];
  const result = await resolveMarketplaceCaptureId(
    'PAYMENT.CAPTURE.REFUNDED',
    { id: refundId, supplementary_data: { related_ids: {} }, links: [] },
    async (id) => {
      calls.push(id);
      return { links: [captureLink()] };
    },
  );
  assert.equal(result, captureId);
  assert.deepEqual(calls, [refundId]);
});

test('refund resolver fails closed for invalid hosts and non-capture up links', async () => {
  for (const link of [
    captureLink('evil.example'),
    captureLink('api.sandbox.paypal.com', `/v2/payments/refunds/${refundId}`),
    { ...captureLink(), method: 'POST' },
  ]) {
    const result = await resolveMarketplaceCaptureId(
      'PAYMENT.CAPTURE.REFUNDED',
      { id: refundId, supplementary_data: { related_ids: {} }, links: [link] },
      async () => ({ links: [link] }),
    );
    assert.equal(result, null);
  }
});

test('a refund identifier is never silently reused as a capture identifier', async () => {
  const result = await resolveMarketplaceCaptureId('PAYMENT.CAPTURE.REFUNDED', {
    id: refundId,
    supplementary_data: { related_ids: {} },
    links: [],
  });
  assert.equal(result, null);
});

test('completed, denied, and reversed retain their resource capture identifier behavior', async () => {
  for (const eventType of [
    'PAYMENT.CAPTURE.COMPLETED',
    'PAYMENT.CAPTURE.DENIED',
    'PAYMENT.CAPTURE.REVERSED',
  ]) {
    assert.equal(await resolveMarketplaceCaptureId(eventType, { id: captureId }), captureId);
  }
});

test('webhook uses the resolver, preserves refund_id, and limits refund lookup to PayPal server-side calls', () => {
  assert.match(webhook, /resolveMarketplaceCaptureId/);
  assert.match(webhook, /\/v2\/payments\/refunds\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(webhook, /refund_id: refundId/);
  assert.doesNotMatch(webhook, /capture_id:\s*eventType\.startsWith\("PAYMENT\.CAPTURE\."\)\s*\?\s*\(resource\.id/);
});

test('migration retries only an audited reconciliation failure with the same event id and keeps security grants', () => {
  assert.match(migration, /prior_processing_error is distinct from 'marketplace_capture_reconciliation_failed'/);
  assert.match(migration, /for update/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.process_marketplace_paypal_event/);
  assert.match(migration, /grant execute on function public\.process_marketplace_paypal_event/);
  assert.doesNotMatch(migration, /delete from private\.billing_events/i);
});
