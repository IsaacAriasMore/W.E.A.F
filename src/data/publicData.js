const REVIEWED_AT = '2026-07-22';
const WIKI = 'https://ark.wiki.gg';

const requirementItem = (id, nameEs, nameEn, quantity) => ({ id, name_es: nameEs, name_en: nameEn, quantity });
const requirement = ({ level, artifacts = [], tributes = [], source }) => ({
  min_player_level: level,
  max_players: 10,
  artifacts,
  tributes,
  unlocks: [],
  notes_es: 'Verifica multiplicadores, mods y reglas específicas de tu servidor antes de abrir la arena.',
  notes_en: 'Check your server multipliers, mods, and specific rules before opening the arena.',
  source_url: source,
  source_name: 'ARK Official Community Wiki',
  reviewed_at: REVIEWED_AT,
  content_status: 'published',
});

const islandArtifacts = {
  broodmother: [
    requirementItem('artifact-clever', 'Artefacto del Astuto', 'Artifact of the Clever', 1),
    requirementItem('artifact-hunter', 'Artefacto del Cazador', 'Artifact of the Hunter', 1),
    requirementItem('artifact-massive', 'Artefacto del Colosal', 'Artifact of the Massive', 1),
  ],
  megapithecus: [
    requirementItem('artifact-brute', 'Artefacto del Bruto', 'Artifact of the Brute', 1),
    requirementItem('artifact-devourer', 'Artefacto del Devorador', 'Artifact of the Devourer', 1),
    requirementItem('artifact-pack', 'Artefacto de la Manada', 'Artifact of the Pack', 1),
  ],
  dragon: [
    requirementItem('artifact-cunning', 'Artefacto de la Astucia', 'Artifact of the Cunning', 1),
    requirementItem('artifact-immune', 'Artefacto de la Inmunidad', 'Artifact of the Immune', 1),
    requirementItem('artifact-skylord', 'Artefacto del Señor del Cielo', 'Artifact of the Skylord', 1),
    requirementItem('artifact-strong', 'Artefacto del Fuerte', 'Artifact of the Strong', 1),
  ],
};

const boss = ({ slug, name, type = 'main', descriptionEs, descriptionEn, requirements = {}, source }) => ({
  id: slug,
  slug,
  name,
  name_es: name,
  name_en: name,
  boss_type: type,
  game_availability: 'both',
  description_es: descriptionEs,
  description_en: descriptionEn,
  image_url: null,
  source_url: source,
  source_name: 'ARK Official Community Wiki',
  reviewed_at: REVIEWED_AT,
  content_status: 'published',
  requirements,
});

