-- Phase C: full ASE/ASA map and boss (encounter) catalog.
-- Additive and idempotent. Requires explicit review before apply.
-- Does not touch payments, marketplace, auth, or any existing migration history.
-- Verified with ARK Official Community Wiki (ark.wiki.gg) as of 2026-08-11.
-- A "boss" row is an ENCOUNTER: combined arenas (The Center, Ragnarok, Valguero)
-- and the Red-Handed mission group multiple participants in a single summon.

begin;

-- Lost Colony is the first paid canonical ASA expansion (Dec 18, 2025).
-- Genesis: Part 1 (ASA, Jul 3, 2026) moves after Lost Colony in ASA release order.
insert into public.maps(
  name, slug, name_es, name_en, description, description_es, description_en, game_availability,
  map_type, release_order_evolved, release_order_ascended, is_canonical, platform_notes,
  source_url, source_name, reviewed_at, content_status, is_public, is_active, sort_order
)
select name_en, slug, name_es, name_en, description_es, description_es, description_en, game_availability::public.game_mode,
  map_type, release_order_evolved, release_order_ascended, is_canonical, platform_notes,
  source_url, source_name, '2026-08-11 00:00:00+00'::timestamptz, 'published', true, true,
  coalesce(release_order_evolved, release_order_ascended, 999)
from (values
  ('lost-colony','Lost Colony','Lost Colony','Primera expansión canónica de pago de ARK: Survival Ascended.','The first paid canonical ARK: Survival Ascended expansion.','ascended','story',null,9,true,'Expansión canónica de pago de ARK: Survival Ascended.','https://ark.wiki.gg/wiki/Lost_Colony','ARK Official Community Wiki'),
  ('genesis-part-1','Genesis: Part 1','Genesis: Part 1','Simulación por biomas con misiones y ascensión.','Biome simulation with missions and ascension.','both','story',8,10,true,null,'https://ark.wiki.gg/wiki/Genesis_1','ARK Official Community Wiki')
) as seed(slug,name_es,name_en,description_es,description_en,game_availability,map_type,release_order_evolved,release_order_ascended,is_canonical,platform_notes,source_url,source_name)
on conflict (slug) do update set
  name = excluded.name, name_es = excluded.name_es, name_en = excluded.name_en,
  description = excluded.description, description_es = excluded.description_es, description_en = excluded.description_en,
  game_availability = excluded.game_availability, map_type = excluded.map_type,
  release_order_evolved = excluded.release_order_evolved, release_order_ascended = excluded.release_order_ascended,
  is_canonical = excluded.is_canonical, platform_notes = excluded.platform_notes,
  source_url = excluded.source_url, source_name = excluded.source_name, reviewed_at = excluded.reviewed_at,
  content_status = 'published', is_public = true, is_active = true, sort_order = excluded.sort_order, updated_at = now();

-- Encounters per map. A "boss" row is an ENCOUNTER: combined arenas (The Center,
-- Ragnarok, Valguero) and the Red-Handed mission group several participants in a single
-- summon. Participants are listed in description_es/description_en (e.g.
-- "Broodmother Lysrix + Megapithecus"); no schema change is needed.
-- Valguero differs per game: ASE has Valguero Arena (Megapithecus + Dragon + Manticore,
-- levels 30/50/70) and the Wild Broodmother world/special encounter (no difficulties);
-- ASA has Grendel (levels 70/80/90, wiki-cited). Ragnarok also differs: ASE keeps the
-- Dragon + Manticore arena (ragnarok-guardians, evolved) while ASA has the Nunatak ice
-- guardian (ascended). Ragnarok also adds its dungeon mini-bosses: the Lava Elemental
-- (ASE only), the Iceworm Queen and the Spirit Direwolf & Dire Bear (both ASE and ASA),
-- none of which have portal requirements. The Center Guardians remains 'both' because
-- The Center Ascended retains the Broodmother Lysrix + Megapithecus fight.
-- Astraeos (ASA) adds its three guardian bosses (Natrix 30/50/70, Thodes 45/65/85,
-- Hydraskos 90/90/90, wiki-verified) plus Minotarchos and Erymanthian & Kalydonios
-- (single-set summon tributes, wiki-verified) and Pulmonoscorpius Monarch, Thanatos and
-- the Manticore without portal requirements.
-- Aquatica (ASE) adds Cymathoa, Fractalis, Pygocentrus, Vulcanithys (full Gamma/Beta/Alpha
-- tribute tables, wiki-verified; Pygocentrus also requires the other three trophies) and
-- the Alpha Tridacna world boss without portal requirements.
insert into public.bosses(
  map_id, name, slug, name_es, name_en, description_es, description_en, notes, game_availability,
  boss_type, source_url, source_name, reviewed_at, content_status, is_public, is_active, sort_order
)
select m.id, seed.name_en, seed.slug, seed.name_es, seed.name_en, seed.description_es, seed.description_en,
  seed.description_es, seed.game_availability::public.game_mode, seed.boss_type, seed.source_url,
  'ARK Official Community Wiki', '2026-08-11 00:00:00+00'::timestamptz, 'published', true, true, seed.sort_order
