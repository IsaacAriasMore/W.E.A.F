import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260722150505_stripe_cancellation_visibility.sql', import.meta.url), 'utf8');

test('scheduled Stripe cancellation immediately pauses and removes featured state', () => {
  assert.match(migration, /elsif new\.cancel_at_period_end then[\s\S]*new\.status :=[\s\S]*'paused'/i);
  assert.match(migration, /new\.is_featured := false/i);
});
test('failed and canceled payments cannot remain publicly active', () => {
  assert.match(migration, /new\.payment_status = 'canceled'[\s\S]*new\.status := 'canceled'/i);
  assert.match(migration, /new\.payment_status = 'failed'[\s\S]*'paused'/i);
});

test('RLS exposes only paid Stripe or not-required manual listings', () => {
  assert.match(migration, /billing_source = 'stripe' and payment_status = 'paid' and not cancel_at_period_end/i);
  assert.match(migration, /billing_source = 'manual' and payment_status = 'not_required'/i);
  assert.match(migration, /owner_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /private\.is_global_admin\(\)/i);
});