const islandBosses = [
  boss({
    slug: 'broodmother-lysrix', name: 'Broodmother Lysrix',
    descriptionEs: 'Guardiana arácnida de The Island. La arena admite hasta 10 supervivientes.',
    descriptionEn: 'The Island spider guardian. The arena supports up to 10 survivors.',
    source: `${WIKI}/wiki/Broodmother_Lysrix`,
    requirements: {
      gamma: requirement({ level: 30, artifacts: islandArtifacts.broodmother, source: `${WIKI}/wiki/Broodmother_Lysrix` }),
      beta: requirement({ level: 50, artifacts: islandArtifacts.broodmother, source: `${WIKI}/wiki/Broodmother_Lysrix`, tributes: [
        requirementItem('argentavis-talon', 'Garra de Argentavis', 'Argentavis Talon', 5),
        requirementItem('sarcosuchus-skin', 'Piel de Sarcosuchus', 'Sarcosuchus Skin', 5),
        requirementItem('sauropod-vertebra', 'Vértebra de saurópodo', 'Sauropod Vertebra', 5),
        requirementItem('titanoboa-venom', 'Veneno de Titanoboa', 'Titanoboa Venom', 5),
      ] }),
      alpha: requirement({ level: 70, artifacts: islandArtifacts.broodmother, source: `${WIKI}/wiki/Broodmother_Lysrix`, tributes: [
        requirementItem('argentavis-talon', 'Garra de Argentavis', 'Argentavis Talon', 10),
        requirementItem('sarcosuchus-skin', 'Piel de Sarcosuchus', 'Sarcosuchus Skin', 10),
        requirementItem('sauropod-vertebra', 'Vértebra de saurópodo', 'Sauropod Vertebra', 10),
        requirementItem('titanoboa-venom', 'Veneno de Titanoboa', 'Titanoboa Venom', 10),
      ] }),
    },
  }),
  boss({
    slug: 'megapithecus', name: 'Megapithecus',
    descriptionEs: 'Guardiana de clima extremo con una arena donde el posicionamiento es decisivo.',
    descriptionEn: 'Cold-climate guardian whose arena makes positioning decisive.',
    source: `${WIKI}/wiki/Megapithecus`,
    requirements: {
      gamma: requirement({ level: 45, artifacts: islandArtifacts.megapithecus, source: `${WIKI}/wiki/Megapithecus` }),
      beta: requirement({ level: 65, artifacts: islandArtifacts.megapithecus, source: `${WIKI}/wiki/Megapithecus`, tributes: [
        requirementItem('megalania-toxin', 'Toxina de Megalania', 'Megalania Toxin', 5),
        requirementItem('megalodon-tooth', 'Diente de Megalodon', 'Megalodon Tooth', 5),
        requirementItem('spinosaurus-sail', 'Vela de Spinosaurus', 'Spinosaurus Sail', 5),
        requirementItem('therizino-claws', 'Garras de Therizinosaur', 'Therizino Claws', 5),
        requirementItem('thylacoleo-hook-claw', 'Garra de Thylacoleo', 'Thylacoleo Hook-Claw', 5),
      ] }),
      alpha: requirement({ level: 85, artifacts: islandArtifacts.megapithecus, source: `${WIKI}/wiki/Megapithecus`, tributes: [
        requirementItem('megalania-toxin', 'Toxina de Megalania', 'Megalania Toxin', 10),
        requirementItem('megalodon-tooth', 'Diente de Megalodon', 'Megalodon Tooth', 10),
        requirementItem('spinosaurus-sail', 'Vela de Spinosaurus', 'Spinosaurus Sail', 10),
        requirementItem('therizino-claws', 'Garras de Therizinosaur', 'Therizino Claws', 10),
        requirementItem('thylacoleo-hook-claw', 'Garra de Thylacoleo', 'Thylacoleo Hook-Claw', 10),
      ] }),
    },
  }),
  boss({
    slug: 'dragon', name: 'Dragon',
    descriptionEs: 'El guardián de fuego exige preparación para daño porcentual y movilidad.',
    descriptionEn: 'The fire guardian demands preparation for percentage damage and mobility.',
    source: `${WIKI}/wiki/Dragon`,
    requirements: {
      gamma: requirement({ level: 55, artifacts: islandArtifacts.dragon, source: `${WIKI}/wiki/Dragon` }),
      beta: requirement({ level: 75, artifacts: islandArtifacts.dragon, source: `${WIKI}/wiki/Dragon`, tributes: [
        requirementItem('allosaurus-brain', 'Cerebro de Allosaurus', 'Allosaurus Brain', 5),
        requirementItem('basilosaurus-blubber', 'Grasa de Basilosaurus', 'Basilosaurus Blubber', 5),
        requirementItem('giganotosaurus-heart', 'Corazón de Giganotosaurus', 'Giganotosaurus Heart', 1),
        requirementItem('tusoteuthis-tentacle', 'Tentáculo de Tusoteuthis', 'Tusoteuthis Tentacle', 5),
        requirementItem('tyrannosaurus-arm', 'Brazo de Tyrannosaurus', 'Tyrannosaurus Arm', 5),
        requirementItem('yutyrannus-lungs', 'Pulmones de Yutyrannus', 'Yutyrannus Lungs', 5),
      ] }),
      alpha: requirement({ level: 100, artifacts: islandArtifacts.dragon, source: `${WIKI}/wiki/Dragon`, tributes: [
        requirementItem('allosaurus-brain', 'Cerebro de Allosaurus', 'Allosaurus Brain', 10),
        requirementItem('basilosaurus-blubber', 'Grasa de Basilosaurus', 'Basilosaurus Blubber', 10),
        requirementItem('giganotosaurus-heart', 'Corazón de Giganotosaurus', 'Giganotosaurus Heart', 2),
        requirementItem('tusoteuthis-tentacle', 'Tentáculo de Tusoteuthis', 'Tusoteuthis Tentacle', 10),
        requirementItem('tyrannosaurus-arm', 'Brazo de Tyrannosaurus', 'Tyrannosaurus Arm', 15),
        requirementItem('yutyrannus-lungs', 'Pulmones de Yutyrannus', 'Yutyrannus Lungs', 10),
      ] }),
    },
  }),
  boss({
    slug: 'overseer', name: 'Overseer', type: 'final',
    descriptionEs: 'Jefe final de The Island, accesible después de completar la Tek Cave.',
    descriptionEn: 'The Island final boss, reached after completing the Tek Cave.',
    source: `${WIKI}/wiki/Overseer`,
    requirements: {
      gamma: requirement({ level: 60, source: `${WIKI}/wiki/Overseer`, tributes: [
        requirementItem('gamma-broodmother-trophy', 'Trofeo Gamma de Broodmother', 'Gamma Broodmother Trophy', 1),
        requirementItem('gamma-megapithecus-trophy', 'Trofeo Gamma de Megapithecus', 'Gamma Megapithecus Trophy', 1),
        requirementItem('gamma-dragon-trophy', 'Trofeo Gamma de Dragon', 'Gamma Dragon Trophy', 1),
      ] }),
      beta: requirement({ level: 80, source: `${WIKI}/wiki/Overseer`, tributes: [
        requirementItem('beta-broodmother-trophy', 'Trofeo Beta de Broodmother', 'Beta Broodmother Trophy', 1),
        requirementItem('beta-megapithecus-trophy', 'Trofeo Beta de Megapithecus', 'Beta Megapithecus Trophy', 1),
        requirementItem('beta-dragon-trophy', 'Trofeo Beta de Dragon', 'Beta Dragon Trophy', 1),
        requirementItem('alpha-raptor-claw', 'Garra de Raptor Alfa', 'Alpha Raptor Claw', 1),
        requirementItem('alpha-carnotaurus-arm', 'Brazo de Carnotaurus Alfa', 'Alpha Carnotaurus Arm', 1),
        requirementItem('alpha-tyrannosaur-tooth', 'Diente de Tyrannosaurus Alfa', 'Alpha Tyrannosaur Tooth', 1),
      ] }),
      alpha: requirement({ level: 100, source: `${WIKI}/wiki/Overseer`, tributes: [
        requirementItem('alpha-broodmother-trophy', 'Trofeo Alfa de Broodmother', 'Alpha Broodmother Trophy', 1),
        requirementItem('alpha-megapithecus-trophy', 'Trofeo Alfa de Megapithecus', 'Alpha Megapithecus Trophy', 1),
        requirementItem('alpha-dragon-trophy', 'Trofeo Alfa de Dragon', 'Alpha Dragon Trophy', 1),
        requirementItem('alpha-raptor-claw', 'Garra de Raptor Alfa', 'Alpha Raptor Claw', 1),
        requirementItem('alpha-carnotaurus-arm', 'Brazo de Carnotaurus Alfa', 'Alpha Carnotaurus Arm', 1),
        requirementItem('alpha-tyrannosaur-tooth', 'Diente de Tyrannosaurus Alfa', 'Alpha Tyrannosaur Tooth', 1),
        requirementItem('alpha-megalodon-fin', 'Aleta de Megalodon Alfa', 'Alpha Megalodon Fin', 1),
        requirementItem('alpha-mosasaur-tooth', 'Diente de Mosasaur Alfa', 'Alpha Mosasaur Tooth', 1),
        requirementItem('alpha-tusoteuthis-eye', 'Ojo de Tusoteuthis Alfa', 'Alpha Tusoteuthis Eye', 1),
        requirementItem('alpha-leedsichthys-blubber', 'Grasa de Leedsichthys Alfa', 'Alpha Leedsichthys Blubber', 1),
      ] }),
    },
  }),
];