from (values
  ('the-center','the-center-guardians','Guardianes de The Center','The Center Guardians','Broodmother Lysrix + Megapithecus. Encuentro combinado de guardianes en The Center Arena.','Broodmother Lysrix + Megapithecus. Combined guardian encounter in The Center Arena.','both','arena','https://ark.wiki.gg/wiki/The_Center_Arena_(The_Center)',1),
  ('ragnarok','ragnarok-guardians','Guardianes de Ragnarok','Ragnarok Guardians','Dragon + Manticore. Encuentro combinado de guardianes de ASE en la arena de Ragnarok.','Dragon + Manticore. ASE combined guardian encounter in the Ragnarok arena.','evolved','arena','https://ark.wiki.gg/wiki/Ragnarok_Arena_(Ragnarok)',1),
  ('ragnarok','nunatak','Nunatak','Nunatak','Guardiana de hielo de Ragnarok Ascended, invocada en la Nunatak Arena (niveles 70/80/90).','Ragnarok Ascended ice guardian, summoned in the Nunatak Arena (levels 70/80/90).','ascended','main','https://ark.wiki.gg/wiki/Nunatak',2),
  ('valguero','valguero-guardians','Guardianes de Valguero','Valguero Guardians','Megapithecus + Dragon + Manticore. Encuentro combinado de guardianes exclusivo de ASE (niveles 30/50/70).','Megapithecus + Dragon + Manticore. Combined guardian encounter, ASE exclusive (levels 30/50/70).','evolved','arena','https://ark.wiki.gg/wiki/Valguero_Arena_(Valguero)',1),
  ('valguero','valguero-broodmother','Broodmother salvaje','Wild Broodmother','Broodmother Lysrix. Encuentro de mundo/special en Valguero, sin dificultades ni requisitos de portal.','Broodmother Lysrix. Valguero world/special encounter with no difficulties or portal requirements.','evolved','other','https://ark.wiki.gg/wiki/Broodmother_Lysrix',2),
  ('valguero','grendel-valguero','Grendel','Grendel','Jefe de Valguero exclusivo de ARK: Survival Ascended (niveles 70/80/90).','Valguero boss exclusive to ARK: Survival Ascended (levels 70/80/90).','ascended','main','https://ark.wiki.gg/wiki/Grendel',3),
  ('lost-colony','red-handed','Red-Handed','Red-Handed','Lost King + Lost Queen. Misión de Lost Colony en la que ambos luchan a la vez.','Lost King + Lost Queen. Lost Colony mission where both fight at the same time.','ascended','mission','https://ark.wiki.gg/wiki/Red-Handed_(Lost_Colony)',1),
  ('crystal-isles','crystal-wyvern-queen','Crystal Wyvern Queen','Crystal Wyvern Queen','Guardiana final de Crystal Isles; tres dificultades verificadas.','Crystal Isles final guardian; three verified difficulties.','evolved','final','https://ark.wiki.gg/wiki/Crystal_Wyvern_Queen',1),
  ('lost-island','dinopithecus-king','Dinopithecus King','Dinopithecus King','Jefe final de Lost Island; tres dificultades verificadas.','Lost Island final boss; three verified difficulties.','evolved','final','https://ark.wiki.gg/wiki/Dinopithecus_King',1),
  ('ragnarok','lava-elemental','Elemental de Lava','Lava Elemental','Mini-boss de mazmorra de Ragnarok en la Arena de Lava; opcional y sin requisitos de portal.','Ragnarok dungeon mini-boss in the Lava Arena; optional with no portal requirements.','evolved','mini','https://ark.wiki.gg/wiki/Lava_Elemental',3),
  ('ragnarok','iceworm-queen','Reina Gusano de Hielo','Iceworm Queen','Reina de la mazmorra helada de Ragnarok (ASE y ASA); sin requisitos de portal.','Queen of the Ragnarok frozen dungeon (ASE and ASA); no portal requirements.','both','mini','https://ark.wiki.gg/wiki/Iceworm_Queen',4),
  ('ragnarok','spirit-direwolf-dire-bear','Espíritu del Direwolf y del Dire Bear','Spirit Direwolf & Dire Bear','Pareja de espíritus que custodia el Laberinto de la Vida en Ragnarok (ASE y ASA); sin requisitos de portal.','Spirit pair guarding Life''s Labyrinth on Ragnarok (ASE and ASA); no portal requirements.','both','mini','https://ark.wiki.gg/wiki/Spirit_Direwolf_%26_Spirit_Dire_Bear',5),
  ('aquatica','cymathoa','Cymathoa','Cymathoa','Isópodo gigante de Aquatica (niveles 45/65/85); tres dificultades con tributos verificados.','Aquatica giant isopod (levels 45/65/85); three verified tribute difficulties.','evolved','main','https://ark.wiki.gg/wiki/Cymathoa',1),
  ('aquatica','fractalis','Fractalis','Fractalis','Criatura de cristal de Aquatica (niveles 10/50/70); tres dificultades con tributos verificados.','Aquatica crystal creature (levels 10/50/70); three verified tribute difficulties.','evolved','main','https://ark.wiki.gg/wiki/Fractalis',2),
  ('aquatica','pygocentrus','Pygocentrus','Pygocentrus','Piraña gigante final de Aquatica (niveles 55/75/100); exige los trofeos de los otros tres jefes en la misma dificultad.','Aquatica final giant piranha (levels 55/75/100); requires the other three bosses trophies at the same difficulty.','evolved','main','https://ark.wiki.gg/wiki/Pygocentrus',3),
  ('aquatica','vulcanithys','Vulcanithys','Vulcanithys','Pez volcánico de Aquatica (niveles 55/70/95); tres dificultades con tributos verificados.','Aquatica volcanic fish (levels 55/70/95); three verified tribute difficulties.','evolved','main','https://ark.wiki.gg/wiki/Vulcanithys',4),
  ('aquatica','alpha-tridacna','Tridacna Alfa','Alpha Tridacna','Almeja gigante alfa que actúa como jefe de mundo en Aquatica; otorga Perlas Abisales y Elemento.','Alpha giant clam acting as an Aquatica world boss; drops Abyssal Pearls and Element.','evolved','other','https://ark.wiki.gg/wiki/Alpha_Tridacna',5),
  ('astraeos','natrix','Natrix','Natrix','Guardiana Medusa de Astraeos, invocada en la Natrix Arena (niveles 30/50/70); tres dificultades con tributos verificados.','Astraeos Medusa guardian, summoned in the Natrix Arena (levels 30/50/70); three verified tribute difficulties.','ascended','main','https://ark.wiki.gg/wiki/Natrix',1),
  ('astraeos','thodes','Thodes','Thodes','Guardiana Cíclope de Astraeos; tres dificultades con artefactos y tributos verificados.','Astraeos Cyclops guardian; three difficulties with verified artifacts and tributes.','ascended','main','https://ark.wiki.gg/wiki/Thodes',2),
  ('astraeos','hydraskos','Hydraskos','Hydraskos','Hidra guardiana de Astraeos (nivel 90 en las tres dificultades); tres dificultades con tributos verificados.','Astraeos Hydra guardian (level 90 at all three difficulties); three verified tribute difficulties.','ascended','main','https://ark.wiki.gg/wiki/Hydraskos',3),
  ('astraeos','minotarchos','Minotarchos','Minotarchos','Minotauro dorado de Astraeos; requiere un tributo de invocación verificado.','Astraeos golden Minotaur; requires a verified summon tribute.','ascended','mini','https://ark.wiki.gg/wiki/Minotarchos',4),
  ('astraeos','erymanthian-kalydonios','Erymanthian y Kalydonios','Erymanthian & Kalydonios','Doble mini-boss de Astraeos; requiere un tributo de invocación verificado.','Astraeos double mini-boss; requires a verified summon tribute.','ascended','mini','https://ark.wiki.gg/wiki/Erymanthian_%26_Kalydonios',5),
  ('astraeos','pulmonoscorpius-monarch','Escorpión Monarca Pulmonoscorpius','Pulmonoscorpius Monarch','Escorpión monarca de Astraeos, sin requisitos de portal.','Astraeos monarch scorpion with no portal requirements.','ascended','mini','https://ark.wiki.gg/wiki/Pulmonoscorpius_Monarch',6),
  ('astraeos','thanatos','Thanatos','Thanatos','Jefe esquelético de Astraeos, sin requisitos de portal.','Astraeos skeletal boss with no portal requirements.','ascended','mini','https://ark.wiki.gg/wiki/Thanatos',7),
  ('astraeos','manticore-astraeos','Manticora','Manticore','Manticora presente en Astraeos, sin requisitos de portal.','Manticore found on Astraeos with no portal requirements.','ascended','other','https://ark.wiki.gg/wiki/Manticore',8)
) as seed(map_slug,slug,name_es,name_en,description_es,description_en,game_availability,boss_type,source_url,sort_order)
join public.maps m on m.slug = seed.map_slug
on conflict (map_id, game_availability, slug) do update set
  name = excluded.name, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en,
  notes = excluded.notes, boss_type = excluded.boss_type, source_url = excluded.source_url,
  source_name = excluded.source_name, reviewed_at = excluded.reviewed_at, content_status = 'published',
  is_public = true, is_active = true, sort_order = excluded.sort_order, updated_at = now();

