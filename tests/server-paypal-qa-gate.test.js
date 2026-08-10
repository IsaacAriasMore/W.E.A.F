import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260810020905_server_paypal_sandbox_qa_gate.sql', import.meta.url),
  'utf8',
);

test('Servers QA gate is independent, exact and fail-closed', () => {
  assert.match(migration, /create table private\.server_paypal_qa_settings/);
  assert.match(migration, /create table private\.server_paypal_qa_allowlist/);
  assert.match(migration, /primary key \(user_id, server_listing_id\)/);
  assert.match(migration, /values \('sandbox_allowlist', false\)/);
  assert.match(migration, /p_environment is distinct from 'sandbox'/);
  assert.match(migration, /server_paypal_qa_access_required/);
  assert.doesNotMatch(migration, /marketplace_payment_qa_allowlist/);
});

test('Servers QA gate runs after the global switch and before subscription insertion', () => {
  const globalGate = migration.indexOf("raise exception 'billing_disabled'");
  const environmentGate = migration.indexOf("raise exception 'paypal_sandbox_required'");
  const qaGate = migration.indexOf("raise exception 'server_paypal_qa_access_required'");
  const insert = migration.indexOf('insert into public.billing_subscriptions(');

  assert.ok(globalGate >= 0 && environmentGate > globalGate);
  assert.ok(qaGate > environmentGate && insert > qaGate);
});

test('Servers QA gate preserves private table and function hardening', () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /from public, anon, authenticated, service_role/);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(migration, /revoke all on function private\.is_server_paypal_sandbox_qa_allowed/);
  assert.match(migration, /grant execute on function public\.prepare_paypal_subscription[\s\S]*to service_role/);
});
