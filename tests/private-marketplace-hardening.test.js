import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260809215641_harden_private_marketplace_tables.sql', import.meta.url),
  'utf8',
);
const regression = readFileSync(
  new URL('../supabase/tests/11-private-marketplace-rls-hardening.sql', import.meta.url),
  'utf8',
);

const tables = [
  'marketplace_ranking_secrets',
  'marketplace_payment_qa_settings',
  'marketplace_payment_qa_allowlist',
];

test('private Marketplace tables gain RLS with no client CRUD policy or FORCE RLS', () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table private\\.${table} enable row level security`));
    assert.match(regression, new RegExp(`'${table}'`));
  }

  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(migration, /create policy|force row level security/i);
  assert.doesNotMatch(migration, /revoke\s+usage\s+on\s+schema\s+private/i);
});

test('regression suite proves the privileged RPC boundary without payment mutations', () => {
  assert.match(regression, /pg_policies/);
  assert.match(regression, /has_table_privilege/);
  assert.match(regression, /get_marketplace_checkout_settings/);
  assert.match(regression, /marketplace_encode_cursor/);
  assert.match(regression, /marketplace_decode_cursor/);
  assert.match(regression, /prepare_marketplace_paypal_order/);
  assert.match(regression, /never changes payment, benefit, feature-flag, or QA-gate data/i);
  assert.doesNotMatch(regression, /insert into public\.marketplace_payments|update public\.marketplace_payments|delete from public\.marketplace_payments/i);
});
