import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const lifecycle = read('../supabase/migrations/20260729230048_marketplace_asa_featured_lifecycle.sql');
const ranking = read('../supabase/migrations/20260729230051_marketplace_personalized_fair_ranking.sql');
const qa = read('../supabase/migrations/20260729230053_marketplace_sandbox_qa_allowlist.sql');
const cursorSnapshot = read('../supabase/migrations/20260801173359_marketplace_catalog_cursor_snapshot.sql');
const webhookIntegrity = read('../supabase/migrations/20260801174140_marketplace_webhook_state_integrity.sql');
const privacyReset = read('../supabase/migrations/20260801174910_marketplace_recommendation_reset_privacy.sql');
const legacyModerationHotfix = read('../supabase/migrations/20260801215014_fix_marketplace_legacy_moderation.sql');
const publicPage = read('../src/pages/public/marketplace.js');
const accountPage = read('../src/pages/app/marketplaceAccount.js');
const service = read('../src/services/marketplaceService.js');
const edge = read('../supabase/functions/create-marketplace-paypal-order/index.ts');

test('compensating migrations preserve legacy rows while enforcing ASA on new writes', () => {
  assert.match(lifecycle, /marketplace_new_writes_asa_only[\s\S]*check \(game = 'ascended'\) not valid/);
  assert.match(lifecycle, /clean->>'game' <> 'ascended'[\s\S]*marketplace_asa_only/);
  assert.match(lifecycle, /l\.game = 'ascended'/);
  assert.doesNotMatch(lifecycle, /delete from public\.marketplace_listings|drop table public\.marketplace_listings/i);
});

test('legacy Marketplace rows remain moderatable without weakening ASA-only writes', () => {
  assert.match(legacyModerationHotfix, /create or replace function private\.enforce_marketplace_asa_game\(\)/);
  assert.match(legacyModerationHotfix, /tg_op = 'UPDATE'[\s\S]*new\.game is not distinct from old\.game/);
  assert.match(legacyModerationHotfix, /before insert or update of game on public\.marketplace_listings/);
  assert.match(legacyModerationHotfix, /drop constraint if exists marketplace_new_writes_asa_only/);
  assert.match(legacyModerationHotfix, /errcode = '23514'[\s\S]*message = 'marketplace_asa_only'/);
  assert.doesNotMatch(legacyModerationHotfix, /update\s+public\.marketplace_listings\s+set\s+game/i);
});

test('featured lifecycle is independent and preserves published_at', () => {
  assert.match(lifecycle, /add column featured_started_at/);
  assert.match(lifecycle, /add column featured_expires_at/);
  assert.match(lifecycle, /featured_expires_at = event_time \+ interval '7 days'/);
  assert.match(lifecycle, /expires_at = greatest\(expires_at, event_time \+ interval '7 days'\)/);
  const activation = lifecycle.slice(lifecycle.indexOf("p_event_type = 'PAYMENT.CAPTURE.COMPLETED'"));
  assert.doesNotMatch(activation, /published_at\s*=/);
});

