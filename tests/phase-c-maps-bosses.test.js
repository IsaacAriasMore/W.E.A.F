import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapBosses } from '../src/data/publicData.js';
import { availableDifficulties, currentDifficulty } from '../src/utils/bossDifficulties.js';
import { FALLBACK_IMAGE, bossImageCandidate, mapImageCandidate, resolveBossImage, resolveMapImage } from '../src/utils/bossImagePaths.js';
import { checklistItemKey } from '../src/utils/bossChecklist.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const map = (slug) => mapBosses.find((item) => item.slug === slug);
const inGame = (game) => mapBosses.filter((m) => ['both', game].includes(m.game_availability));
const countBosses = (game) => inGame(game).reduce((sum, m) => sum + m.bosses.filter((b) => ['both', game].includes(b.game_availability)).length, 0);

test('Phase C covers the full released ASE and ASA catalog', () => {
  assert.equal(inGame('evolved').length, 13);
  assert.equal(inGame('ascended').length, 10);
  assert.equal(countBosses('evolved'), 34);
  assert.equal(countBosses('ascended'), 26);
});

test('ASA release order places Lost Colony before Genesis: Part 1', () => {
  const asc = (slug) => map(slug).release_order_ascended;
  assert.equal(asc('valguero'), 8);
  assert.equal(asc('lost-colony'), 9);
  assert.equal(asc('genesis-part-1'), 10);
  assert.equal(map('lost-colony').is_canonical, true);
  assert.equal(map('lost-colony').game_availability, 'ascended');
});

test('new map rosters match the wiki per game', () => {
  const slugs = (slug, game) => map(slug).bosses.filter((b) => ['both', game].includes(b.game_availability)).map((b) => b.slug);
  assert.deepEqual(slugs('the-center', 'evolved'), ['the-center-guardians']);
  assert.deepEqual(slugs('the-center', 'ascended'), ['the-center-guardians']);
  assert.deepEqual(slugs('ragnarok', 'evolved'), ['ragnarok-guardians', 'lava-elemental', 'iceworm-queen', 'spirit-direwolf-dire-bear']);
  assert.deepEqual(slugs('ragnarok', 'ascended'), ['nunatak', 'iceworm-queen', 'spirit-direwolf-dire-bear']);
  assert.deepEqual(slugs('lost-colony', 'ascended'), ['red-handed']);
  assert.equal(map('astraeos').bosses.length, 8);
  assert.deepEqual(slugs('aquatica', 'evolved'), ['cymathoa', 'fractalis', 'pygocentrus', 'vulcanithys', 'alpha-tridacna']);
});

test('Ragnarok is split per game and ragnarok-guardians is never both', () => {
  const evolved = map('ragnarok').bosses.filter((b) => b.game_availability === 'evolved').map((b) => b.slug);
  const ascended = map('ragnarok').bosses.filter((b) => b.game_availability === 'ascended').map((b) => b.slug);
  const both = map('ragnarok').bosses.filter((b) => b.game_availability === 'both').map((b) => b.slug);
  assert.deepEqual(evolved, ['ragnarok-guardians', 'lava-elemental']);
  assert.deepEqual(ascended, ['nunatak']);
  assert.deepEqual(both, ['iceworm-queen', 'spirit-direwolf-dire-bear']);
  assert.equal(map('ragnarok').bosses.some((b) => b.slug === 'ragnarok-guardians' && b.game_availability === 'both'), false);
  assert.equal(map('ragnarok').bosses.some((b) => b.slug === 'ragnarok-guardians' && b.game_availability === 'evolved'), true);
  assert.equal(map('ragnarok').bosses.some((b) => b.slug === 'lava-elemental' && b.game_availability === 'evolved'), true);
});

test('Valguero differs by game: ASE guardians, ASA Grendel', () => {
  const evolved = map('valguero').bosses.filter((b) => b.game_availability === 'evolved').map((b) => b.slug);
  const ascended = map('valguero').bosses.filter((b) => b.game_availability === 'ascended').map((b) => b.slug);
  assert.deepEqual(evolved, ['valguero-guardians', 'valguero-broodmother']);
  assert.deepEqual(ascended, ['grendel-valguero']);
});

test('Genesis 2 and Fjordur encounters stay ASE-only', () => {
  assert.equal(map('genesis-part-2').bosses[0].game_availability, 'evolved');
  assert.ok(map('fjordur').bosses.every((b) => b.game_availability === 'evolved'));
});