const catalogBosses = {
  'scorched-earth': [boss({ slug: 'manticore', name: 'Manticore', type: 'final', descriptionEs: 'Guardiana final de Scorched Earth.', descriptionEn: 'Scorched Earth final guardian.', source: `${WIKI}/wiki/Manticore` })],
  aberration: [boss({ slug: 'rockwell', name: 'Rockwell', type: 'final', descriptionEs: 'Jefe de ascensión de Aberration.', descriptionEn: 'Aberration ascension boss.', source: `${WIKI}/wiki/Rockwell` })],
  extinction: [
    boss({ slug: 'desert-titan', name: 'Desert Titan', type: 'titan', descriptionEs: 'Titán del desierto.', descriptionEn: 'Desert titan.', source: `${WIKI}/wiki/Desert_Titan` }),
    boss({ slug: 'forest-titan', name: 'Forest Titan', type: 'titan', descriptionEs: 'Titán del bosque.', descriptionEn: 'Forest titan.', source: `${WIKI}/wiki/Forest_Titan` }),
    boss({ slug: 'ice-titan', name: 'Ice Titan', type: 'titan', descriptionEs: 'Titán del hielo.', descriptionEn: 'Ice titan.', source: `${WIKI}/wiki/Ice_Titan` }),
    boss({ slug: 'king-titan', name: 'King Titan', type: 'final', descriptionEs: 'Encuentro final de Extinction.', descriptionEn: 'Extinction final encounter.', source: `${WIKI}/wiki/King_Titan` }),
  ],
  'genesis-part-1': [
    boss({ slug: 'moeder', name: 'Moeder', type: 'mission', descriptionEs: 'Encuentro oceánico de Genesis: Part 1.', descriptionEn: 'Genesis: Part 1 ocean encounter.', source: `${WIKI}/wiki/Moeder` }),
    boss({ slug: 'corrupted-master-controller', name: 'Corrupted Master Controller', type: 'final', descriptionEs: 'Jefe de ascensión de la simulación Genesis.', descriptionEn: 'Genesis simulation ascension boss.', source: `${WIKI}/wiki/Corrupted_Master_Controller` }),
  ],
  'genesis-part-2': [boss({ slug: 'rockwell-prime', name: 'Rockwell Prime', type: 'final', descriptionEs: 'Encuentro final de Genesis: Part 2.', descriptionEn: 'Genesis: Part 2 final encounter.', source: `${WIKI}/wiki/Rockwell_Prime` })],
  fjordur: [
    boss({ slug: 'beyla', name: 'Beyla', type: 'mini', descriptionEs: 'Mini-boss de Fjordur convocado con Runestones.', descriptionEn: 'Fjordur mini-boss summoned with Runestones.', source: `${WIKI}/wiki/Beyla` }),
    boss({ slug: 'hati-and-skoll', name: 'Hati & Sköll', type: 'mini', descriptionEs: 'Dúo de mini-bosses de Fjordur.', descriptionEn: 'Fjordur mini-boss pair.', source: `${WIKI}/wiki/Hati_and_Sk%C3%B6ll` }),
    boss({ slug: 'steinbjorn', name: 'Steinbjörn', type: 'mini', descriptionEs: 'Mini-boss pétreo de Jotunheim.', descriptionEn: 'Stone mini-boss found in Jotunheim.', source: `${WIKI}/wiki/Steinbj%C3%B6rn` }),
    boss({ slug: 'broodmother-fjordur', name: 'Broodmother Lysrix', descriptionEs: 'Guardiana de Fjordur; usa una reliquia adicional.', descriptionEn: 'Fjordur guardian; requires an additional relic.', source: `${WIKI}/wiki/Broodmother_Lysrix` }),
    boss({ slug: 'megapithecus-fjordur', name: 'Megapithecus', descriptionEs: 'Guardiana de Fjordur; usa una reliquia adicional.', descriptionEn: 'Fjordur guardian; requires an additional relic.', source: `${WIKI}/wiki/Megapithecus` }),
    boss({ slug: 'dragon-fjordur', name: 'Dragon', descriptionEs: 'Guardiana de Fjordur; usa reliquias adicionales.', descriptionEn: 'Fjordur guardian; requires additional relics.', source: `${WIKI}/wiki/Dragon` }),
    boss({ slug: 'fenrisulfr', name: 'Fenrisúlfr', type: 'final', descriptionEs: 'Jefe final de Fjordur.', descriptionEn: 'Fjordur final boss.', source: `${WIKI}/wiki/Fenris%C3%BAlfr` }),
  ],
};

