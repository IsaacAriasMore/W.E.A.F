import test from 'node:test';
import assert from 'node:assert/strict';
import { iniPresets } from '../src/data/publicData.js';
import { filterIniPresets, INI_VISIBLE_CATEGORIES, normalizeIniCategory } from '../src/pages/public/inis.js';
import es from '../src/i18n/es.js';
import en from '../src/i18n/en.js';
import { readFileSync } from 'node:fs';

test('INI library exposes only the simplified categories', () => {
  assert.deepEqual(INI_VISIBLE_CATEGORIES, ['all', 'general', 'pvp', 'farming', 'other']);
  assert.equal(normalizeIniCategory('breeding'), 'other');
  assert.equal(normalizeIniCategory('visibility'), 'other');
  assert.equal(normalizeIniCategory('fps'), 'other');
  assert.equal(normalizeIniCategory('other'), 'other');
});

test('every fallback preset remains reachable in ASE and ASA filters', () => {
  assert.equal(filterIniPresets(iniPresets, { game: 'evolved', category: 'all' }).length, 2);
  assert.equal(filterIniPresets(iniPresets, { game: 'evolved', category: 'other' }).length, 2);
  assert.equal(filterIniPresets(iniPresets, { game: 'ascended', category: 'all' }).length, 3);
  assert.equal(filterIniPresets(iniPresets, { game: 'ascended', category: 'other' }).length, 3);
});

test('Phase B copy states tribe privacy without changing public-content claims', () => {
  assert.equal(es.home.steps.title, 'Mejora tus breeds con W.E.A.F.');
  assert.equal(es.home.faq.q2, '¿Las tribus son públicas?');
  assert.match(es.home.faq.a2, /tribus, los breeds, las mutaciones y la actividad/);
  assert.match(es.home.faq.a2, /invitadas o autorizadas por el owner/);
  assert.equal(en.home.faq.q2, 'Are tribes public?');
});

test('Phase B migration preserves rows while enforcing the four stored categories', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260810214436_phase_b_ini_categories.sql', import.meta.url), 'utf8');
  assert.match(sql, /set category = 'other'[\s\S]*where category not in \('general', 'pvp', 'farming', 'other'\)/i);
  assert.match(sql, /check \(category in \('general', 'pvp', 'farming', 'other'\)\)/i);
  assert.match(sql, /p_payload->>'category' not in \('general', 'pvp', 'farming', 'other'\)/i);
});