test('verified requirements cover the full catalog with no invented content', () => {
  const withRequirements = mapBosses.flatMap((m) => m.bosses.filter((b) => Object.keys(b.requirements || {}).length).map((b) => b.slug));
  assert.deepEqual(withRequirements.sort(), ['beyla', 'broodmother-fjordur', 'broodmother-lysrix', 'corrupted-master-controller', 'crystal-wyvern-queen', 'cymathoa', 'desert-titan', 'dinopithecus-king', 'dragon', 'dragon-fjordur', 'erymanthian-kalydonios', 'fenrisulfr', 'forest-titan', 'fractalis', 'grendel-valguero', 'hati-and-skoll', 'hydraskos', 'ice-titan', 'king-titan', 'manticore', 'megapithecus', 'megapithecus-fjordur', 'minotarchos', 'natrix', 'nunatak', 'overseer', 'pygocentrus', 'ragnarok-guardians', 'red-handed', 'rockwell', 'steinbjorn', 'the-center-guardians', 'thodes', 'valguero-guardians', 'vulcanithys']);
  const verified = mapBosses.flatMap((m) => m.bosses.flatMap((b) => Object.values(b.requirements || {})));
  assert.equal(verified.length, 89);
  const noLevel = verified.filter((r) => r.min_player_level === null);
  assert.ok(noLevel.every((r) => r.artifacts.length > 0 || r.tributes.length > 0 || /missions?/i.test(r.notes_en)));
  assert.ok(verified.filter((r) => r.min_player_level !== null).every((r) => r.min_player_level > 0));
  assert.ok(verified.every((r) => r.content_status === 'published' && r.max_players === 10 && r.source_url));
});

test('Crystal Wyvern Queen requirements match the wiki tribute table', () => {
  const queen = map('crystal-isles').bosses[0];
  assert.deepEqual(Object.keys(queen.requirements), ['gamma', 'beta', 'alpha']);
  assert.deepEqual(Object.values(queen.requirements).map((r) => r.min_player_level), [55, 75, 100]);
  const alpha = queen.requirements.alpha;
  assert.equal(alpha.artifacts.length, 7);
  assert.deepEqual(alpha.tributes.find((t) => t.id === 'primal-crystal').quantity, 30);
  assert.deepEqual(alpha.tributes.find((t) => t.id === 'alpha-crystal-talon').quantity, 5);
});

test('Dinopithecus King requirements match the wiki tribute table', () => {
  const king = map('lost-island').bosses[0];
  assert.deepEqual(Object.keys(king.requirements), ['gamma', 'beta', 'alpha']);
  assert.deepEqual(Object.values(king.requirements).map((r) => r.min_player_level), [55, 75, 100]);
  const beta = king.requirements.beta;
  assert.equal(beta.artifacts.length, 4);
  assert.deepEqual(beta.tributes.find((t) => t.id === 'basilisk-scale').quantity, 2);
});

test('The Center Guardians is one encounter whose tribute table covers both guardians', () => {
  const arena = map('the-center').bosses.find((b) => b.slug === 'the-center-guardians');
  assert.equal(arena.boss_type, 'arena');
  assert.equal(arena.name_en, 'The Center Guardians');
  assert.match(arena.description_en, /Broodmother Lysrix \+ Megapithecus/);
  assert.deepEqual(Object.values(arena.requirements).map((r) => r.min_player_level), [70, 80, 90]);
  assert.equal(arena.requirements.gamma.artifacts.length, 6);
  assert.equal(arena.requirements.gamma.tributes.length, 0);
  assert.equal(arena.requirements.beta.tributes.find((t) => t.id === 'argentavis-talon').quantity, 10);
  assert.equal(arena.requirements.alpha.tributes.find((t) => t.id === 'tusoteuthis-tentacle').quantity, 25);
});

test('Ragnarok ASE: ragnarok-guardians is the evolved Dragon + Manticore arena', () => {
  const arena = map('ragnarok').bosses.find((b) => b.slug === 'ragnarok-guardians');
  assert.ok(arena);
  assert.equal(arena.game_availability, 'evolved');
  assert.equal(arena.boss_type, 'arena');
  assert.equal(arena.name_en, 'Ragnarok Guardians');
  assert.match(arena.description_en, /Dragon \+ Manticore/);
  assert.deepEqual(Object.values(arena.requirements).map((r) => r.min_player_level), [70, 80, 90]);
  assert.equal(arena.requirements.gamma.artifacts.length, 10);
  assert.equal(arena.requirements.gamma.tributes.length, 0);
  assert.equal(arena.requirements.beta.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity, 10);
  assert.equal(arena.requirements.alpha.tributes.find((t) => t.id === 'megalania-toxin').quantity, 25);
  assert.equal(arena.requirements.gamma.source_url, 'https://ark.wiki.gg/wiki/Ragnarok_Arena_(Ragnarok)');
});

