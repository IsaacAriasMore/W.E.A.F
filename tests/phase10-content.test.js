import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapBosses, iniPresets } from '../src/data/publicData.js';
import { iniDownloadText, iniFilename } from '../src/pages/public/inis.js';
import {
  BOSS_CHECKLIST_STORAGE_KEY,
  bossChecklistProgress,
  checklistItemKey,
  resetBossChecklist,
  setChecklistItem,
} from '../src/utils/bossChecklist.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('map catalog separates current ASE and ASA availability', () => {
  const ase = mapBosses.filter((map) => ['both', 'evolved'].includes(map.game_availability));
  const asa = mapBosses.filter((map) => ['both', 'ascended'].includes(map.game_availability));
  assert.equal(ase.at(-1).slug, 'aquatica');
  assert.equal(asa.at(-1).slug, 'astraeos');
  assert.ok(asa.some((map) => map.slug === 'genesis-part-1'));
  assert.ok(!asa.some((map) => map.slug === 'genesis-part-2'));
  assert.ok(mapBosses.every((map) => map.source_url && map.reviewed_at));
});

test('The Island pilot has isolated Gamma, Beta and Alpha requirements', () => {
  const island = mapBosses.find((map) => map.slug === 'the-island');
  assert.equal(island.bosses.length, 4);
  island.bosses.forEach((boss) => assert.deepEqual(Object.keys(boss.requirements), ['gamma', 'beta', 'alpha']));
  assert.equal(island.bosses.find((boss) => boss.slug === 'dragon').requirements.alpha.min_player_level, 100);
});

test('boss checklist v2 isolates progress and reset by difficulty', () => {
  assert.equal(BOSS_CHECKLIST_STORAGE_KEY, 'weaf:boss-checklist:v2');
  const gamma = { game: 'evolved', mapSlug: 'the-island', bossSlug: 'dragon', difficulty: 'gamma' };
  const alpha = { ...gamma, difficulty: 'alpha' };
  const requirements = { artifacts: [{ id: 'artifact-strong' }], tributes: [{ id: 'heart' }] };
  const gammaKey = checklistItemKey(gamma, 'artifacts', 'artifact-strong');
  const alphaKey = checklistItemKey(alpha, 'artifacts', 'artifact-strong');
  let state = setChecklistItem({}, gammaKey, true);
  state = setChecklistItem(state, alphaKey, true);
  assert.deepEqual(bossChecklistProgress(state, gamma, requirements), { complete: 1, total: 2, percent: 50 });
  state = resetBossChecklist(state, gamma);
  assert.equal(state[gammaKey], undefined);
  assert.equal(state[alphaKey], true);
});

test('INI downloads are deterministic and preserve Windows line endings', () => {
  assert.equal(iniFilename({ slug: 'ASA FPS Balanced' }), 'weaf-asa-fps-balanced.ini');
  assert.equal(iniDownloadText({ content: '[A]\nValue=1' }), '[A]\r\nValue=1');
  assert.ok(iniPresets.every((preset) => preset.file_target && preset.source_url && preset.verification_status !== 'verified'));
});

test('Phase 10 migration keeps RLS and admin writes constrained', () => {
  const migration = read('supabase/migrations/20260723000908_phase_10_content_bosses_inis.sql');
  assert.match(migration, /content_status = 'published'/);
  assert.match(migration, /private\.is_global_admin\(\)/);
  assert.match(migration, /security definer/ig);
  assert.match(migration, /revoke all on function public\.admin_upsert_map/);
  assert.match(migration, /grant execute on function public\.admin_upsert_map\(uuid, jsonb\) to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete).* to anon/i);
});

test('admin uses structured content RPCs and no manual public slug field', () => {
  const service = read('src/services/adminService.js');
  const dashboard = read('src/pages/admin/adminDashboard.js');
  for (const rpc of ['admin_upsert_map', 'admin_upsert_boss', 'admin_upsert_boss_requirement', 'admin_upsert_ini_preset']) {
    assert.match(service, new RegExp(rpc));
  }
  assert.match(dashboard, /data-requirement-group="artifact"/);
  assert.match(dashboard, /slugify\(value\('name_en'\)\)/);
  assert.doesNotMatch(dashboard, /name="slug"/);
});
