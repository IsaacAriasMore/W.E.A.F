import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RATE_FIELDS,
  SERVER_MAPS,
  SERVER_PLATFORMS,
  availableForGame,
  normalizeRates,
} from '../src/config/serverListing.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('server map and platform choices follow the selected game', () => {
  assert.ok(availableForGame(SERVER_MAPS, 'evolved').every((item) => item.game !== 'ascended'));
  assert.ok(availableForGame(SERVER_PLATFORMS, 'ascended').some((item) => item.label === 'Crossplay'));
  assert.ok(availableForGame(SERVER_PLATFORMS, 'both').some((item) => item.label === 'Epic Games'));
});

test('rates support an explicit unspecified state without fake values', () => {
  assert.deepEqual(normalizeRates('not_specified'), { preset: 'not_specified' });
  assert.equal(Object.keys(normalizeRates('vanilla')).length, RATE_FIELDS.length + 1);
});

test('public publish form no longer asks for a slug or mod names', () => {
  const page = read('src/pages/public/serverPublish.js');
  const ownersPage = read('src/pages/public/serverOwners.js');
  const directoryPage = read('src/pages/public/servers.js');
  const adminPage = read('src/pages/admin/adminDashboard.js');
  assert.doesNotMatch(page, /name="slug"/);
  assert.doesNotMatch(page, /name="mods"/);
  assert.match(page, /name: 'has_mods'/);
  assert.match(page, /t\('servers\.maps'\)/);
  assert.match(page, /t\('servers\.platforms'\)/);
  assert.match(page, /data-select-publish-plan="normal"/);
  assert.match(page, /data-select-publish-plan="plus"/);
  assert.match(page, /workspace\.innerHTML = planSelector/);
  assert.match(ownersPage, /id="owner-plans"/);
  assert.match(ownersPage, /scrollIntoView\(\{ behavior, block: 'start' \}\)/);
  assert.match(ownersPage, /window\.location\.hash === '#owner-plans'/);
  assert.match(ownersPage, /\.catch\(\(\) =>/);
  assert.match(ownersPage, /classList\.add\('reveal-visible'\)/);
  assert.match(directoryPage, /href="\/servers\/publish" data-link/);
  assert.match(directoryPage, /href="\/servers\/owners#owner-plans" data-link/);
  assert.match(page, /servers\.form\.statusCanceling/);
  assert.match(page, /canceled: 'statusCanceled'/);
  assert.doesNotMatch(adminPage, /name="slug"/);
  assert.doesNotMatch(adminPage, /Plataformas, por coma|Mapas, por coma|Rates \(JSON\)/);
  assert.match(adminPage, /name: 'maps'.*serverOptions: true/);
  assert.match(adminPage, /name: 'platforms'.*serverOptions: true/);
  assert.match(adminPage, /name: 'has_mods'/);
});

test('database creates stable numeric listing slugs and stores the mods boolean', () => {
  const migration = read('supabase/migrations/20260722162000_production_server_listing_fixes.sql');
  assert.match(migration, /public\.generate_server_listing_slug/);
  assert.match(migration, /suffix_number := suffix_number \+ 1/);
  assert.match(migration, /slug = coalesce\(nullif\(slug, ''\)/);
  assert.match(migration, /has_mods = selected_has_mods/);
  assert.doesNotMatch(migration, /p_payload->>'slug'/);
});

test('admin manual listings use generated slugs and explicit manual billing', () => {
  const migration = read('supabase/migrations/20260722210545_phase_8_content_admin_cleanup.sql');
  assert.match(migration, /public\.generate_server_listing_slug\(p_payload->>'title'\)/);
  assert.doesNotMatch(migration, /p_payload->>'slug'/);
  assert.match(migration, /'manual', 'not_required'/);
  assert.match(migration, /private\.is_global_admin\(\)/);
  assert.match(migration, /set search_path = ''/);
});