test('Ragnarok ASA: Nunatak is the ascended ice guardian and does not reuse the ASE arena tribute table', () => {
  const nunatak = map('ragnarok').bosses.find((b) => b.slug === 'nunatak');
  const arena = map('ragnarok').bosses.find((b) => b.slug === 'ragnarok-guardians');
  assert.ok(nunatak);
  assert.equal(nunatak.game_availability, 'ascended');
  assert.equal(nunatak.boss_type, 'main');
  assert.equal(nunatak.name_en, 'Nunatak');
  assert.deepEqual(Object.values(nunatak.requirements).map((r) => r.min_player_level), [70, 80, 90]);
  assert.equal(nunatak.requirements.gamma.artifacts.length, 10);
  assert.equal(nunatak.requirements.gamma.tributes.length, 0);
  assert.equal(nunatak.requirements.gamma.source_url, 'https://ark.wiki.gg/wiki/Nunatak');
  assert.equal(nunatak.requirements.beta.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity, 5);
  assert.equal(nunatak.requirements.alpha.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity, 10);
  assert.notEqual(nunatak.requirements.beta.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity, arena.requirements.beta.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity);
  assert.notEqual(nunatak.requirements.alpha.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity, arena.requirements.alpha.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity);
});

test('Valguero differs by game and level band: ASE guardians (30/50/70), wild Broodmother, ASA Grendel (70/80/90)', () => {
  const arena = map('valguero').bosses.find((b) => b.slug === 'valguero-guardians');
  const wildBroodmother = map('valguero').bosses.find((b) => b.slug === 'valguero-broodmother');
  const grendel = map('valguero').bosses.find((b) => b.slug === 'grendel-valguero');
  assert.deepEqual(Object.values(arena.requirements).map((r) => r.min_player_level), [30, 50, 70]);
  assert.equal(arena.game_availability, 'evolved');
  assert.equal(arena.name_en, 'Valguero Guardians');
  assert.match(arena.description_en, /Megapithecus \+ Dragon \+ Manticore/);
  assert.equal(wildBroodmother.boss_type, 'other');
  assert.deepEqual(Object.keys(wildBroodmother.requirements || {}), []);
  assert.equal(wildBroodmother.game_availability, 'evolved');
  assert.equal(grendel.game_availability, 'ascended');
  assert.deepEqual(Object.values(grendel.requirements).map((r) => r.min_player_level), [70, 80, 90]);
});

test('Grendel (Valguero ASA) requirements match the wiki tribute table', () => {
  const grendel = map('valguero').bosses.find((b) => b.slug === 'grendel-valguero');
  assert.deepEqual(Object.values(grendel.requirements).map((r) => r.min_player_level), [70, 80, 90]);
  assert.equal(grendel.requirements.gamma.artifacts.length, 3);
  assert.equal(grendel.requirements.beta.tributes.find((t) => t.id === 'tyrannosaurus-arm').quantity, 10);
  assert.equal(grendel.requirements.alpha.artifacts.length, 4);
  assert.equal(grendel.requirements.alpha.tributes.find((t) => t.id === 'giganotosaurus-heart').quantity, 2);
});

test('Red-Handed is one Lost Colony mission whose requirements cover both bosses (no artifacts, sigils)', () => {
  const redHanded = map('lost-colony').bosses.find((b) => b.slug === 'red-handed');
  assert.equal(redHanded.boss_type, 'mission');
  assert.match(redHanded.description_en, /Lost King \+ Lost Queen/);
  assert.deepEqual(Object.values(redHanded.requirements).map((r) => r.min_player_level), [55, 70, 95]);
  assert.deepEqual(Object.values(redHanded.requirements).map((r) => r.artifacts.length), [0, 0, 0]);
  assert.equal(redHanded.requirements.gamma.tributes.find((t) => t.id === 'minor-crimson-sigil').quantity, 100);
  assert.equal(redHanded.requirements.beta.tributes.find((t) => t.id === 'greater-aberrant-sigil').quantity, 150);
  assert.equal(redHanded.requirements.alpha.tributes.find((t) => t.id === 'prime-crimson-sigil').quantity, 200);
  assert.equal(redHanded.requirements.alpha.tributes.find((t) => t.id === 'alpha-ossidon-skull').quantity, 5);
});

