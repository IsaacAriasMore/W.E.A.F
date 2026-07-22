import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260722162000_production_server_listing_fixes.sql', import.meta.url), 'utf8');

test('scheduled Stripe cancellation immediately cancels and removes featured state', () => {
  assert.match(migration, /p_event_type = 'customer\.subscription\.updated' and cancel_at_end[\s\S]*status = 'canceled'[\s\S]*payment_status = 'canceled'[\s\S]*is_featured = false/i);
  assert.match(migration, /new\.payment_status = 'canceled' or new\.cancel_at_period_end[\s\S]*new\.status :=[\s\S]*'canceled'/i);
});
test('reactivated subscriptions become active again while failures stay private', () => {
  assert.match(migration, /not cancel_at_end[\s\S]*subscription_status in \('active', 'trialing'\)[\s\S]*status = 'active'[\s\S]*payment_status = 'paid'/i);
  assert.match(migration, /new\.payment_status = 'failed'[\s\S]*'paused'/i);
});

test('RLS exposes only paid or explicitly manual listings', () => {
  assert.match(migration, /payment_status = 'paid'[\s\S]*billing_source = 'manual' and payment_status in \('not_required', 'paid'\)/i);
  assert.match(migration, /owner_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /private\.is_global_admin\(\)/i);
});
