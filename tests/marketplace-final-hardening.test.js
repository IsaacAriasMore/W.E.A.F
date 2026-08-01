import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sanitizeFrontendErrorMessage } from '../src/services/frontendErrorMonitor.js';
import { escapeHtml } from '../src/utils/sanitize.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260801193419_marketplace_recommendation_community_hardening.sql');
const workflow = read('.github/workflows/health-alerts.yml');
const marketplace = read('src/pages/public/marketplace.js');

test('recommendation quotas are actor-locked, daily, per-action and idempotent', () => {
  assert.match(migration, /hashtextextended\(actor_id::text \|\| ':marketplace-recommendation'/);
  assert.match(migration, /created_at >= utc_day_start[\s\S]{0,100}>= 500/);
  for (const [event, limit] of [['filter',120],['search',80],['detail',240],['save',60],['discord',30],['hide',60]]) {
    assert.match(migration, new RegExp(`when '${event}' then ${limit}`));
  }
  assert.match(migration, /client_event_id = p_client_event_id[\s\S]{0,80}return false/);
  assert.match(migration, /raise exception 'marketplace_recommendation_rate_limit'/);
});

test('recommendation events derive the actor and reject suspended or self-owned activity', () => {
  assert.match(migration, /actor_id uuid := \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /p_user_id/);
  assert.match(migration, /private\.marketplace_actor_suspended\(actor_id\)/);
  assert.match(migration, /selected_listing\.owner_user_id = actor_id/);
  assert.match(migration, /p_context - array\['category', 'region', 'platform', 'type', 'search'\]/);
});

test('directional blocks are applied before ranking and bound to cursor state', () => {
  assert.match(migration, /blocked_sellers_hash/);
  assert.ok((migration.match(/b\.blocker_user_id = actor_id and b\.blocked_user_id = l\.owner_user_id/g) || []).length >= 2);
  assert.match(migration, /affinities::text \|\| ':' \|\| blocked_sellers_hash/);
  assert.equal((migration.match(/position, created_at\)/g) || []).length, 2);
  assert.equal((migration.match(/clock_timestamp\(\)/g) || []).length, 2);
  assert.match(migration, /get_marketplace_catalog\(p_slug text default null\)[\s\S]*blocker_user_id = \(select auth\.uid\(\)\)/);
  const sellerProfile = migration.match(/get_marketplace_seller_profile[\s\S]*?revoke all on function public\.get_marketplace_seller_profile/)?.[0] || '';
  assert.match(sellerProfile, /b\.blocker_user_id = actor and b\.blocked_user_id = seller/);
  assert.doesNotMatch(sellerProfile, /blocker_user_id = seller/);
});

test('notifications are plain text, RPC-mutated and retained for bounded periods', () => {
  assert.match(migration, /marketplace_notifications_plain_text_check/);
  assert.match(migration, /revoke update on public\.marketplace_notifications from authenticated/);
  assert.match(migration, /maintain_marketplace_notifications[\s\S]*interval '90 days'[\s\S]*interval '180 days'[\s\S]*limit 5000/);
  assert.match(migration, /grant execute on function public\.maintain_marketplace_notifications\(\) to service_role/);
  assert.doesNotMatch(migration, /grant insert on public\.marketplace_notifications/);
});

test('frontend monitoring redacts standalone JWT-like values and serializes quotas', () => {
  const dummy = ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)].join('.');
  assert.equal(sanitizeFrontendErrorMessage(`failure ${dummy}`), 'failure [redacted]');
  assert.match(migration, /hashtextextended\(actor::text \|\| ':frontend-error'/);
  assert.match(migration, /\[A-Za-z0-9_-\]\{20,\}\\\./);
  assert.match(migration, /jsonb_build_object\([\s\S]*'code'[\s\S]*'source'[\s\S]*'online'[\s\S]*'viewport'/);
});

test('health alerts use trusted names and never execute pull request code', () => {
  assert.match(workflow, /CI\|E2E\|Lighthouse/);
  assert.doesNotMatch(workflow, /head_branch|pull_request_target|actions\/checkout/);
  assert.match(workflow, /permissions:[\s\S]*contents: read[\s\S]*issues: write/);
  assert.match(workflow, /curl --fail --silent --show-error --max-time 20 https:\/\/weaf\.vercel\.app\//);
});

test('Marketplace detail never installs an unvalidated external URL', () => {
  assert.match(marketplace, /safeDiscordInviteUrl\(listing\.discord_invite_url\)/);
  assert.match(marketplace, /discordLink\.href = discordUrl/);
  assert.doesNotMatch(marketplace, /href="\$\{escapeHtml\(listing\.discord_invite_url\)\}"/);
});

test('dynamic Marketplace text remains inert for malicious and multilingual input', () => {
  for (const value of [
    '<script>alert(1)</script>', '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>', 'javascript:alert(1)', '" onclick="alert(1)',
    'Español & English <strong>texto</strong>', 'x'.repeat(4000),
  ]) {
    const escaped = escapeHtml(value);
    assert.doesNotMatch(escaped, /<script|<img|<svg/i);
    assert.equal(escaped.includes('<'), false);
    assert.equal(escaped.includes('"'), false);
  }
  assert.match(read('src/pages/app/marketplaceAccount.js'), /escapeHtml\(label\)/);
});