test('combined encounters list their participants in the description', () => {
  const desc = (slug, bossSlug) => map(slug).bosses.find((b) => b.slug === bossSlug).description_en;
  assert.match(desc('the-center', 'the-center-guardians'), /Broodmother Lysrix \+ Megapithecus/);
  assert.match(desc('ragnarok', 'ragnarok-guardians'), /Dragon \+ Manticore/);
  assert.match(desc('valguero', 'valguero-guardians'), /Megapithecus \+ Dragon \+ Manticore/);
  assert.match(desc('lost-colony', 'red-handed'), /Lost King \+ Lost Queen/);
});

test('Astraeos roster covers its three guardians, two summon-tribute minis and three pending minions, all ASA-only', () => {
  const bosses = map('astraeos').bosses;
  assert.equal(bosses.length, 8);
  assert.ok(bosses.every((b) => b.game_availability === 'ascended'));
  const withRequirements = bosses.filter((b) => Object.keys(b.requirements || {}).length).map((b) => b.slug);
  assert.deepEqual(withRequirements, ['natrix', 'thodes', 'hydraskos', 'minotarchos', 'erymanthian-kalydonios']);
  const withoutRequirements = bosses.filter((b) => !Object.keys(b.requirements || {}).length).map((b) => b.slug);
  assert.deepEqual(withoutRequirements, ['pulmonoscorpius-monarch', 'thanatos', 'manticore-astraeos']);
  assert.deepEqual(bosses.map((b) => b.boss_type).filter((t) => t === 'main').length, 3);
});

test('Natrix (Astraeos) requirements match the wiki tribute table', () => {
  const natrix = map('astraeos').bosses.find((b) => b.slug === 'natrix');
  assert.equal(natrix.name_en, 'Natrix');
  assert.equal(natrix.boss_type, 'main');
  assert.deepEqual(Object.keys(natrix.requirements), ['gamma', 'beta', 'alpha']);
  assert.deepEqual(Object.values(natrix.requirements).map((r) => r.min_player_level), [30, 50, 70]);
  assert.deepEqual(natrix.requirements.gamma.artifacts.map((a) => a.id), ['artifact-clever', 'artifact-hunter', 'artifact-massive']);
  assert.equal(natrix.requirements.gamma.tributes.length, 0);
  assert.deepEqual(natrix.requirements.beta.artifacts.map((a) => a.id), ['artifact-clever', 'artifact-hunter', 'artifact-massive']);
  assert.equal(natrix.requirements.beta.tributes.find((t) => t.id === 'argentavis-talon').quantity, 5);
  assert.equal(natrix.requirements.alpha.tributes.find((t) => t.id === 'argentavis-talon').quantity, 10);
  assert.equal(natrix.requirements.gamma.source_url, 'https://ark.wiki.gg/wiki/Natrix');
});

test('Thodes (Astraeos) keeps its verified artifacts and tributes while the player level stays unknown', () => {
  const thodes = map('astraeos').bosses.find((b) => b.slug === 'thodes');
  assert.equal(thodes.name_en, 'Thodes');
  assert.deepEqual(Object.keys(thodes.requirements), ['gamma', 'beta', 'alpha']);
  assert.equal(thodes.requirements.gamma.min_player_level, null);
  assert.equal(thodes.requirements.beta.min_player_level, null);
  assert.equal(thodes.requirements.alpha.min_player_level, null);
  assert.notDeepEqual(Object.values(thodes.requirements).map((r) => r.min_player_level), [45, 65, 85]);
  assert.deepEqual(thodes.requirements.gamma.artifacts.map((a) => a.id), ['artifact-brute', 'artifact-pack', 'artifact-devourer']);
  assert.equal(thodes.requirements.gamma.tributes.length, 0);
  assert.deepEqual(thodes.requirements.beta.tributes.map((t) => t.quantity), [5, 5, 5, 5, 5]);
  assert.deepEqual(thodes.requirements.alpha.tributes.map((t) => t.quantity), [10, 10, 10, 10, 10]);
  assert.equal(thodes.requirements.alpha.tributes.find((t) => t.id === 'megalodon-tooth').quantity, 10);
  assert.match(thodes.requirements.gamma.notes_en, /not published by the source/);
  assert.deepEqual(Object.values(thodes.requirements).map((r) => r.reviewed_at), ['2026-08-11', '2026-08-11', '2026-08-11']);
});