const map = ({ slug, name, game, type, canonical, orderEvolved, orderAscended, descriptionEs, descriptionEn, source, platformNotes = null }) => ({
  id: slug,
  slug,
  name,
  name_es: name,
  name_en: name,
  game,
  game_availability: game,
  map_type: type,
  is_canonical: canonical,
  release_order_evolved: orderEvolved,
  release_order_ascended: orderAscended,
  description_es: descriptionEs,
  description_en: descriptionEn,
  platform_notes: platformNotes,
  image_url: null,
  icon_url: null,
  source_url: source,
  source_name: source.includes('steampowered') ? 'Steam' : 'ARK Official Community Wiki',
  reviewed_at: REVIEWED_AT,
  content_status: 'published',
  bosses: slug === 'the-island' ? islandBosses : (catalogBosses[slug] || []),
});

export const mapBosses = [
  map({ slug: 'the-island', name: 'The Island', game: 'both', type: 'story', canonical: true, orderEvolved: 1, orderAscended: 1, descriptionEs: 'La ruta original de guardianes y ascensión.', descriptionEn: 'The original guardian and ascension route.', source: `${WIKI}/wiki/The_Island` }),
  map({ slug: 'the-center', name: 'The Center', game: 'both', type: 'official_mod', canonical: false, orderEvolved: 2, orderAscended: 3, descriptionEs: 'Mapa de expansión oficial no canónico con múltiples biomas.', descriptionEn: 'Official non-canonical expansion map with multiple biomes.', source: `${WIKI}/wiki/The_Center` }),
  map({ slug: 'scorched-earth', name: 'Scorched Earth', game: 'both', type: 'story', canonical: true, orderEvolved: 3, orderAscended: 2, descriptionEs: 'Supervivencia desértica y progresión hacia Manticore.', descriptionEn: 'Desert survival and progression toward Manticore.', source: `${WIKI}/wiki/Scorched_Earth` }),
  map({ slug: 'ragnarok', name: 'Ragnarok', game: 'both', type: 'official_mod', canonical: false, orderEvolved: 4, orderAscended: 7, descriptionEs: 'Expansión oficial no canónica de escala amplia.', descriptionEn: 'Large-scale official non-canonical expansion.', source: 'https://store.steampowered.com/app/3675020/ARK_Ragnarok_Ascended/' }),
  map({ slug: 'aberration', name: 'Aberration', game: 'both', type: 'story', canonical: true, orderEvolved: 5, orderAscended: 4, descriptionEs: 'ARK dañada con progresión subterránea hacia Rockwell.', descriptionEn: 'Damaged ARK with underground progression toward Rockwell.', source: `${WIKI}/wiki/Aberration` }),
  map({ slug: 'extinction', name: 'Extinction', game: 'both', type: 'story', canonical: true, orderEvolved: 6, orderAscended: 5, descriptionEs: 'Defensa orbital, titanes y cierre del arco terrestre.', descriptionEn: 'Orbital defense, titans, and the Earth story finale.', source: `${WIKI}/wiki/Extinction` }),
  map({ slug: 'valguero', name: 'Valguero', game: 'both', type: 'official_mod', canonical: false, orderEvolved: 7, orderAscended: 8, descriptionEs: 'Expansión oficial no canónica con arenas distintas entre ASE y ASA.', descriptionEn: 'Official non-canonical expansion with different ASE and ASA arenas.', source: `${WIKI}/wiki/Valguero` }),
  map({ slug: 'genesis-part-1', name: 'Genesis: Part 1', game: 'both', type: 'story', canonical: true, orderEvolved: 8, orderAscended: 9, descriptionEs: 'Simulación por biomas con misiones y ascensión.', descriptionEn: 'Biome simulation with missions and ascension.', source: `${WIKI}/wiki/Genesis_1` }),
  map({ slug: 'crystal-isles', name: 'Crystal Isles', game: 'evolved', type: 'official_mod', canonical: false, orderEvolved: 9, orderAscended: null, descriptionEs: 'Expansión oficial no canónica disponible en ASE.', descriptionEn: 'Official non-canonical expansion available in ASE.', source: `${WIKI}/wiki/Crystal_Isles` }),
  map({ slug: 'genesis-part-2', name: 'Genesis: Part 2', game: 'evolved', type: 'story', canonical: true, orderEvolved: 10, orderAscended: null, descriptionEs: 'Cierre de la saga Genesis en ASE.', descriptionEn: 'The Genesis saga finale in ASE.', source: `${WIKI}/wiki/Genesis_2` }),
  map({ slug: 'lost-island', name: 'Lost Island', game: 'evolved', type: 'official_mod', canonical: false, orderEvolved: 11, orderAscended: null, descriptionEs: 'Expansión oficial no canónica disponible en ASE.', descriptionEn: 'Official non-canonical expansion available in ASE.', source: `${WIKI}/wiki/Lost_Island` }),
  map({ slug: 'fjordur', name: 'Fjordur', game: 'evolved', type: 'official_mod', canonical: false, orderEvolved: 12, orderAscended: null, descriptionEs: 'Reinos nórdicos, mini-bosses, guardianes y Fenrisúlfr.', descriptionEn: 'Norse realms, mini-bosses, guardians, and Fenrisúlfr.', source: `${WIKI}/wiki/Fjordur` }),
  map({ slug: 'aquatica', name: 'Aquatica', game: 'evolved', type: 'anniversary', canonical: false, orderEvolved: 13, orderAscended: null, descriptionEs: 'DLC de aniversario no canónico centrado en exploración submarina.', descriptionEn: 'Non-canonical anniversary DLC focused on underwater exploration.', source: 'https://store.steampowered.com/app/3537070/ARK_Aquatica/', platformNotes: 'PC / Steam; contenido premium no canónico.' }),
  map({ slug: 'astraeos', name: 'Astraeos', game: 'ascended', type: 'premium', canonical: false, orderEvolved: null, orderAscended: 6, descriptionEs: 'Mapa premium no canónico inspirado en mitología griega.', descriptionEn: 'Premium non-canonical map inspired by Greek mythology.', source: 'https://store.steampowered.com/app/3483400/ARK_Astraeos/', platformNotes: 'Contenido premium de ARK: Survival Ascended.' }),
];