-- Verified tribute requirements (wiki-sourced) for The Center/Ragnarok/Valguero arenas,
-- Nunatak, Grendel, the Red-Handed (Lost Colony) mission, Crystal Wyvern Queen,
-- Dinopithecus King, the three Astraeos guardian bosses (Natrix, Thodes, Hydraskos),
-- the Astraeos mini-boss summon tributes (Minotarchos, Erymanthian & Kalydonios),
-- the full Aquatica tables (Cymathoa, Fractalis, Vulcanithys, Pygocentrus), the
-- Extinction titans (Desert/Forest/Ice portal tributes and King Titan), the Fjordur
-- roster (Beyla, Hati & Sköll, Steinbjörn, the three guardians, Fenrisúlfr), Rockwell
-- (Aberration) and Manticore (Scorched Earth). Single-set summon tributes and titan
-- portals use the 'gamma' key with one variant (the UI hides the tab bar).
-- The Island's 12 requirements are intentionally NOT re-seeded here: they were already
-- published on the remote by the Phase 10 migration and this file is additive/idempotent.
insert into public.boss_requirements(
  boss_id, difficulty, item_name, quantity, min_player_level, max_players, artifacts, tributes, unlocks,
  notes, notes_es, notes_en, source_url, source_name, reviewed_at, content_status
)
select b.id, seed.difficulty, null, null, seed.min_level, 10, seed.artifacts::jsonb, seed.tributes::jsonb, '[]'::jsonb,
  'Confirma multiplicadores, mods y reglas específicas de tu servidor.',
  'Confirma multiplicadores, mods y reglas específicas de tu servidor.',
  'Check your server multipliers, mods, and specific rules.', seed.source_url, 'ARK Official Community Wiki',
  '2026-08-11 00:00:00+00'::timestamptz, 'published'