test('Corrupted Master Controller (Genesis: Part 1) requires completed missions, not player levels', () => {
  const controller = map('genesis-part-1').bosses.find((b) => b.slug === 'corrupted-master-controller');
  assert.ok(controller);
  assert.equal(controller.boss_type, 'final');
  assert.deepEqual(Object.keys(controller.requirements), ['gamma', 'beta', 'alpha']);
  assert.equal(controller.requirements.gamma.min_player_level, null);
  assert.equal(controller.requirements.beta.min_player_level, null);
  assert.equal(controller.requirements.alpha.min_player_level, null);
  assert.ok(Object.values(controller.requirements).every((r) => [58, 116, 168].every((n) => r.min_player_level !== n)));
  assert.deepEqual(controller.requirements.gamma.artifacts.map((a) => a.id), []);
  assert.deepEqual(controller.requirements.gamma.tributes.map((t) => t.id), []);
  assert.match(controller.requirements.gamma.notes_es, /58 misiones/);
  assert.match(controller.requirements.beta.notes_es, /116 misiones/);
  assert.match(controller.requirements.alpha.notes_es, /168 misiones/);
  assert.match(controller.requirements.alpha.notes_en, /168 missions/);
  assert.equal(controller.requirements.gamma.source_url, 'https://ark.wiki.gg/wiki/Corrupted_Master_Controller');
  assert.deepEqual(Object.values(controller.requirements).map((r) => r.reviewed_at), ['2026-08-11', '2026-08-11', '2026-08-11']);
});

test('Hydraskos (Astraeos) requirements match the wiki tribute table', () => {
  const hydraskos = map('astraeos').bosses.find((b) => b.slug === 'hydraskos');
  assert.equal(hydraskos.name_en, 'Hydraskos');
  assert.deepEqual(Object.values(hydraskos.requirements).map((r) => r.min_player_level), [90, 90, 90]);
  assert.deepEqual(hydraskos.requirements.gamma.artifacts.map((a) => a.id), ['artifact-cunning', 'artifact-immune', 'artifact-skylord', 'artifact-strong']);
  assert.equal(hydraskos.requirements.gamma.tributes.length, 0);
  assert.equal(hydraskos.requirements.beta.tributes.find((t) => t.id === 'giganotosaurus-heart').quantity, 1);
  assert.equal(hydraskos.requirements.beta.tributes.find((t) => t.id === 'tyrannosaurus-arm').quantity, 5);
  assert.equal(hydraskos.requirements.alpha.tributes.find((t) => t.id === 'giganotosaurus-heart').quantity, 2);
  assert.equal(hydraskos.requirements.alpha.tributes.find((t) => t.id === 'tyrannosaurus-arm').quantity, 15);
  assert.equal(hydraskos.requirements.alpha.tributes.find((t) => t.id === 'tusoteuthis-tentacle').quantity, 10);
});

test('Astraeos mini summon tributes are verified single-gamma tributes with no level gate', () => {
  const minotarchos = map('astraeos').bosses.find((b) => b.slug === 'minotarchos');
  const erymanthian = map('astraeos').bosses.find((b) => b.slug === 'erymanthian-kalydonios');
  assert.deepEqual(Object.keys(minotarchos.requirements), ['gamma']);
  assert.deepEqual(Object.keys(erymanthian.requirements), ['gamma']);
  assert.equal(minotarchos.requirements.gamma.min_player_level, null);
  assert.equal(erymanthian.requirements.gamma.min_player_level, null);
  assert.deepEqual(minotarchos.requirements.gamma.tributes.map((t) => t.id).slice(0, 2), ['corrupt-heart', 'corrupted-nodule']);
  assert.equal(minotarchos.requirements.gamma.tributes.find((t) => t.id === 'lightning-talon').quantity, 5);
  assert.equal(erymanthian.requirements.gamma.tributes.find((t) => t.id === 'fire-talon').quantity, 5);
  assert.equal(erymanthian.requirements.gamma.tributes.find((t) => t.id === 'poison-talon').quantity, 5);
  assert.equal(minotarchos.requirements.gamma.source_url, 'https://ark.wiki.gg/wiki/Minotarchos');
  assert.equal(erymanthian.requirements.gamma.source_url, 'https://ark.wiki.gg/wiki/Erymanthian_%26_Kalydonios');
});

test('Aquatica roster covers the four tribute-gated main bosses plus the Alpha Tridacna world boss', () => {
  const bosses = map('aquatica').bosses;
  assert.equal(bosses.length, 5);
  assert.ok(bosses.every((b) => b.game_availability === 'evolved'));
  assert.equal(bosses.find((b) => b.slug === 'alpha-tridacna').boss_type, 'other');
  const withRequirements = bosses.filter((b) => Object.keys(b.requirements || {}).length).map((b) => b.slug);
  assert.deepEqual(withRequirements, ['cymathoa', 'fractalis', 'pygocentrus', 'vulcanithys']);
  assert.deepEqual(Object.keys(bosses.find((b) => b.slug === 'alpha-tridacna').requirements || {}), []);
});

