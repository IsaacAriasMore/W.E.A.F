import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dismissAd, isAdDismissed } from '../src/utils/adDismissal.js';
import { isPromotableServer, promotableServers } from '../src/utils/serverPromotion.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const now = Date.parse('2026-07-22T12:00:00Z');
const plus = {
  id: 'plus', status: 'active', plan: 'plus', plan_type: 'plus', payment_status: 'paid',
  billing_source: 'stripe', is_featured: true, cancel_at_period_end: false,
  starts_at: '2026-07-01T00:00:00Z', expires_at: '2026-08-01T00:00:00Z',
  current_period_end: '2026-08-01T00:00:00Z', created_at: '2026-07-20T00:00:00Z',
};

test('only active paid Plus or featured servers are promotable', () => {
  assert.equal(isPromotableServer(plus, now), true);
  assert.equal(isPromotableServer({ ...plus, plan: 'normal', plan_type: 'normal', is_featured: false }, now), false);
  assert.equal(isPromotableServer({ ...plus, status: 'pending_payment' }, now), false);
  assert.equal(isPromotableServer({ ...plus, payment_status: 'failed' }, now), false);
  assert.equal(isPromotableServer({ ...plus, cancel_at_period_end: true }, now), false);
  assert.equal(isPromotableServer({ ...plus, expires_at: '2026-07-01T00:00:00Z' }, now), false);
  assert.equal(isPromotableServer({ ...plus, billing_source: 'manual', payment_status: 'not_required', current_period_end: null }, now), true);
});

test('promotable server filtering fails closed and prioritizes featured entries', () => {
  const promoted = promotableServers([
    { ...plus, id: 'not-featured', is_featured: false, created_at: '2026-07-21T00:00:00Z' },
    plus,
    { ...plus, id: 'canceled', status: 'canceled' },
  ], now);
  assert.deepEqual(promoted.map((server) => server.id), ['plus', 'not-featured']);
});

test('dismissed recommendations expire after seven days', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  dismissAd('tribe_dashboard_soft', storage, now);
  assert.equal(isAdDismissed('tribe_dashboard_soft', storage, now + 6 * 86400000), true);
  assert.equal(isAdDismissed('tribe_dashboard_soft', storage, now + 8 * 86400000), false);
});

test('phase 9 normalizes internal placements and tracking without external providers', () => {
  const migration = read('supabase/migrations/20260722224038_phase_9_internal_plus_ads.sql');
  const edge = read('supabase/functions/track-server-event/index.ts');
  const slot = read('src/components/ads/SponsoredServerSlot.js');
  for (const placement of [
    'home_featured_servers', 'home_hero_secondary', 'inis_sidebar', 'maps_bosses_sidebar',
    'creatures_sidebar', 'servers_featured', 'tribe_dashboard_soft',
    'empty_state_server_recommendation', 'server_publish_example',
  ]) assert.match(migration, new RegExp(placement));
  assert.match(migration, /provider = 'internal'/);
  assert.match(migration, /website_click/);
  assert.match(edge, /website_click/);
  assert.match(slot, /threshold: 0\.55/);
  assert.match(slot, /hasMeasurementConsent\(\)/);
  assert.match(slot, /state\.impressionObserver\?\.disconnect\(\)/);
  assert.match(slot, /weaf:consent-changed/);
  assert.match(slot, /isAdDismissed/);
  assert.doesNotMatch(slot, /googlesyndication|doubleclick|adsense/i);
});
