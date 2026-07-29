import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Vercel applies CSP, clickjacking protection and no-store to private surfaces', () => {
  const config = JSON.parse(read('vercel.json'));
  const headers = config.headers.flatMap((rule) => rule.headers || []);
  const names = new Set(headers.map((header) => header.key.toLowerCase()));
  assert.ok(names.has('content-security-policy'));
  assert.ok(names.has('x-frame-options'));
  assert.ok(names.has('strict-transport-security'));
  assert.ok(config.headers.some((rule) => rule.headers?.some(
    (header) => header.key === 'Cache-Control' && header.value.includes('no-store'),
  )));
});

test('exact app and account routes and their children are private and never cached', () => {
  const config = JSON.parse(read('vercel.json'));
  for (const source of ['/(app|account)', '/(app|account)/(.*)']) {
    const rule = config.headers.find((candidate) => candidate.source === source);
    const cache = rule?.headers?.find((header) => header.key === 'Cache-Control')?.value;
    assert.equal(cache, 'private, no-store, max-age=0');
  }
});

test('user Edge Functions keep platform JWT verification enabled', () => {
  const config = read('supabase/config.toml');
  for (const name of [
    'notify-discord-tribe',
    'create-server-checkout',
    'create-server-listing-checkout',
    'create-billing-portal-session',
    'manage-paypal-catalog',
    'create-paypal-subscription',
    'cancel-paypal-subscription',
  ]) {
    const section = config.match(new RegExp(`\\[functions\\.${name}\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1] || '';
    assert.match(section, /verify_jwt\s*=\s*true/);
  }
});

test('public and worker functions with disabled platform JWT have an internal trust boundary', () => {
  const config = read('supabase/config.toml');
  for (const name of ['track-server-event', 'stripe-webhook', 'expire-server-listings', 'paypal-webhook', 'reconcile-paypal-subscriptions']) {
    const section = config.match(new RegExp(`\\[functions\\.${name}\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1] || '';
    assert.match(section, /verify_jwt\s*=\s*false/);
    const source = read(`supabase/functions/${name}/index.ts`);
    assert.match(source, /auth:\s*"(?:none|secret)"|verifyPayPalWebhook|stripe-signature/i);
  }
});

test('server URLs are constrained at the database boundary', () => {
  const migration = read('supabase/migrations/20260729003759_phase_1_security_hardening.sql');
  assert.match(migration, /server_listings_discord_https_check/);
  assert.match(migration, /server_listings_website_https_check/);
  assert.match(migration, /server_listings_banner_https_check/);
  assert.match(migration, /not valid/gi);
});

test('tracking never reuses the service role credential as a hashing secret', () => {
  const source = read('supabase/functions/track-server-event/index.ts');
  assert.match(source, /CLICK_HASH_SECRET/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('SPA navigation fails closed for cross-origin destinations', () => {
  const router = read('src/router.js');
  assert.ok((router.match(/url\.origin !== window\.location\.origin/g) || []).length >= 2);
});
