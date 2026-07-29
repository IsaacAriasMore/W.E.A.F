import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const createOrder = read('../supabase/functions/create-marketplace-paypal-order/index.ts');
const captureOrder = read('../supabase/functions/capture-marketplace-paypal-order/index.ts');
const webhook = read('../supabase/functions/paypal-webhook/index.ts');
const migration = read('../supabase/migrations/20260729012207_marketplace_paypal_orders.sql');
const config = read('../supabase/config.toml');

test('marketplace featured checkout is a one-time PayPal Orders Sandbox payment', () => {
  assert.match(createOrder, /PAYPAL_MODE"\) !== "sandbox"/);
  assert.match(createOrder, /\/v2\/checkout\/orders/);
  assert.match(createOrder, /intent: "CAPTURE"/);
  assert.match(createOrder, /PayPal-Request-Id|requestId/);
  assert.doesNotMatch(createOrder, /PAYPAL_MODE.{0,20}live|api-m\.paypal\.com/);
});

test('price, currency, ownership, and idempotency are resolved server-side', () => {
  assert.match(migration, /marketplace_settings where key='featured_listing'/);
  assert.match(migration, /owner_user_id=p_user_id/);
  assert.match(migration, /idempotency_key=p_idempotency_key/);
  assert.match(createOrder, /prepared\.amount_minor/);
  assert.doesNotMatch(createOrder, /body\.price|body\.amount|body\.currency/);
});

test('return capture cannot activate featured without a verified webhook', () => {
  assert.match(captureOrder, /record_marketplace_capture_response/);
  assert.doesNotMatch(captureOrder, /is_featured|featured_activated/);
  assert.match(webhook, /verifyPayPalWebhook/);
  assert.match(webhook, /process_marketplace_paypal_event/);
  assert.match(migration, /PAYMENT\.CAPTURE\.COMPLETED/);
  assert.match(migration, /set status='active',is_featured=true,published_at=event_time,expires_at=event_time\+interval '7 days'/);
});

test('marketplace webhook events are idempotent and revoke benefits on refund or reversal', () => {
  for (const event of ['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED']) {
    assert.match(webhook, new RegExp(event.replaceAll('.', '\\.')));
    assert.match(migration, new RegExp(event.replaceAll('.', '\\.')));
  }
  assert.match(migration, /on conflict\(provider,environment,event_id\) do nothing/);
  assert.match(migration, /set status='refunded',is_featured=false/);
  assert.match(migration, /set status='reversed',is_featured=false/);
});

test('both user-facing marketplace payment functions require platform JWT verification', () => {
  assert.match(config, /\[functions\.create-marketplace-paypal-order\][\s\S]*?verify_jwt = true/);
  assert.match(config, /\[functions\.capture-marketplace-paypal-order\][\s\S]*?verify_jwt = true/);
});