from (values
  ('the-center','the-center-guardians','gamma',70,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[]',
    'https://ark.wiki.gg/wiki/The_Center_Arena_(The_Center)'),
  ('the-center','the-center-guardians','beta',80,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":10},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":10},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":10}]',
    'https://ark.wiki.gg/wiki/The_Center_Arena_(The_Center)'),
  ('the-center','the-center-guardians','alpha',90,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":25},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":25},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":25},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":25},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":25},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":25},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":25},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":25},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":25},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":25}]',
    'https://ark.wiki.gg/wiki/The_Center_Arena_(The_Center)'),
  ('ragnarok','ragnarok-guardians','gamma',70,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[]',
    'https://ark.wiki.gg/wiki/Ragnarok_Arena_(Ragnarok)'),
  ('ragnarok','ragnarok-guardians','beta',80,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":10},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":10},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":10}]',
    'https://ark.wiki.gg/wiki/Ragnarok_Arena_(Ragnarok)'),
  ('ragnarok','ragnarok-guardians','alpha',90,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":25},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":25},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":25},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":25},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":25},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":25},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":25},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":25},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":25},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":25}]',
    'https://ark.wiki.gg/wiki/Ragnarok_Arena_(Ragnarok)'),
  ('ragnarok','nunatak','gamma',70,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[]',
    'https://ark.wiki.gg/wiki/Nunatak'),
  ('ragnarok','nunatak','beta',80,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":10},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":5},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":10}]',
    'https://ark.wiki.gg/wiki/Nunatak'),
  ('ragnarok','nunatak','alpha',90,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":25},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":10},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":25},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":25},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":25},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":25},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":25},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":25},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":25},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":25}]',
    'https://ark.wiki.gg/wiki/Nunatak'),
  ('valguero','valguero-guardians','gamma',30,
    '[{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":5},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":5},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":5},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":5},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5}]',
    'https://ark.wiki.gg/wiki/Valguero_Arena_(Valguero)'),
  ('valguero','valguero-guardians','beta',50,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":10},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":8},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":8},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":8},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":10}]',
    'https://ark.wiki.gg/wiki/Valguero_Arena_(Valguero)'),
  ('valguero','valguero-guardians','alpha',70,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-crag","name_es":"Artefacto del Peñasco","name_en":"Artifact of the Crag","quantity":1},{"id":"artifact-destroyer","name_es":"Artefacto del Destructor","name_en":"Artifact of the Destroyer","quantity":1},{"id":"artifact-gatekeeper","name_es":"Artefacto del Guardián","name_en":"Artifact of the Gatekeeper","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":15},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":15},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":2},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":15}]',
    'https://ark.wiki.gg/wiki/Valguero_Arena_(Valguero)'),
  ('valguero','grendel-valguero','gamma',70,
    '[{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":5},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":5},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":5},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":5},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5}]',
    'https://ark.wiki.gg/wiki/Grendel'),
  ('valguero','grendel-valguero','beta',80,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":10},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":8},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":8},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":8},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":10}]',
    'https://ark.wiki.gg/wiki/Grendel'),
  ('valguero','grendel-valguero','alpha',90,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-crag","name_es":"Artefacto del Peñasco","name_en":"Artifact of the Crag","quantity":1},{"id":"artifact-destroyer","name_es":"Artefacto del Destructor","name_en":"Artifact of the Destroyer","quantity":1},{"id":"artifact-gatekeeper","name_es":"Artefacto del Guardián","name_en":"Artifact of the Gatekeeper","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":15},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":15},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":2},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":15}]',
    'https://ark.wiki.gg/wiki/Grendel'),
  ('lost-colony','red-handed','gamma',55,
    '[]',
    '[{"id":"alpha-zombie-brains","name_es":"Cerebros de Zombi Alfa","name_en":"Alpha Zombie Brains","quantity":1},{"id":"neophyte-horns","name_es":"Cuernos de Neófito","name_en":"Neophyte Horns","quantity":5},{"id":"minor-aberrant-sigil","name_es":"Sello Aberrante Menor","name_en":"Minor Aberrant Sigil","quantity":100},{"id":"minor-crimson-sigil","name_es":"Sello Carmesí Menor","name_en":"Minor Crimson Sigil","quantity":100}]',
    'https://ark.wiki.gg/wiki/Red-Handed_(Lost_Colony)'),
  ('lost-colony','red-handed','beta',70,
    '[]',
    '[{"id":"alpha-ossidon-skull","name_es":"Cráneo de Ossidon Alfa","name_en":"Alpha Ossidon Skull","quantity":1},{"id":"alpha-zombie-brains","name_es":"Cerebros de Zombi Alfa","name_en":"Alpha Zombie Brains","quantity":5},{"id":"neophyte-horns","name_es":"Cuernos de Neófito","name_en":"Neophyte Horns","quantity":10},{"id":"greater-aberrant-sigil","name_es":"Sello Aberrante Mayor","name_en":"Greater Aberrant Sigil","quantity":150},{"id":"greater-crimson-sigil","name_es":"Sello Carmesí Mayor","name_en":"Greater Crimson Sigil","quantity":150}]',
    'https://ark.wiki.gg/wiki/Red-Handed_(Lost_Colony)'),
  ('lost-colony','red-handed','alpha',95,
    '[]',
    '[{"id":"alpha-ossidon-skull","name_es":"Cráneo de Ossidon Alfa","name_en":"Alpha Ossidon Skull","quantity":5},{"id":"alpha-zombie-brains","name_es":"Cerebros de Zombi Alfa","name_en":"Alpha Zombie Brains","quantity":10},{"id":"neophyte-horns","name_es":"Cuernos de Neófito","name_en":"Neophyte Horns","quantity":15},{"id":"prime-aberrant-sigil","name_es":"Sello Aberrante Supremo","name_en":"Prime Aberrant Sigil","quantity":200},{"id":"prime-crimson-sigil","name_es":"Sello Carmesí Supremo","name_en":"Prime Crimson Sigil","quantity":200}]',
    'https://ark.wiki.gg/wiki/Red-Handed_(Lost_Colony)'),
  ('crystal-isles','crystal-wyvern-queen','gamma',55,
    '[{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1}]',
    '[{"id":"primal-crystal","name_es":"Cristal Primordial","name_en":"Primal Crystal","quantity":10},{"id":"crystal-talon","name_es":"Garra de Cristal","name_en":"Crystal Talon","quantity":5},{"id":"alpha-crystal-talon","name_es":"Garra de Cristal Alfa","name_en":"Alpha Crystal Talon","quantity":1}]',
    'https://ark.wiki.gg/wiki/Crystal_Wyvern_Queen'),
  ('crystal-isles','crystal-wyvern-queen','beta',75,
    '[{"id":"artifact-depths","name_es":"Artefacto de las Profundidades","name_en":"Artifact of the Depths","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1},{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1}]',
    '[{"id":"primal-crystal","name_es":"Cristal Primordial","name_en":"Primal Crystal","quantity":20},{"id":"crystal-talon","name_es":"Garra de Cristal","name_en":"Crystal Talon","quantity":10},{"id":"alpha-crystal-talon","name_es":"Garra de Cristal Alfa","name_en":"Alpha Crystal Talon","quantity":3}]',
    'https://ark.wiki.gg/wiki/Crystal_Wyvern_Queen'),
  ('crystal-isles','crystal-wyvern-queen','alpha',100,
    '[{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-shadows","name_es":"Artefacto de las Sombras","name_en":"Artifact of the Shadows","quantity":1},{"id":"artifact-stalker","name_es":"Artefacto del Acechador","name_en":"Artifact of the Stalker","quantity":1},{"id":"artifact-lost","name_es":"Artefacto de los Perdidos","name_en":"Artifact of the Lost","quantity":1},{"id":"artifact-gatekeeper","name_es":"Artefacto del Guardián","name_en":"Artifact of the Gatekeeper","quantity":1},{"id":"artifact-crag","name_es":"Artefacto del Peñasco","name_en":"Artifact of the Crag","quantity":1},{"id":"artifact-destroyer","name_es":"Artefacto del Destructor","name_en":"Artifact of the Destroyer","quantity":1}]',
    '[{"id":"primal-crystal","name_es":"Cristal Primordial","name_en":"Primal Crystal","quantity":30},{"id":"crystal-talon","name_es":"Garra de Cristal","name_en":"Crystal Talon","quantity":15},{"id":"alpha-crystal-talon","name_es":"Garra de Cristal Alfa","name_en":"Alpha Crystal Talon","quantity":5}]',
    'https://ark.wiki.gg/wiki/Crystal_Wyvern_Queen'),
  ('lost-island','dinopithecus-king','gamma',55,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":3},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":5},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":5},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":3},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5}]',
    'https://ark.wiki.gg/wiki/Dinopithecus_King'),
  ('lost-island','dinopithecus-king','beta',75,
    '[{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"basilisk-scale","name_es":"Escama de Basilisco","name_en":"Basilisk Scale","quantity":2},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":5},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":5},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":2},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":5},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":5}]',
    'https://ark.wiki.gg/wiki/Dinopithecus_King'),
  ('lost-island','dinopithecus-king','alpha',100,
    '[{"id":"artifact-devious","name_es":"Artefacto del Pérfido","name_en":"Artifact of the Devious","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1}]',
    '[{"id":"basilisk-scale","name_es":"Escama de Basilisco","name_en":"Basilisk Scale","quantity":2},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":1},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":2},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":5},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":2},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":5},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":2}]',
    'https://ark.wiki.gg/wiki/Dinopithecus_King'),
  ('astraeos','natrix','gamma',30,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[]',
    'https://ark.wiki.gg/wiki/Natrix'),
  ('astraeos','natrix','beta',50,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":5},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":5},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":5},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5}]',
    'https://ark.wiki.gg/wiki/Natrix'),
  ('astraeos','natrix','alpha',70,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10}]',
    'https://ark.wiki.gg/wiki/Natrix'),
  ('astraeos','thodes','gamma',null,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1}]',
    '[]',
    'https://ark.wiki.gg/wiki/Thodes'),
  ('astraeos','thodes','beta',null,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1}]',
    '[{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":5},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":5},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":5},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":5},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":5}]',
    'https://ark.wiki.gg/wiki/Thodes'),
  ('astraeos','thodes','alpha',null,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1}]',
    '[{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":10},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10}]',
    'https://ark.wiki.gg/wiki/Thodes'),
  ('astraeos','hydraskos','gamma',90,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[]',
    'https://ark.wiki.gg/wiki/Hydraskos'),
  ('astraeos','hydraskos','beta',90,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":5},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":5},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":1},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":5},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":5},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":5}]',
    'https://ark.wiki.gg/wiki/Hydraskos'),
  ('astraeos','hydraskos','alpha',90,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":10},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":10},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":2},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":10},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":15},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":10}]',
    'https://ark.wiki.gg/wiki/Hydraskos'),
  ('aquatica','cymathoa','gamma',45,
    '[{"id":"artifact-mighty","name_es":"Artefacto del Poderoso","name_en":"Artifact of the Mighty","quantity":1}]',
    '[{"id":"onchopristis-blade","name_es":"Hoja de Onchopristis","name_en":"Onchopristis Blade","quantity":1},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":1}]',
    'https://ark.wiki.gg/wiki/Cymathoa'),
  ('aquatica','cymathoa','beta',65,
    '[{"id":"artifact-mighty","name_es":"Artefacto del Poderoso","name_en":"Artifact of the Mighty","quantity":1}]',
    '[{"id":"onchopristis-blade","name_es":"Hoja de Onchopristis","name_en":"Onchopristis Blade","quantity":5},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":5},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":5},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":5}]',
    'https://ark.wiki.gg/wiki/Cymathoa'),
  ('aquatica','cymathoa','alpha',85,
    '[{"id":"artifact-mighty","name_es":"Artefacto del Poderoso","name_en":"Artifact of the Mighty","quantity":1}]',
    '[{"id":"onchopristis-blade","name_es":"Hoja de Onchopristis","name_en":"Onchopristis Blade","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"alpha-mosasaur-tooth","name_es":"Diente de Mosasaur Alfa","name_en":"Alpha Mosasaur Tooth","quantity":1}]',
    'https://ark.wiki.gg/wiki/Cymathoa'),
  ('aquatica','fractalis','gamma',10,
    '[{"id":"artifact-fallen","name_es":"Artefacto del Caído","name_en":"Artifact of the Fallen","quantity":1}]',
    '[{"id":"monodon-horn","name_es":"Cuerno de Monodon","name_en":"Monodon Horn","quantity":1},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":1}]',
    'https://ark.wiki.gg/wiki/Fractalis'),
  ('aquatica','fractalis','beta',50,
    '[{"id":"artifact-fallen","name_es":"Artefacto del Caído","name_en":"Artifact of the Fallen","quantity":1}]',
    '[{"id":"monodon-horn","name_es":"Cuerno de Monodon","name_en":"Monodon Horn","quantity":5},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":5},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":5}]',
    'https://ark.wiki.gg/wiki/Fractalis'),
  ('aquatica','fractalis','alpha',70,
    '[{"id":"artifact-fallen","name_es":"Artefacto del Caído","name_en":"Artifact of the Fallen","quantity":1}]',
    '[{"id":"monodon-horn","name_es":"Cuerno de Monodon","name_en":"Monodon Horn","quantity":10},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":10},{"id":"alpha-megalodon-fin","name_es":"Aleta de Megalodon Alfa","name_en":"Alpha Megalodon Fin","quantity":1}]',
    'https://ark.wiki.gg/wiki/Fractalis'),
  ('aquatica','vulcanithys','gamma',55,
    '[{"id":"artifact-seeking","name_es":"Artefacto del Buscador","name_en":"Artifact of the Seeking","quantity":1}]',
    '[{"id":"monodon-horn","name_es":"Cuerno de Monodon","name_en":"Monodon Horn","quantity":1},{"id":"water-talon","name_es":"Garra de Agua","name_en":"Water Talon","quantity":1}]',
    'https://ark.wiki.gg/wiki/Vulcanithys'),
  ('aquatica','vulcanithys','beta',70,
    '[{"id":"artifact-seeking","name_es":"Artefacto del Buscador","name_en":"Artifact of the Seeking","quantity":1}]',
    '[{"id":"monodon-horn","name_es":"Cuerno de Monodon","name_en":"Monodon Horn","quantity":5},{"id":"water-talon","name_es":"Garra de Agua","name_en":"Water Talon","quantity":5},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":5},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":5},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":5}]',
    'https://ark.wiki.gg/wiki/Vulcanithys'),
  ('aquatica','vulcanithys','alpha',95,
    '[{"id":"artifact-seeking","name_es":"Artefacto del Buscador","name_en":"Artifact of the Seeking","quantity":1}]',
    '[{"id":"monodon-horn","name_es":"Cuerno de Monodon","name_en":"Monodon Horn","quantity":10},{"id":"water-talon","name_es":"Garra de Agua","name_en":"Water Talon","quantity":10},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":10},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":10},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":10},{"id":"alpha-water-talon","name_es":"Garra de Agua Alfa","name_en":"Alpha Water Talon","quantity":1}]',
    'https://ark.wiki.gg/wiki/Vulcanithys'),
  ('aquatica','pygocentrus','gamma',55,
    '[]',
    '[{"id":"gamma-cymathoa-trophy","name_es":"Trofeo Gamma de Cymathoa","name_en":"Gamma Cymathoa Trophy","quantity":1},{"id":"gamma-fractalis-trophy","name_es":"Trofeo Gamma de Fractalis","name_en":"Gamma Fractalis Trophy","quantity":1},{"id":"gamma-vulcanithys-trophy","name_es":"Trofeo Gamma de Vulcanithys","name_en":"Gamma Vulcanithys Trophy","quantity":1}]',
    'https://ark.wiki.gg/wiki/Pygocentrus'),
  ('aquatica','pygocentrus','beta',75,
    '[]',
    '[{"id":"beta-cymathoa-trophy","name_es":"Trofeo Beta de Cymathoa","name_en":"Beta Cymathoa Trophy","quantity":1},{"id":"beta-fractalis-trophy","name_es":"Trofeo Beta de Fractalis","name_en":"Beta Fractalis Trophy","quantity":1},{"id":"beta-vulcanithys-trophy","name_es":"Trofeo Beta de Vulcanithys","name_en":"Beta Vulcanithys Trophy","quantity":1},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":5},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":5},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":5}]',
    'https://ark.wiki.gg/wiki/Pygocentrus'),
  ('aquatica','pygocentrus','alpha',100,
    '[]',
    '[{"id":"alpha-cymathoa-trophy","name_es":"Trofeo Alfa de Cymathoa","name_en":"Alpha Cymathoa Trophy","quantity":1},{"id":"alpha-fractalis-trophy","name_es":"Trofeo Alfa de Fractalis","name_en":"Alpha Fractalis Trophy","quantity":1},{"id":"alpha-vulcanithys-trophy","name_es":"Trofeo Alfa de Vulcanithys","name_en":"Alpha Vulcanithys Trophy","quantity":1},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":10},{"id":"alpha-karkinos-claw","name_es":"Garra de Karkinos Alfa","name_en":"Alpha Karkinos Claw","quantity":1},{"id":"alpha-tusoteuthis-eye","name_es":"Ojo de Tusoteuthis Alfa","name_en":"Alpha Tusoteuthis Eye","quantity":1},{"id":"alpha-tyrannosaur-tooth","name_es":"Diente de Tyrannosaur Alfa","name_en":"Alpha Tyrannosaur Tooth","quantity":1}]',
    'https://ark.wiki.gg/wiki/Pygocentrus'),
  ('astraeos','minotarchos','gamma',null,
    '[]',
    '[{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":2},{"id":"corrupted-nodule","name_es":"Nódulo Corrupto","name_en":"Corrupted Nodule","quantity":25},{"id":"lightning-talon","name_es":"Garra de Rayo","name_en":"Lightning Talon","quantity":5},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":25},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10}]',
    'https://ark.wiki.gg/wiki/Minotarchos'),
  ('astraeos','erymanthian-kalydonios','gamma',null,
    '[]',
    '[{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":2},{"id":"corrupted-nodule","name_es":"Nódulo Corrupto","name_en":"Corrupted Nodule","quantity":25},{"id":"fire-talon","name_es":"Garra de Fuego","name_en":"Fire Talon","quantity":5},{"id":"poison-talon","name_es":"Garra de Veneno","name_en":"Poison Talon","quantity":5},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":10}]',
    'https://ark.wiki.gg/wiki/Erymanthian_%26_Kalydonios'),
  ('scorched-earth','manticore','gamma',55,
    '[{"id":"artifact-gatekeeper","name_es":"Artefacto del Guardián","name_en":"Artifact of the Gatekeeper","quantity":1},{"id":"artifact-crag","name_es":"Artefacto del Peñasco","name_en":"Artifact of the Crag","quantity":1},{"id":"artifact-destroyer","name_es":"Artefacto del Destructor","name_en":"Artifact of the Destroyer","quantity":1}]',
    '[{"id":"fire-talon","name_es":"Garra de Fuego","name_en":"Fire Talon","quantity":2},{"id":"lightning-talon","name_es":"Garra de Rayo","name_en":"Lightning Talon","quantity":2},{"id":"poison-talon","name_es":"Garra de Veneno","name_en":"Poison Talon","quantity":2}]',
    'https://ark.wiki.gg/wiki/Manticore_Arena_(Scorched_Earth)'),
  ('scorched-earth','manticore','beta',70,
    '[{"id":"artifact-gatekeeper","name_es":"Artefacto del Guardián","name_en":"Artifact of the Gatekeeper","quantity":1},{"id":"artifact-crag","name_es":"Artefacto del Peñasco","name_en":"Artifact of the Crag","quantity":1},{"id":"artifact-destroyer","name_es":"Artefacto del Destructor","name_en":"Artifact of the Destroyer","quantity":1}]',
    '[{"id":"fire-talon","name_es":"Garra de Fuego","name_en":"Fire Talon","quantity":10},{"id":"lightning-talon","name_es":"Garra de Rayo","name_en":"Lightning Talon","quantity":10},{"id":"poison-talon","name_es":"Garra de Veneno","name_en":"Poison Talon","quantity":10}]',
    'https://ark.wiki.gg/wiki/Manticore_Arena_(Scorched_Earth)'),
  ('scorched-earth','manticore','alpha',95,
    '[{"id":"artifact-gatekeeper","name_es":"Artefacto del Guardián","name_en":"Artifact of the Gatekeeper","quantity":1},{"id":"artifact-crag","name_es":"Artefacto del Peñasco","name_en":"Artifact of the Crag","quantity":1},{"id":"artifact-destroyer","name_es":"Artefacto del Destructor","name_en":"Artifact of the Destroyer","quantity":1}]',
    '[{"id":"fire-talon","name_es":"Garra de Fuego","name_en":"Fire Talon","quantity":20},{"id":"lightning-talon","name_es":"Garra de Rayo","name_en":"Lightning Talon","quantity":20},{"id":"poison-talon","name_es":"Garra de Veneno","name_en":"Poison Talon","quantity":20}]',
    'https://ark.wiki.gg/wiki/Manticore_Arena_(Scorched_Earth)'),
  ('aberration','rockwell','gamma',60,
    '[{"id":"artifact-depths","name_es":"Artefacto de las Profundidades","name_en":"Artifact of the Depths","quantity":1},{"id":"artifact-shadows","name_es":"Artefacto de las Sombras","name_en":"Artifact of the Shadows","quantity":1},{"id":"artifact-stalker","name_es":"Artefacto del Acechador","name_en":"Artifact of the Stalker","quantity":1}]',
    '[]',
    'https://ark.wiki.gg/wiki/Rockwell_Arena_(Aberration)'),
  ('aberration','rockwell','beta',75,
    '[{"id":"artifact-depths","name_es":"Artefacto de las Profundidades","name_en":"Artifact of the Depths","quantity":1},{"id":"artifact-shadows","name_es":"Artefacto de las Sombras","name_en":"Artifact of the Shadows","quantity":1},{"id":"artifact-stalker","name_es":"Artefacto del Acechador","name_en":"Artifact of the Stalker","quantity":1}]',
    '[{"id":"basilisk-scale","name_es":"Escama de Basilisco","name_en":"Basilisk Scale","quantity":4},{"id":"nameless-venom","name_es":"Veneno de Nameless","name_en":"Nameless Venom","quantity":12},{"id":"reaper-pheromone-gland","name_es":"Glándula de Feromonas de Reaper","name_en":"Reaper Pheromone Gland","quantity":2},{"id":"rock-drake-feather","name_es":"Pluma de Rock Drake","name_en":"Rock Drake Feather","quantity":2}]',
    'https://ark.wiki.gg/wiki/Rockwell_Arena_(Aberration)'),
  ('aberration','rockwell','alpha',100,
    '[{"id":"artifact-depths","name_es":"Artefacto de las Profundidades","name_en":"Artifact of the Depths","quantity":1},{"id":"artifact-shadows","name_es":"Artefacto de las Sombras","name_en":"Artifact of the Shadows","quantity":1},{"id":"artifact-stalker","name_es":"Artefacto del Acechador","name_en":"Artifact of the Stalker","quantity":1}]',
    '[{"id":"basilisk-scale","name_es":"Escama de Basilisco","name_en":"Basilisk Scale","quantity":8},{"id":"nameless-venom","name_es":"Veneno de Nameless","name_en":"Nameless Venom","quantity":20},{"id":"reaper-pheromone-gland","name_es":"Glándula de Feromonas de Reaper","name_en":"Reaper Pheromone Gland","quantity":7},{"id":"rock-drake-feather","name_es":"Pluma de Rock Drake","name_en":"Rock Drake Feather","quantity":7},{"id":"alpha-basilisk-fang","name_es":"Colmillo de Basilisco Alfa","name_en":"Alpha Basilisk Fang","quantity":1},{"id":"alpha-karkinos-claw","name_es":"Garra de Karkinos Alfa","name_en":"Alpha Karkinos Claw","quantity":1},{"id":"alpha-reaper-king-barb","name_es":"Púa de Reaper King Alfa","name_en":"Alpha Reaper King Barb","quantity":1}]',
    'https://ark.wiki.gg/wiki/Rockwell_Arena_(Aberration)'),
  ('extinction','desert-titan','gamma',1,
    '[{"id":"artifact-chaos","name_es":"Artefacto del Caos","name_en":"Artifact of Chaos","quantity":1}]',
    '[{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":100},{"id":"fire-talon","name_es":"Garra de Fuego","name_en":"Fire Talon","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10}]',
    'https://ark.wiki.gg/wiki/Desert_Titan'),
  ('extinction','forest-titan','gamma',1,
    '[{"id":"artifact-growth","name_es":"Artefacto del Crecimiento","name_en":"Artifact of Growth","quantity":1}]',
    '[{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":100},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":10}]',
    'https://ark.wiki.gg/wiki/Forest_Titan'),
  ('extinction','ice-titan','gamma',1,
    '[{"id":"artifact-void","name_es":"Artefacto del Vacío","name_en":"Artifact of the Void","quantity":1}]',
    '[{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":100},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":10}]',
    'https://ark.wiki.gg/wiki/Ice_Titan'),
  ('extinction','king-titan','gamma',1,
    '[]',
    '[{"id":"alpha-tyrannosaur-tooth","name_es":"Diente de Tyrannosaur Alfa","name_en":"Alpha Tyrannosaur Tooth","quantity":5},{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":150},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10},{"id":"desert-titan-trophy","name_es":"Trofeo del Titán del Desierto","name_en":"Desert Titan Trophy","quantity":1},{"id":"forest-titan-trophy","name_es":"Trofeo del Titán del Bosque","name_en":"Forest Titan Trophy","quantity":1},{"id":"ice-titan-trophy","name_es":"Trofeo del Titán del Hielo","name_en":"Ice Titan Trophy","quantity":1}]',
    'https://ark.wiki.gg/wiki/King_Titan_Arena_(Extinction)'),
  ('extinction','king-titan','beta',1,
    '[]',
    '[{"id":"alpha-tyrannosaur-tooth","name_es":"Diente de Tyrannosaur Alfa","name_en":"Alpha Tyrannosaur Tooth","quantity":10},{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":300},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":20},{"id":"desert-titan-trophy","name_es":"Trofeo del Titán del Desierto","name_en":"Desert Titan Trophy","quantity":1},{"id":"forest-titan-trophy","name_es":"Trofeo del Titán del Bosque","name_en":"Forest Titan Trophy","quantity":1},{"id":"ice-titan-trophy","name_es":"Trofeo del Titán del Hielo","name_en":"Ice Titan Trophy","quantity":1},{"id":"king-titan-trophy-gamma","name_es":"Trofeo Gamma del King Titan","name_en":"King Titan Trophy (Gamma)","quantity":1}]',
    'https://ark.wiki.gg/wiki/King_Titan_Arena_(Extinction)'),
  ('extinction','king-titan','alpha',1,
    '[]',
    '[{"id":"alpha-tyrannosaur-tooth","name_es":"Diente de Tyrannosaur Alfa","name_en":"Alpha Tyrannosaur Tooth","quantity":10},{"id":"corrupt-heart","name_es":"Corazón Corrupto","name_en":"Corrupt Heart","quantity":300},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":20},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":20},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":20},{"id":"desert-titan-trophy","name_es":"Trofeo del Titán del Desierto","name_en":"Desert Titan Trophy","quantity":1},{"id":"forest-titan-trophy","name_es":"Trofeo del Titán del Bosque","name_en":"Forest Titan Trophy","quantity":1},{"id":"ice-titan-trophy","name_es":"Trofeo del Titán del Hielo","name_en":"Ice Titan Trophy","quantity":1},{"id":"king-titan-trophy-beta","name_es":"Trofeo Beta del King Titan","name_en":"King Titan Trophy (Beta)","quantity":1}]',
    'https://ark.wiki.gg/wiki/King_Titan_Arena_(Extinction)'),
  ('fjordur','beyla','gamma',50,
    '[]',
    '[{"id":"runestone","name_es":"Runestone","name_en":"Runestone","quantity":30}]',
    'https://ark.wiki.gg/wiki/Beyla'),
  ('fjordur','hati-and-skoll','gamma',50,
    '[]',
    '[{"id":"runestone","name_es":"Runestone","name_en":"Runestone","quantity":30}]',
    'https://ark.wiki.gg/wiki/Hati_and_Sk%C3%B6ll'),
  ('fjordur','steinbjorn','gamma',50,
    '[]',
    '[{"id":"runestone","name_es":"Runestone","name_en":"Runestone","quantity":30}]',
    'https://ark.wiki.gg/wiki/Steinbj%C3%B6rn'),
  ('fjordur','broodmother-fjordur','gamma',30,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[{"id":"beyla-relic","name_es":"Reliquia de Beyla","name_en":"Beyla Relic","quantity":1}]',
    'https://ark.wiki.gg/wiki/Broodmother_Lysrix'),
  ('fjordur','broodmother-fjordur','beta',50,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[{"id":"beyla-relic","name_es":"Reliquia de Beyla","name_en":"Beyla Relic","quantity":1},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":5},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":5},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":5},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5}]',
    'https://ark.wiki.gg/wiki/Broodmother_Lysrix'),
  ('fjordur','broodmother-fjordur','alpha',70,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[{"id":"beyla-relic","name_es":"Reliquia de Beyla","name_en":"Beyla Relic","quantity":1},{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10}]',
    'https://ark.wiki.gg/wiki/Broodmother_Lysrix'),
  ('fjordur','megapithecus-fjordur','gamma',45,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[{"id":"steinbjorn-relic","name_es":"Reliquia de Steinbjörn","name_en":"Steinbjörn Relic","quantity":1}]',
    'https://ark.wiki.gg/wiki/Megapithecus'),
  ('fjordur','megapithecus-fjordur','beta',65,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[{"id":"steinbjorn-relic","name_es":"Reliquia de Steinbjörn","name_en":"Steinbjörn Relic","quantity":1},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":5},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":5},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":5},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":5},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":5}]',
    'https://ark.wiki.gg/wiki/Megapithecus'),
  ('fjordur','megapithecus-fjordur','alpha',85,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[{"id":"steinbjorn-relic","name_es":"Reliquia de Steinbjörn","name_en":"Steinbjörn Relic","quantity":1},{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":10},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10}]',
    'https://ark.wiki.gg/wiki/Megapithecus'),
  ('fjordur','dragon-fjordur','gamma',55,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"hati-relic","name_es":"Reliquia de Hati","name_en":"Hati Relic","quantity":1},{"id":"skoll-relic","name_es":"Reliquia de Sköll","name_en":"Sköll Relic","quantity":1}]',
    'https://ark.wiki.gg/wiki/Dragon'),
  ('fjordur','dragon-fjordur','beta',75,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"hati-relic","name_es":"Reliquia de Hati","name_en":"Hati Relic","quantity":1},{"id":"skoll-relic","name_es":"Reliquia de Sköll","name_en":"Sköll Relic","quantity":1},{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":5},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":5},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":5},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":5},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":1},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":5}]',
    'https://ark.wiki.gg/wiki/Dragon'),
  ('fjordur','dragon-fjordur','alpha',100,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"hati-relic","name_es":"Reliquia de Hati","name_en":"Hati Relic","quantity":1},{"id":"skoll-relic","name_es":"Reliquia de Sköll","name_en":"Sköll Relic","quantity":1},{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":10},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":10},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":10},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":10},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":2},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":15}]',
    'https://ark.wiki.gg/wiki/Dragon'),
  ('fjordur','fenrisulfr','gamma',55,
    '[]',
    '[{"id":"gamma-broodmother-trophy","name_es":"Trofeo Gamma de Broodmother","name_en":"Gamma Broodmother Trophy","quantity":1},{"id":"gamma-megapithecus-trophy","name_es":"Trofeo Gamma de Megapithecus","name_en":"Gamma Megapithecus Trophy","quantity":1},{"id":"gamma-dragon-trophy","name_es":"Trofeo Gamma de Dragon","name_en":"Gamma Dragon Trophy","quantity":1}]',
    'https://ark.wiki.gg/wiki/Fenris%C3%BAlfr'),
  ('fjordur','fenrisulfr','beta',75,
    '[]',
    '[{"id":"beta-broodmother-trophy","name_es":"Trofeo Beta de Broodmother","name_en":"Beta Broodmother Trophy","quantity":1},{"id":"beta-megapithecus-trophy","name_es":"Trofeo Beta de Megapithecus","name_en":"Beta Megapithecus Trophy","quantity":1},{"id":"beta-dragon-trophy","name_es":"Trofeo Beta de Dragon","name_en":"Beta Dragon Trophy","quantity":1}]',
    'https://ark.wiki.gg/wiki/Fenris%C3%BAlfr'),
  ('fjordur','fenrisulfr','alpha',100,
    '[]',
    '[{"id":"alpha-broodmother-trophy","name_es":"Trofeo Alfa de Broodmother","name_en":"Alpha Broodmother Trophy","quantity":1},{"id":"alpha-megapithecus-trophy","name_es":"Trofeo Alfa de Megapithecus","name_en":"Alpha Megapithecus Trophy","quantity":1},{"id":"alpha-dragon-trophy","name_es":"Trofeo Alfa de Dragon","name_en":"Alpha Dragon Trophy","quantity":1}]',
    'https://ark.wiki.gg/wiki/Fenris%C3%BAlfr')
) as seed(map_slug,boss_slug,difficulty,min_level,artifacts,tributes,source_url)
join public.bosses b on b.slug = seed.boss_slug
join public.maps m on m.id = b.map_id and m.slug = seed.map_slug
on conflict (boss_id, difficulty) do update set
  min_player_level = excluded.min_player_level, max_players = excluded.max_players,
  artifacts = excluded.artifacts, tributes = excluded.tributes, unlocks = excluded.unlocks,
  notes = excluded.notes, notes_es = excluded.notes_es, notes_en = excluded.notes_en,
  source_url = excluded.source_url, source_name = excluded.source_name, reviewed_at = excluded.reviewed_at,
  content_status = 'published', updated_at = now();