export const iniPresets = [
  {
    id: 'clean-visibility', slug: 'clean-visibility', title: 'Visibilidad limpia', title_es: 'Visibilidad limpia', title_en: 'Clean visibility',
    category: 'visibility', game: 'both', game_availability: 'both', file_target: 'Engine.ini',
    description_es: 'Reduce desenfoque, bloom y profundidad de campo para una lectura más estable.',
    description_en: 'Reduces blur, bloom, and depth of field for steadier visual reading.',
    content: '[SystemSettings]\nr.MotionBlurQuality=0\nr.DepthOfFieldQuality=0\nr.BloomQuality=0',
    risk_es: 'Puede cambiar la intención visual y algunos servidores o actualizaciones pueden ignorar estas variables.',
    risk_en: 'May change the intended look, and some servers or updates may ignore these variables.',
    rollback_es: 'Elimina estas líneas de Engine.ini y reinicia el juego.', rollback_en: 'Remove these lines from Engine.ini and restart the game.',
    verification_status: 'experimental', content_status: 'published', reviewed_at: REVIEWED_AT,
    source_url: `${WIKI}/wiki/Server_configuration`, source_name: 'ARK Official Community Wiki',
  },
  {
    id: 'asa-fps-balanced', slug: 'asa-fps-balanced', title: 'FPS equilibrado ASA', title_es: 'FPS equilibrado ASA', title_en: 'Balanced ASA FPS',
    category: 'fps', game: 'ascended', game_availability: 'ascended', file_target: 'Engine.ini',
    description_es: 'Punto de partida conservador para reducir efectos costosos sin ocultar toda la escena.',
    description_en: 'A conservative starting point that reduces expensive effects without stripping the whole scene.',
    content: '[SystemSettings]\nr.MotionBlurQuality=0\nr.Lumen.Reflections.Allow=0\nr.Nanite.MaxPixelsPerEdge=4',
    risk_es: 'El rendimiento varía por GPU y versión. Prueba cada línea por separado.', risk_en: 'Performance varies by GPU and version. Test each line separately.',
    rollback_es: 'Restaura una copia previa de Engine.ini.', rollback_en: 'Restore a previous Engine.ini backup.',
    verification_status: 'experimental', content_status: 'published', reviewed_at: REVIEWED_AT,
    source_url: `${WIKI}/wiki/Console_commands`, source_name: 'ARK Official Community Wiki',
  },
  {
    id: 'breeding-starter-server', slug: 'breeding-starter-server', title: 'Breeding inicial de servidor', title_es: 'Breeding inicial de servidor', title_en: 'Starter server breeding',
    category: 'breeding', game: 'both', game_availability: 'both', file_target: 'Game.ini',
    description_es: 'Ejemplo moderado para pruebas privadas de crianza; no es una recomendación competitiva.',
    description_en: 'Moderate example for private breeding tests; not a competitive recommendation.',
    content: '[/script/shootergame.shootergamemode]\nMatingIntervalMultiplier=0.5\nEggHatchSpeedMultiplier=5.0\nBabyMatureSpeedMultiplier=5.0',
    risk_es: 'Modificar rates afecta toda la progresión del servidor. Haz copia de seguridad.', risk_en: 'Changing rates affects the entire server progression. Back up first.',
    rollback_es: 'Restaura los multiplicadores anteriores o elimina las líneas y reinicia.', rollback_en: 'Restore previous multipliers or remove the lines and restart.',
    verification_status: 'pending', content_status: 'published', reviewed_at: REVIEWED_AT,
    source_url: `${WIKI}/wiki/Server_configuration`, source_name: 'ARK Official Community Wiki',
  },
];

