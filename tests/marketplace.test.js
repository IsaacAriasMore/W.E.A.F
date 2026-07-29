import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasUnsafeMarketplaceText, marketplaceTimeLeft, MARKETPLACE_DURATION_DAYS } from '../src/utils/marketplaceListing.js';

const migration = readFileSync(new URL('../supabase/migrations/20260729010939_phase_7_marketplace_foundation.sql', import.meta.url), 'utf8');
const router = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');

test('free marketplace listings last exactly seven days', () => {
  assert.equal(MARKETPLACE_DURATION_DAYS, 7);
  assert.equal(marketplaceTimeLeft('2026-08-05T00:00:00.000Z', Date.parse('2026-07-29T00:00:00.000Z')), 7);
  assert.match(migration, /expires_at = published_at \+ interval '7 days'/);
  assert.match(migration, /now\(\)\+interval '7 days'/);
});

test('marketplace rejects HTML and credential or exploit language on both boundaries', () => {
  assert.equal(hasUnsafeMarketplaceText({ title: 'Valid title', description: '<img src=x>', trade_terms: 'trade' }), true);
  assert.equal(hasUnsafeMarketplaceText({ title: 'Valid title', description: 'Share password here', trade_terms: 'trade' }), true);
  assert.equal(hasUnsafeMarketplaceText({ title: 'Metal exchange', description: 'Trading metal for polymer on our server', trade_terms: 'Fair in-game trade' }), false);
  assert.match(migration, /html_not_allowed/);
  assert.match(migration, /prohibited_marketplace_content/);
});

test('RLS and RPCs prevent browser-controlled featured, price, and expiration', () => {
  assert.match(migration, /alter table public\.marketplace_listings enable row level security/);
  assert.match(migration, /revoke all on public\.marketplace_categories,public\.marketplace_settings,public\.marketplace_listings/);
  assert.match(migration, /'active',false,now\(\),now\(\),now\(\)\+interval '7 days'/);
  assert.match(migration, /price_minor integer check/);
  assert.match(migration, /environment text not null default 'sandbox' check \(environment = 'sandbox'\)/);
  assert.doesNotMatch(migration, /p_is_featured|p_expires_at|p_price_minor[^\n]*create_free_marketplace_listing/);
});

test('marketplace expiration is idempotent and scheduled server-side', () => {
  assert.match(migration, /where status='active' and expires_at<=now\(\)/);
  assert.match(migration, /cron\.schedule\('expire-marketplace-listings','\*\/15 \* \* \* \*'/);
  assert.match(migration, /grant execute on function public\.expire_marketplace_listings\(\) to authenticated,service_role/);
});

test('public, account, editor, and stable detail routes are registered', () => {
  assert.match(router, /'\/marketplace'/);
  assert.match(router, /'\/marketplace\/new'/);
  assert.match(router, /'\/account\/marketplace'/);
  assert.match(router, /\^\\\/marketplace\\\/\[\^\/\]\+/);
});