-- Corrido final (revisión externa): Corrupted Master Controller NO es "pendiente sin
-- requisitos". The Final Test publica 58/116/168 misiones completadas para iniciarse;
-- no son niveles de jugador, por lo que min_player_level queda null y el requisito se
-- representa en notas_es/notes_en sin artefactos ni tributos inventados.
insert into public.boss_requirements(
  boss_id, difficulty, item_name, quantity, min_player_level, max_players, artifacts, tributes, unlocks,
  notes, notes_es, notes_en, source_url, source_name, reviewed_at, content_status
)
select b.id, seed.difficulty, null, null, null, 10, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  seed.notes_es, seed.notes_es, seed.notes_en, 'https://ark.wiki.gg/wiki/Corrupted_Master_Controller',
  'ARK Official Community Wiki', '2026-08-11 00:00:00+00'::timestamptz, 'published'
from (values
  ('corrupted-master-controller','gamma',
    'El superviviente que inicia The Final Test debe haber completado al menos 58 misiones.',
    'The survivor starting The Final Test must have completed at least 58 missions.'),
  ('corrupted-master-controller','beta',
    'El superviviente que inicia The Final Test debe haber completado al menos 116 misiones.',
    'The survivor starting The Final Test must have completed at least 116 missions.'),
  ('corrupted-master-controller','alpha',
    'El superviviente que inicia The Final Test debe haber completado al menos 168 misiones.',
    'The survivor starting The Final Test must have completed at least 168 missions.')
) as seed(boss_slug, difficulty, notes_es, notes_en)
join public.bosses b on b.slug = seed.boss_slug
on conflict (boss_id, difficulty) do update set
  min_player_level = excluded.min_player_level, max_players = excluded.max_players,
  artifacts = excluded.artifacts, tributes = excluded.tributes, unlocks = excluded.unlocks,
  notes = excluded.notes, notes_es = excluded.notes_es, notes_en = excluded.notes_en,
  source_url = excluded.source_url, source_name = excluded.source_name, reviewed_at = excluded.reviewed_at,
  content_status = 'published', updated_at = now();