export const creatures = [
  { id: 'rex', name: 'Rex', game: 'both', type: 'Terrestre', map: 'The Island', use: 'Boss', cooldown: '18-48 h', note: 'Base sólida para líneas de vida y daño.' },
  { id: 'therizinosaur', name: 'Therizinosaur', game: 'both', type: 'Terrestre', map: 'The Island', use: 'Boss', cooldown: '18-48 h', note: 'Versátil y compatible con curación vegetal.' },
  { id: 'argentavis', name: 'Argentavis', game: 'both', type: 'Volador', map: 'The Island', use: 'Farmeo', cooldown: '18-48 h', note: 'Transporte fiable para rutas de metal.' },
  { id: 'rock-drake', name: 'Rock Drake', game: 'both', type: 'Especial', map: 'Aberration', use: 'Exploración', cooldown: 'Sin reproducción vanilla ASE', note: 'Movilidad vertical y camuflaje.' },
  { id: 'carcharodontosaurus', name: 'Carcharodontosaurus', game: 'both', type: 'Terrestre', map: 'The Island', use: 'PvP', cooldown: '18-48 h', note: 'Presión sostenida cuando mantiene ritmo.' },
  { id: 'deinosuchus', name: 'Deinosuchus', game: 'ascended', type: 'Acuático', map: 'The Center', use: 'PvP', cooldown: 'Verificar según versión', note: 'Emboscada anfibia y alto daño cargado.' },
  { id: 'managarmr', name: 'Managarmr', game: 'evolved', type: 'Especial', map: 'Extinction', use: 'Movilidad', cooldown: '18-48 h', note: 'Control de distancia y desplazamiento rápido.' },
  { id: 'basilosaurus', name: 'Basilosaurus', game: 'both', type: 'Acuático', map: 'The Island', use: 'Exploración', cooldown: '18-48 h', note: 'Resistencia para rutas oceánicas profundas.' },
];
