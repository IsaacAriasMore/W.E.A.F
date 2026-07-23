import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateMutationCount } from '../src/utils/mutationCalculator.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ARK mutation count follows delta divided by two', () => {
  assert.deepEqual(calculateMutationCount(55, 57), {
    valid: true, previous: 55, next: 57, delta: 2, mutationCount: 1, isOdd: false,
  });
  assert.equal(calculateMutationCount(55, 75).mutationCount, 10);
  assert.equal(calculateMutationCount(55, 58).isOdd, true);
  assert.equal(calculateMutationCount(55, 55).valid, false);
  assert.equal(calculateMutationCount(55, 56).error, 'delta_too_small');
});

test('Phase 11 RPCs enforce tribe roles and authenticated grants', () => {
  const sql = read('supabase/migrations/20260723022746_phase_11_tribe_breeding_tools.sql');
  assert.match(sql, /rename_tribe[\s\S]*owner_user_id = actor_id[\s\S]*tribe\.renamed/i);
  assert.match(sql, /archive_tribe[\s\S]*p_confirmation_name is distinct from selected_name[\s\S]*is_active = false/i);
  assert.match(sql, /register_breed_stat_mutation[\s\S]*private\.is_tribe_member\(p_tribe_id\)[\s\S]*registered_by[\s\S]*mutation_count/i);
  assert.match(sql, /reset_tribe_breeding[\s\S]*private\.is_tribe_admin_or_owner[\s\S]*tribe_breeding_resets/i);
  assert.match(sql, /enable row level security[\s\S]*tribe_breeding_resets_read_members/i);
  assert.doesNotMatch(sql, /is_global_admin\(\)/i);
  for (const rpc of ['rename_tribe', 'archive_tribe', 'create_breed_v2', 'set_breed_caretaker', 'register_breed_stat_mutation', 'reset_tribe_breeding']) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}\\(`, 'i'));
  }
});

test('official contact and database-hydrated navbar shortcuts are centralized', () => {
  const contact = read('src/config/contact.js');
  const header = read('src/components/layout/PublicHeader.js');
  const footer = read('src/components/layout/Footer.js');
  assert.match(contact, /waefservice@outlook\.com/);
  assert.match(contact, /@whiskyzc_/);
  assert.match(header, /profile\?\.global_role === 'admin'/);
  assert.match(header, /href="\/profile"/);
  assert.match(footer, /SUPPORT_EMAIL/);
  assert.doesNotMatch(`${header}${footer}`, /jisaaccv053@gmail\.com/);
});

test('public Phase 11 labels and INI contribution contact match the polished experience', () => {
  const inis = read('src/pages/public/inis.js');
  const maps = read('src/pages/public/mapsBosses.js');
  const es = read('src/i18n/es.js');
  const en = read('src/i18n/en.js');
  assert.match(inis, /SUPPORT_EMAIL/);
  assert.match(inis, /OFFICIAL_DISCORD/);
  assert.match(inis, /data-advanced-category/);
  assert.match(es, /ARK: Survival Evolved/);
  assert.match(es, /ARK: Survival Ascended/);
  assert.match(en, /Want to contribute your custom INI/);
  assert.doesNotMatch(`${inis}${maps}`, />ASE ARK:|>ASA ARK:/);
});

test('navbar exposes account actions by authenticated and global role state', () => {
  const header = read('src/components/layout/PublicHeader.js');
  assert.match(header, /if \(session\?\.user\)[\s\S]*common\.myTribe[\s\S]*href="\/profile"/);
  assert.match(header, /profile\?\.global_role === 'admin'[\s\S]*href="\/admin"/);
  assert.match(header, /common\.signIn[\s\S]*common\.createAccount/);
});

test('caretaker remains organizational while the active member is the mutation actor', () => {
  const sql = read('supabase/migrations/20260723022746_phase_11_tribe_breeding_tools.sql');
  const mutationRpc = sql.slice(sql.indexOf('create or replace function public.register_breed_stat_mutation'), sql.indexOf('create or replace function public.reset_tribe_breeding'));
  assert.match(mutationRpc, /not private\.is_tribe_member\(p_tribe_id\)[\s\S]*registered_by,/i);
  assert.match(mutationRpc, /selected_breed\.caretaker_user_id[\s\S]*selected_breed\.caretaker_display_name/i);
  assert.doesNotMatch(mutationRpc, /is_tribe_admin_or_owner/i);
});