-- Thodes: la fuente publica '?' como Player Level en las tres dificultades, así que
-- min_player_level queda null (arriba) y las notas genéricas se sustituyen por la
-- aclaración del dato desconocido; artefactos y tributos verificados se conservan.
update public.boss_requirements br
set notes = x.notes, notes_es = x.notes_es, notes_en = x.notes_en, updated_at = now()
from (values
  ('astraeos','thodes','gamma',
    'Nivel de jugador no publicado por la fuente (marcado como "?"); artefactos y tributos verificados.',
    'Player level not published by the source (marked as "?"); artifacts and tributes verified.'),
  ('astraeos','thodes','beta',
    'Nivel de jugador no publicado por la fuente (marcado como "?"); artefactos y tributos verificados.',
    'Player level not published by the source (marked as "?"); artifacts and tributes verified.'),
  ('astraeos','thodes','alpha',
    'Nivel de jugador no publicado por la fuente (marcado como "?"); artefactos y tributos verificados.',
    'Player level not published by the source (marked as "?"); artifacts and tributes verified.')
) as x(map_slug, boss_slug, difficulty, notes, notes_es, notes_en)
join public.bosses b on b.slug = x.boss_slug
join public.maps m on m.id = b.map_id and m.slug = x.map_slug
where br.boss_id = b.id and br.difficulty = x.difficulty;

commit;
