import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PayPal kill switch is enforced in UI, Edge Function and database', () => {
  const service = read('src/services/serverService.js');
  const edge = read('supabase/functions/create-paypal-subscription/index.ts');
  const migration = read('supabase/migrations/20260729004321_paypal_kill_switch.sql');
  assert.match(service, /get_paypal_checkout_status/);
  assert.match(edge, /feature_flags[\s\S]*paypal_payments/);
  assert.match(migration, /before insert on public\.billing_subscriptions/);
  assert.match(migration, /raise exception 'billing_disabled'/);
});

test('kill switch leaves lifecycle workers and cancellation available', () => {
  for (const path of [
    'supabase/functions/paypal-webhook/index.ts',
    'supabase/functions/reconcile-paypal-subscriptions/index.ts',
    'supabase/functions/cancel-paypal-subscription/index.ts',
  ]) {
    assert.doesNotMatch(read(path), /feature_flags[\s\S]*paypal_payments/);
  }
});

test('PayPal webhook recognizes every required subscription event', () => {
  const webhook = read('supabase/functions/paypal-webhook/index.ts');
  for (const event of [
    'BILLING.SUBSCRIPTION.CREATED',
    'BILLING.SUBSCRIPTION.ACTIVATED',
    'BILLING.SUBSCRIPTION.UPDATED',
    'BILLING.SUBSCRIPTION.CANCELLED',
    'BILLING.SUBSCRIPTION.SUSPENDED',
    'BILLING.SUBSCRIPTION.EXPIRED',
    'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
    'PAYMENT.SALE.COMPLETED',
    'PAYMENT.SALE.REFUNDED',
    'PAYMENT.SALE.REVERSED',
  ]) assert.match(webhook, new RegExp(event.replaceAll('.', '\\.')));
});

test('success route uses subscription billing dates and never constructs Date from null', () => {
  const page = read('src/pages/public/serverBillingResult.js');
  assert.match(page, /subscription\?\.next_billing_time/);
  assert.match(page, /subscription\?\.current_period_end/);
  assert.match(page, /billingDate \? new Date\(billingDate\)/);
  assert.doesNotMatch(page, /new Date\(listing\.expires_at\)/);
});

test('return URL remains informational and cannot activate a listing', () => {
  const page = read('src/pages/public/serverBillingResult.js');
  assert.match(page, /getMyBilling\(\)/);
  assert.doesNotMatch(page, /status\s*:\s*['"]active|update_paid|process_paypal/);
});

test('PayPal remains hard-locked to Sandbox', () => {
  const client = read('supabase/functions/_shared/paypal.ts');
  const example = read('.env.example');
  assert.match(client, /mode !== "sandbox"/);
  assert.match(client, /https:\/\/api-m\.sandbox\.paypal\.com/);
  assert.match(example, /PAYPAL_MODE=sandbox/);
  assert.doesNotMatch(example, /PAYPAL_MODE=live/);
});