test('Cymathoa (Aquatica) requirements match the wiki tribute table', () => {
  const boss = map('aquatica').bosses.find((b) => b.slug === 'cymathoa');
  assert.deepEqual(Object.values(boss.requirements).map((r) => r.min_player_level), [45, 65, 85]);
  assert.deepEqual(boss.requirements.gamma.artifacts.map((a) => a.id), ['artifact-mighty']);
  assert.equal(boss.requirements.gamma.tributes.find((t) => t.id === 'onchopristis-blade').quantity, 1);
  assert.equal(boss.requirements.alpha.tributes.find((t) => t.id === 'alpha-mosasaur-tooth').quantity, 1);
  assert.equal(boss.requirements.alpha.source_url, 'https://ark.wiki.gg/wiki/Cymathoa');
});

test('Fractalis (Aquatica) requirements match the wiki tribute table', () => {
  const boss = map('aquatica').bosses.find((b) => b.slug === 'fractalis');
  assert.deepEqual(Object.values(boss.requirements).map((r) => r.min_player_level), [10, 50, 70]);
  assert.deepEqual(boss.requirements.gamma.artifacts.map((a) => a.id), ['artifact-fallen']);
  assert.equal(boss.requirements.beta.tributes.find((t) => t.id === 'basilosaurus-blubber').quantity, 5);
  assert.equal(boss.requirements.alpha.tributes.find((t) => t.id === 'alpha-megalodon-fin').quantity, 1);
});

test('Vulcanithys (Aquatica) requirements match the wiki tribute table', () => {
  const boss = map('aquatica').bosses.find((b) => b.slug === 'vulcanithys');
  assert.deepEqual(Object.values(boss.requirements).map((r) => r.min_player_level), [55, 70, 95]);
  assert.deepEqual(boss.requirements.gamma.artifacts.map((a) => a.id), ['artifact-seeking']);
  assert.equal(boss.requirements.beta.tributes.find((t) => t.id === 'tyrannosaurus-arm').quantity, 5);
  assert.equal(boss.requirements.alpha.tributes.find((t) => t.id === 'alpha-water-talon').quantity, 1);
});

test('Pygocentrus (Aquatica) chains the other three bosses trophies with no artifacts', () => {
  const boss = map('aquatica').bosses.find((b) => b.slug === 'pygocentrus');
  assert.deepEqual(Object.values(boss.requirements).map((r) => r.min_player_level), [55, 75, 100]);
  assert.deepEqual(Object.values(boss.requirements).map((r) => r.artifacts.length), [0, 0, 0]);
  assert.deepEqual(boss.requirements.gamma.tributes.map((t) => t.id), ['gamma-cymathoa-trophy', 'gamma-fractalis-trophy', 'gamma-vulcanithys-trophy']);
  assert.equal(boss.requirements.alpha.tributes.find((t) => t.id === 'alpha-karkinos-claw').quantity, 1);
  assert.equal(boss.requirements.alpha.tributes.find((t) => t.id === 'alpha-tyrannosaur-tooth').quantity, 1);
});

test('Ragnarok dungeon minis carry no portal requirements and follow per-game availability', () => {
  const lava = map('ragnarok').bosses.find((b) => b.slug === 'lava-elemental');
  const iceworm = map('ragnarok').bosses.find((b) => b.slug === 'iceworm-queen');
  const spirits = map('ragnarok').bosses.find((b) => b.slug === 'spirit-direwolf-dire-bear');
  assert.equal(lava.game_availability, 'evolved');
  assert.equal(iceworm.game_availability, 'both');
  assert.equal(spirits.game_availability, 'both');
  assert.deepEqual(Object.keys(lava.requirements || {}), []);
  assert.deepEqual(Object.keys(iceworm.requirements || {}), []);
  assert.deepEqual(Object.keys(spirits.requirements || {}), []);
  assert.deepEqual(lava.boss_type, 'mini');
  assert.deepEqual(iceworm.boss_type, 'mini');
  assert.deepEqual(spirits.boss_type, 'mini');
});

test('availableDifficulties keeps a stable priority and handles pending encounters', () => {
  assert.deepEqual(availableDifficulties({ requirements: { alpha: {}, gamma: {}, beta: {} } }), ['gamma', 'beta', 'alpha']);
  assert.deepEqual(availableDifficulties({ requirements: { sigma: {}, alpha: {} } }), ['alpha', 'sigma']);
  assert.deepEqual(availableDifficulties({ requirements: {} }), []);
  assert.deepEqual(availableDifficulties({}), []);
});