test('refunds, reversals, and expiry revoke benefit while denial only fails its attempt', () => {
  for (const event of ['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED']) {
    assert.match(webhookIntegrity, new RegExp(event.replaceAll('.', '\\.')));
  }
  const deniedBranch = webhookIntegrity.match(/elsif p_event_type = 'PAYMENT\.CAPTURE\.DENIED'[\s\S]*?elsif p_event_type in \('PAYMENT\.CAPTURE\.REFUNDED'/)?.[0] || '';
  assert.doesNotMatch(deniedBranch, /update public\.marketplace_listings/);
  assert.match(webhookIntegrity, /PAYMENT\.CAPTURE\.REFUNDED'[\s\S]*update public\.marketplace_listings/);
  assert.match(lifecycle, /expire_marketplace_featured_benefits/);
  assert.doesNotMatch(webhookIntegrity, /delete from public\.marketplace_(listings|payments|audit_log)/i);
});

test('recommendation storage is opt-in, owner-readable, and not directly writable', () => {
  for (const table of ['marketplace_recommendation_preferences', 'marketplace_recommendation_events', 'marketplace_user_interest_profiles', 'marketplace_listing_impressions']) {
    assert.match(ranking, new RegExp(`create table public\\.${table}`));
    assert.match(ranking, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(ranking, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(ranking, /revoke all on table[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(ranking, /grant insert|grant update|grant delete/i);
});

test('event RPC controls consent, weights, second-view cap, dedupe, and rate limit', () => {
  assert.match(ranking, /record_marketplace_recommendation_event/);
  assert.match(ranking, /marketplace_personalization_disabled/);
  assert.match(ranking, /when 'filter' then 1 when 'search' then 1 when 'save' then 4/);
  assert.match(ranking, /when 'discord' then 5 when 'hide' then -4/);
  assert.match(ranking, /case detail_views when 0 then 2 when 1 then 1 else 0 end/);
  assert.match(ranking, /on conflict\(user_id, client_event_id\) do nothing/);
  assert.match(ranking, />= 120[\s\S]*marketplace_recommendation_rate_limit/);
});

test('interest decay and retention are server-side', () => {
  assert.match(ranking, /power\([\s\S]*0\.5::numeric[\s\S]*2592000/);
  assert.match(ranking, /now\(\) - interval '90 days'/);
  assert.match(ranking, /maintain_marketplace_recommendation_data/);
  assert.doesNotMatch(ranking, /cron\.schedule/);
});

test('featured and organic ranking use separate deterministic buckets and weights', () => {
  assert.match(ranking, /extract\(epoch from now\(\)\) \/ 900/);
  assert.match(ranking, /extract\(epoch from now\(\)\) \/ 3600/);
  assert.match(ranking, /30\.0 \/ \(1 \+/);
  assert.match(ranking, /25 \* least/);
  assert.match(ranking, /15\.0 \/ \(1 \+/);
  assert.match(ranking, /then 5 else 0 end::numeric as exploration_score/);
  assert.match(ranking, /% 100 < 10/);
});

test('seller diversity and featured separation are enforced before response', () => {
  assert.match(ranking, /seller_position = 1[\s\S]*limit 4/);
  assert.match(ranking, /global_position > 20 or seller_position <= 2/);
  assert.match(ranking, /not \(l\.is_featured and l\.featured_expires_at > now\(\)\)/);
});

test('keyset cursor is signed, bucket-bound, opaque, and limit-capped', () => {
  assert.match(ranking, /marketplace_ranking_secrets/);
  assert.match(ranking, /extensions\.hmac\(/);
  assert.match(cursorSnapshot, /marketplace_decode_cursor/);
  assert.match(cursorSnapshot, /cursor_payload->>'b'/);
  assert.match(cursorSnapshot, /p_limit is null or p_limit not between 1 and 24/);
  assert.match(cursorSnapshot, /rank_score < cursor_score/);
  assert.match(cursorSnapshot, /'v', 2, 'b', organic_bucket, 't', snapshot_time/);
  assert.match(cursorSnapshot, /imp\.created_at < snapshot_time/);
  assert.match(cursorSnapshot, /coalesce\(actor_id::text, 'anonymous'\)/);
});

test('impressions are server-computed and deduplicated per bucket and placement', () => {
  assert.match(ranking, /marketplace_impressions_user_dedupe_idx/);
  assert.match(ranking, /on conflict do nothing/);
  assert.match(ranking, /item\.ordinality::smallint/);
  assert.doesNotMatch(service, /position:|bucket_key|rank_score/);
});

test('anonymous ranking persists no IP, fingerprint, or anonymous Supabase user', () => {
  assert.doesNotMatch(ranking, /inet_client_addr|\bip_address\b|\buser_agent\b|signInAnonymously/i);
  assert.match(ranking, /actor_id is not null and personalization_enabled/);
});

test('reset removes all personalized ranking inputs and records only a minimal audit', () => {
  assert.match(privacyReset, /delete from public\.marketplace_recommendation_events/);
  assert.match(privacyReset, /delete from public\.marketplace_user_interest_profiles/);
  assert.match(privacyReset, /delete from public\.marketplace_listing_impressions/);
  assert.match(privacyReset, /where user_id = actor_id/);
  assert.match(privacyReset, /'recommendations_reset'[\s\S]*'events_interests_and_impressions'/);
  assert.doesNotMatch(privacyReset, /delete from public\.marketplace_(listings|payments|reports)/i);
  assert.match(privacyReset, /revoke all on function public\.reset_marketplace_recommendations/);
  assert.match(privacyReset, /grant execute on function public\.reset_marketplace_recommendations\(\)[\s\S]*to authenticated/);
});

test('USD 3 Sandbox price is authoritative on SQL and Edge boundaries', () => {
  assert.match(lifecycle, /price_minor = 300/);
  assert.match(qa, /setting\.price_minor <> 300/);
  assert.match(qa, /'amount_minor', 300/);
  assert.match(edge, /Number\(prepared\.amount_minor\) !== 300/);
  assert.doesNotMatch(edge, /body\.(amount|price|currency)/);
});

test('private QA allowlist never bypasses the global or marketplace kill switch', () => {
  assert.match(qa, /create table private\.marketplace_payment_qa_allowlist/);
  assert.match(qa, /global_paypal_enabled[\s\S]*billing_disabled/);
  const prepare = qa.slice(qa.indexOf('create or replace function public.prepare_marketplace_paypal_order'));
  assert.ok(prepare.indexOf('billing_disabled') < prepare.indexOf('is_marketplace_payment_qa_allowed'));
  assert.match(qa, /setting\.payments_enabled/);
  const allowlistTable = qa.slice(qa.indexOf('create table private.marketplace_payment_qa_allowlist'), qa.indexOf(');', qa.indexOf('create table private.marketplace_payment_qa_allowlist')));
  assert.doesNotMatch(allowlistTable, /email/i);
});

test('public UI is ASA-only with separate featured and organic sections', () => {
  assert.match(publicPage, /data-market-featured/);
  assert.match(publicPage, /data-market-grid/);
  assert.match(publicPage, /ARK: Survival Ascended/);
  assert.doesNotMatch(publicPage, /data-market-game|option value="evolved"|ASE \+ ASA/);
  assert.match(publicPage, /data-market-more/);
});

test('seller UI exposes lifecycle, recommendation controls, and QA-only Sandbox copy', () => {
  assert.match(accountPage, /featured_started_at/);
  assert.match(accountPage, /featured_expires_at/);
  assert.match(accountPage, /data-market-personalization/);
  assert.match(accountPage, /data-market-reset/);
  assert.match(accountPage, /qaSandboxOnly/);
  assert.doesNotMatch(accountPage, /option\('evolved'|option\('both'/);
});

test('catalog service uses v2 but keeps a safe ASA-filtered rollout fallback', () => {
  assert.match(service, /get_marketplace_catalog_v2/);
  assert.match(service, /get_marketplace_catalog/);
  assert.match(service, /filter\(\(listing\) => listing\.game === 'ascended'\)/);
  assert.match(service, /record_marketplace_recommendation_event/);
});