test('currentDifficulty auto-selects the first valid variant', () => {
  assert.equal(currentDifficulty({ requirements: { gamma: {}, beta: {}, alpha: {} } }, 'beta'), 'beta');
  assert.equal(currentDifficulty({ requirements: { alpha: {}, beta: {} } }, 'gamma'), 'beta');
  assert.equal(currentDifficulty({ requirements: { alpha: {} } }, 'beta'), 'alpha');
  assert.equal(currentDifficulty({ requirements: {} }, 'gamma'), null);
});

test('Phase C checklist keys keep the v2 scheme with real difficulties', () => {
  const context = { game: 'evolved', mapSlug: 'crystal-isles', bossSlug: 'crystal-wyvern-queen', difficulty: 'alpha' };
  assert.equal(
    checklistItemKey(context, 'tributes', 'alpha-crystal-talon'),
    'evolved:crystal-isles:crystal-wyvern-queen:alpha:tributes:alpha-crystal-talon',
  );
});

test('Phase C migration is additive and keeps requirements constrained', () => {
  const migration = read('supabase/migrations/20260811000000_phase_c_maps_bosses_catalog.sql');
  assert.match(migration, /insert into public\.maps/);
  assert.match(migration, /insert into public\.bosses/);
  assert.match(migration, /insert into public\.boss_requirements/);
  assert.match(migration, /on conflict \(boss_id, difficulty\) do update/);
  assert.doesNotMatch(migration, /drop table/i);
  assert.doesNotMatch(migration, /delete from/i);
  assert.doesNotMatch(migration, /alter table/i);
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /paypal/i);
  assert.doesNotMatch(migration, /(?:insert|update|delete) (?:into )?public\.(?:payment|payments|marketplace)[a-z_]*/i);
  assert.doesNotMatch(migration, /difficulty in \('gamma', 'beta', 'alpha'\)/);
  assert.match(migration, /'corrupted-master-controller','gamma',/);
  assert.doesNotMatch(migration, /corrupted-master-controller',\s*'(?:gamma|beta|alpha)',\s*(?:58|116|168),/);
  assert.doesNotMatch(migration, /'thodes','(?:gamma|beta|alpha)',\s*(?:45|65|85),/);
});

test('Phase C migration is data-only and models combined encounters without a creatures schema', () => {
  const migration = read('supabase/migrations/20260811000000_phase_c_maps_bosses_catalog.sql');
  assert.doesNotMatch(migration, /alter table/i);
  assert.doesNotMatch(migration, /add column/i);
  assert.doesNotMatch(migration, /creatures/i);
  assert.doesNotMatch(migration, /Forsaken Oasis/i);
  assert.match(migration, /'the-center-guardians'/);
  assert.match(migration, /'ragnarok-guardians'/);
  assert.match(migration, /'nunatak'/);
  assert.match(migration, /'valguero-guardians'/);
  assert.match(migration, /'valguero-broodmother'/);
  assert.match(migration, /'red-handed'/);
  assert.match(migration, /'lava-elemental'/);
  assert.match(migration, /'iceworm-queen'/);
  assert.match(migration, /'spirit-direwolf-dire-bear'/);
  assert.match(migration, /'natrix'/);
  assert.match(migration, /'thodes'/);
  assert.match(migration, /'hydraskos'/);
  assert.match(migration, /'minotarchos'/);
  assert.match(migration, /'erymanthian-kalydonios'/);
  assert.match(migration, /'cymathoa'/);
  assert.match(migration, /'fractalis'/);
  assert.match(migration, /'pygocentrus'/);
  assert.match(migration, /'vulcanithys'/);
  assert.match(migration, /'alpha-tridacna'/);
  assert.match(migration, /Broodmother Lysrix \+ Megapithecus/);
  assert.match(migration, /Dragon \+ Manticore/);
  assert.match(migration, /Megapithecus \+ Dragon \+ Manticore/);
  assert.match(migration, /'evolved','arena','https:\/\/ark\.wiki\.gg\/wiki\/Ragnarok_Arena_\(Ragnarok\)',1\)/);
  assert.match(migration, /'ascended','main','https:\/\/ark\.wiki\.gg\/wiki\/Nunatak',2\)/);
  assert.doesNotMatch(migration, /'broodmother-center'|'dragon-ragnarok'|'lost-king'|'lost-queen'/);
});

test('Phase C migration requirement JSON literals are well-formed', () => {
  const migration = read('supabase/migrations/20260811000000_phase_c_maps_bosses_catalog.sql');
  const start = migration.indexOf('Verified tribute requirements');
  const values = migration.slice(start, migration.indexOf(') as seed(map_slug,boss_slug'));
  const arrays = [...values.matchAll(/'(\[.*?\])'/g)].map((match) => match[1]).filter((json) => json !== '[]');
  assert.equal(arrays.length, 124);
  arrays.forEach((json) => {
    const items = JSON.parse(json);
    assert.ok(Array.isArray(items) && items.length > 0);
    items.forEach((item) => {
      assert.ok(item.id && item.name_es && item.name_en);
      assert.ok(Number.isInteger(item.quantity) && item.quantity > 0);
    });
  });
});

test('Phase C Thodes UPDATE keeps 5 values matched by 5 aliases', () => {
  const migration = read('supabase/migrations/20260811000000_phase_c_maps_bosses_catalog.sql');
  const block = migration.slice(migration.indexOf('update public.boss_requirements br'));
  const rows = [...block.matchAll(/\(\s*'astraeos',\s*'thodes',\s*'(?:gamma|beta|alpha)'/g)];
  assert.equal(rows.length, 3);
  const alias = block.match(/as x\(([^)]*)\)/);
  assert.ok(alias, 'Thodes derived table must declare aliases');
  const aliases = alias[1].split(',').map((name) => name.trim()).filter(Boolean);
  assert.equal(aliases.length, 5);
  assert.equal(aliases.filter((name) => name === 'notes_es').length, 1);
  assert.equal(aliases.filter((name) => name === 'notes_en').length, 1);
  assert.equal(aliases.filter((name) => name === 'notes').length, 0);
  assert.doesNotMatch(block, /set notes = x\.notes[,;\s]/);
  assert.doesNotMatch(block, /x\.notes[^_e]/);
});

test('map and encounter images resolve to slug candidate paths and honor explicit URLs', () => {
  assert.equal(mapImageCandidate('lost-island'), '/assets/ark/maps/lost-island.webp');
  assert.equal(bossImageCandidate('dinopithecus-king'), '/assets/ark/bosses/dinopithecus-king.webp');
  assert.equal(resolveMapImage({ slug: 'lost-island', image_url: null }), '/assets/ark/maps/lost-island.webp');
  assert.equal(resolveBossImage({ slug: 'dinopithecus-king', image_url: null }), '/assets/ark/bosses/dinopithecus-king.webp');
  assert.equal(resolveBossImage({ slug: 'natrix', image_url: 'https://cdn.example.com/natrix.webp' }), 'https://cdn.example.com/natrix.webp');
  assert.equal(resolveBossImage({ slug: 'natrix', image_url: 'http://example.com/test.webp' }), 'http://example.com/test.webp');
  assert.equal(resolveBossImage({ slug: 'natrix', image_url: '  https://cdn.example.com/natrix.webp  ' }), 'https://cdn.example.com/natrix.webp');
});

test('non-HTTP/HTTPS or malformed explicit image URLs fall back to weaf-hero', () => {
  const boss = { slug: 'natrix' };
  assert.equal(resolveBossImage({ ...boss, image_url: '/custom/slug.webp' }), FALLBACK_IMAGE);
  assert.equal(resolveBossImage({ ...boss, image_url: 'javascript:alert(1)' }), FALLBACK_IMAGE);
  assert.equal(resolveBossImage({ ...boss, image_url: 'data:image/svg+xml,...' }), FALLBACK_IMAGE);
  assert.equal(resolveBossImage({ ...boss, image_url: 'not-a-url' }), FALLBACK_IMAGE);
  assert.equal(resolveBossImage({ ...boss, image_url: '   ' }), FALLBACK_IMAGE);
  assert.equal(resolveMapImage({ slug: 'the-island', image_url: '/custom/slug.webp' }), FALLBACK_IMAGE);
});

test('missing local map and boss images fall back to weaf-hero without a loop', () => {
  assert.equal(FALLBACK_IMAGE, '/assets/weaf-hero.webp');
  assert.equal(resolveBossImage({ slug: 'natrix', image_url: null }), '/assets/ark/bosses/natrix.webp');
  const page = read('src/pages/public/mapsBosses.js');
  assert.match(page, /resolveMapImage\(selectedMap\)/);
  assert.match(page, /resolveBossImage\(boss\)/);
  assert.match(page, /image && !image\.src\.endsWith\(FALLBACK_IMAGE\)/);
});
