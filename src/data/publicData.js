const REVIEWED_AT = '2026-07-22';
const REVIEWED_AT_PHASE_C = '2026-08-11';
const WIKI = 'https://ark.wiki.gg';

const requirementItem = (id, nameEs, nameEn, quantity) => ({ id, name_es: nameEs, name_en: nameEn, quantity });
const requirement = ({ level, artifacts = [], tributes = [], source, reviewedAt = REVIEWED_AT, notesEs, notesEn }) => ({
  min_player_level: level,
  max_players: 10,
  artifacts,
  tributes,
  unlocks: [],
  notes_es: notesEs || 'Verifica multiplicadores, mods y reglas específicas de tu servidor antes de abrir la arena.',
  notes_en: notesEn || 'Check your server multipliers, mods, and specific rules before opening the arena.',
  source_url: source,
  source_name: 'ARK Official Community Wiki',
  reviewed_at: reviewedAt,
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

const artifactNames = {
  'artifact-clever': ['Artefacto del Astuto', 'Artifact of the Clever'],
  'artifact-hunter': ['Artefacto del Cazador', 'Artifact of the Hunter'],
  'artifact-massive': ['Artefacto del Colosal', 'Artifact of the Massive'],
  'artifact-brute': ['Artefacto del Bruto', 'Artifact of the Brute'],
  'artifact-devourer': ['Artefacto del Devorador', 'Artifact of the Devourer'],
  'artifact-pack': ['Artefacto de la Manada', 'Artifact of the Pack'],
  'artifact-cunning': ['Artefacto de la Astucia', 'Artifact of the Cunning'],
  'artifact-immune': ['Artefacto de la Inmunidad', 'Artifact of the Immune'],
  'artifact-skylord': ['Artefacto del Señor del Cielo', 'Artifact of the Skylord'],
  'artifact-strong': ['Artefacto del Fuerte', 'Artifact of the Strong'],
  'artifact-devious': ['Artefacto del Pérfido', 'Artifact of the Devious'],
  'artifact-depths': ['Artefacto de las Profundidades', 'Artifact of the Depths'],
  'artifact-shadows': ['Artefacto de las Sombras', 'Artifact of the Shadows'],
  'artifact-stalker': ['Artefacto del Acechador', 'Artifact of the Stalker'],
  'artifact-lost': ['Artefacto de los Perdidos', 'Artifact of the Lost'],
  'artifact-gatekeeper': ['Artefacto del Guardián', 'Artifact of the Gatekeeper'],
  'artifact-crag': ['Artefacto del Peñasco', 'Artifact of the Crag'],
  'artifact-destroyer': ['Artefacto del Destructor', 'Artifact of the Destroyer'],
  'artifact-mighty': ['Artefacto del Poderoso', 'Artifact of the Mighty'],
  'artifact-fallen': ['Artefacto del Caído', 'Artifact of the Fallen'],
  'artifact-seeking': ['Artefacto del Buscador', 'Artifact of the Seeking'],
  'artifact-chaos': ['Artefacto del Caos', 'Artifact of Chaos'],
  'artifact-growth': ['Artefacto del Crecimiento', 'Artifact of Growth'],
  'artifact-void': ['Artefacto del Vacío', 'Artifact of the Void'],
};
const artifacts = (...ids) => ids.map((id) => requirementItem(id, artifactNames[id][0], artifactNames[id][1], 1));

const tributeNames = {
  'argentavis-talon': ['Garra de Argentavis', 'Argentavis Talon'],
  'sarcosuchus-skin': ['Piel de Sarcosuchus', 'Sarcosuchus Skin'],
  'sauropod-vertebra': ['Vértebra de saurópodo', 'Sauropod Vertebra'],
  'titanoboa-venom': ['Veneno de Titanoboa', 'Titanoboa Venom'],
  'megalania-toxin': ['Toxina de Megalania', 'Megalania Toxin'],
  'megalodon-tooth': ['Diente de Megalodon', 'Megalodon Tooth'],
  'spinosaurus-sail': ['Vela de Spinosaurus', 'Spinosaurus Sail'],
  'therizino-claws': ['Garras de Therizinosaur', 'Therizino Claws'],
  'thylacoleo-hook-claw': ['Garra de Thylacoleo', 'Thylacoleo Hook-Claw'],
  'allosaurus-brain': ['Cerebro de Allosaurus', 'Allosaurus Brain'],
  'giganotosaurus-heart': ['Corazón de Giganotosaurus', 'Giganotosaurus Heart'],
  'tusoteuthis-tentacle': ['Tentáculo de Tusoteuthis', 'Tusoteuthis Tentacle'],
  'tyrannosaurus-arm': ['Brazo de Tyrannosaurus', 'Tyrannosaurus Arm'],
  'yutyrannus-lungs': ['Pulmones de Yutyrannus', 'Yutyrannus Lungs'],
  'basilisk-scale': ['Escama de Basilisco', 'Basilisk Scale'],
  'primal-crystal': ['Cristal Primordial', 'Primal Crystal'],
  'crystal-talon': ['Garra de Cristal', 'Crystal Talon'],
  'alpha-crystal-talon': ['Garra de Cristal Alfa', 'Alpha Crystal Talon'],
  'basilosaurus-blubber': ['Grasa de Basilosaurus', 'Basilosaurus Blubber'],
  'alpha-ossidon-skull': ['Cráneo de Ossidon Alfa', 'Alpha Ossidon Skull'],
  'alpha-zombie-brains': ['Cerebros de Zombi Alfa', 'Alpha Zombie Brains'],
  'neophyte-horns': ['Cuernos de Neófito', 'Neophyte Horns'],
  'minor-aberrant-sigil': ['Sello Aberrante Menor', 'Minor Aberrant Sigil'],
  'minor-crimson-sigil': ['Sello Carmesí Menor', 'Minor Crimson Sigil'],
  'greater-aberrant-sigil': ['Sello Aberrante Mayor', 'Greater Aberrant Sigil'],
  'greater-crimson-sigil': ['Sello Carmesí Mayor', 'Greater Crimson Sigil'],
  'prime-aberrant-sigil': ['Sello Aberrante Supremo', 'Prime Aberrant Sigil'],
  'prime-crimson-sigil': ['Sello Carmesí Supremo', 'Prime Crimson Sigil'],
  'onchopristis-blade': ['Hoja de Onchopristis', 'Onchopristis Blade'],
  'monodon-horn': ['Cuerno de Monodon', 'Monodon Horn'],
  'water-talon': ['Garra de Agua', 'Water Talon'],
  'alpha-water-talon': ['Garra de Agua Alfa', 'Alpha Water Talon'],
  'alpha-mosasaur-tooth': ['Diente de Mosasaur Alfa', 'Alpha Mosasaur Tooth'],
  'alpha-megalodon-fin': ['Aleta de Megalodon Alfa', 'Alpha Megalodon Fin'],
  'alpha-karkinos-claw': ['Garra de Karkinos Alfa', 'Alpha Karkinos Claw'],
  'alpha-tusoteuthis-eye': ['Ojo de Tusoteuthis Alfa', 'Alpha Tusoteuthis Eye'],
  'alpha-tyrannosaur-tooth': ['Diente de Tyrannosaur Alfa', 'Alpha Tyrannosaur Tooth'],
  'corrupt-heart': ['Corazón Corrupto', 'Corrupt Heart'],
  'corrupted-nodule': ['Nódulo Corrupto', 'Corrupted Nodule'],
  'lightning-talon': ['Garra de Rayo', 'Lightning Talon'],
  'fire-talon': ['Garra de Fuego', 'Fire Talon'],
  'poison-talon': ['Garra de Veneno', 'Poison Talon'],
  'runestone': ['Runestone', 'Runestone'],
  'beyla-relic': ['Reliquia de Beyla', 'Beyla Relic'],
  'hati-relic': ['Reliquia de Hati', 'Hati Relic'],
  'skoll-relic': ['Reliquia de Sköll', 'Sköll Relic'],
  'steinbjorn-relic': ['Reliquia de Steinbjörn', 'Steinbjörn Relic'],
  'nameless-venom': ['Veneno de Nameless', 'Nameless Venom'],
  'reaper-pheromone-gland': ['Glándula de Feromonas de Reaper', 'Reaper Pheromone Gland'],
  'rock-drake-feather': ['Pluma de Rock Drake', 'Rock Drake Feather'],
  'alpha-basilisk-fang': ['Colmillo de Basilisco Alfa', 'Alpha Basilisk Fang'],
  'alpha-reaper-king-barb': ['Púa de Reaper King Alfa', 'Alpha Reaper King Barb'],
  'desert-titan-trophy': ['Trofeo del Titán del Desierto', 'Desert Titan Trophy'],
  'forest-titan-trophy': ['Trofeo del Titán del Bosque', 'Forest Titan Trophy'],
  'ice-titan-trophy': ['Trofeo del Titán del Hielo', 'Ice Titan Trophy'],
  'king-titan-trophy-gamma': ['Trofeo Gamma del King Titan', 'King Titan Trophy (Gamma)'],
  'king-titan-trophy-beta': ['Trofeo Beta del King Titan', 'King Titan Trophy (Beta)'],
  'gamma-cymathoa-trophy': ['Trofeo Gamma de Cymathoa', 'Gamma Cymathoa Trophy'],
  'beta-cymathoa-trophy': ['Trofeo Beta de Cymathoa', 'Beta Cymathoa Trophy'],
  'alpha-cymathoa-trophy': ['Trofeo Alfa de Cymathoa', 'Alpha Cymathoa Trophy'],
  'gamma-fractalis-trophy': ['Trofeo Gamma de Fractalis', 'Gamma Fractalis Trophy'],
  'beta-fractalis-trophy': ['Trofeo Beta de Fractalis', 'Beta Fractalis Trophy'],
  'alpha-fractalis-trophy': ['Trofeo Alfa de Fractalis', 'Alpha Fractalis Trophy'],
  'gamma-vulcanithys-trophy': ['Trofeo Gamma de Vulcanithys', 'Gamma Vulcanithys Trophy'],
  'beta-vulcanithys-trophy': ['Trofeo Beta de Vulcanithys', 'Beta Vulcanithys Trophy'],
  'alpha-vulcanithys-trophy': ['Trofeo Alfa de Vulcanithys', 'Alpha Vulcanithys Trophy'],
  'gamma-broodmother-trophy': ['Trofeo Gamma de Broodmother', 'Gamma Broodmother Trophy'],
  'beta-broodmother-trophy': ['Trofeo Beta de Broodmother', 'Beta Broodmother Trophy'],
  'alpha-broodmother-trophy': ['Trofeo Alfa de Broodmother', 'Alpha Broodmother Trophy'],
  'gamma-megapithecus-trophy': ['Trofeo Gamma de Megapithecus', 'Gamma Megapithecus Trophy'],
  'beta-megapithecus-trophy': ['Trofeo Beta de Megapithecus', 'Beta Megapithecus Trophy'],
  'alpha-megapithecus-trophy': ['Trofeo Alfa de Megapithecus', 'Alpha Megapithecus Trophy'],
  'gamma-dragon-trophy': ['Trofeo Gamma de Dragon', 'Gamma Dragon Trophy'],
  'beta-dragon-trophy': ['Trofeo Beta de Dragon', 'Beta Dragon Trophy'],
  'alpha-dragon-trophy': ['Trofeo Alfa de Dragon', 'Alpha Dragon Trophy'],
};
const tribute = (id, quantity) => requirementItem(id, tributeNames[id][0], tributeNames[id][1], quantity);
const tributes = (entries) => entries.map(([id, quantity]) => tribute(id, quantity));

const boss = ({ slug, name, nameEs = name, nameEn = name, type = 'main', game = 'both', descriptionEs, descriptionEn, requirements = {}, source, reviewedAt = REVIEWED_AT }) => ({
  id: slug,
  slug,
  name,
  name_es: nameEs,
  name_en: nameEn,
  boss_type: type,
  game_availability: game,
  description_es: descriptionEs,
  description_en: descriptionEn,
  image_url: null,
  source_url: source,
  source_name: 'ARK Official Community Wiki',
  reviewed_at: reviewedAt,
  content_status: 'published',
  requirements,
});

const crystalWyvernQueen = boss({
  slug: 'crystal-wyvern-queen', name: 'Crystal Wyvern Queen', type: 'final', game: 'evolved', reviewedAt: REVIEWED_AT_PHASE_C,
  descriptionEs: 'Guardiana final de Crystal Isles; tres dificultades con tributos verificados.',
  descriptionEn: 'Crystal Isles final guardian; three verified tribute difficulties.',
  source: `${WIKI}/wiki/Crystal_Wyvern_Queen`,
  requirements: {
    gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Crystal_Wyvern_Queen`, artifacts: artifacts('artifact-massive', 'artifact-devious', 'artifact-skylord', 'artifact-immune', 'artifact-brute'), tributes: tributes([['primal-crystal', 10], ['crystal-talon', 5], ['alpha-crystal-talon', 1]]) }),
    beta: requirement({ level: 75, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Crystal_Wyvern_Queen`, artifacts: artifacts('artifact-depths', 'artifact-hunter', 'artifact-clever', 'artifact-devourer', 'artifact-strong', 'artifact-cunning'), tributes: tributes([['primal-crystal', 20], ['crystal-talon', 10], ['alpha-crystal-talon', 3]]) }),
    alpha: requirement({ level: 100, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Crystal_Wyvern_Queen`, artifacts: artifacts('artifact-pack', 'artifact-shadows', 'artifact-stalker', 'artifact-lost', 'artifact-gatekeeper', 'artifact-crag', 'artifact-destroyer'), tributes: tributes([['primal-crystal', 30], ['crystal-talon', 15], ['alpha-crystal-talon', 5]]) }),
  },
});

const dinopithecusKing = boss({
  slug: 'dinopithecus-king', name: 'Dinopithecus King', type: 'final', game: 'evolved', reviewedAt: REVIEWED_AT_PHASE_C,
  descriptionEs: 'Jefe final de Lost Island; tres dificultades con tributos verificados.',
  descriptionEn: 'Lost Island final boss; three verified tribute difficulties.',
  source: `${WIKI}/wiki/Dinopithecus_King`,
  requirements: {
    gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Dinopithecus_King`, artifacts: artifacts('artifact-cunning', 'artifact-hunter', 'artifact-pack', 'artifact-skylord'), tributes: tributes([['allosaurus-brain', 3], ['argentavis-talon', 5], ['sarcosuchus-skin', 5], ['therizino-claws', 3], ['titanoboa-venom', 5]]) }),
    beta: requirement({ level: 75, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Dinopithecus_King`, artifacts: artifacts('artifact-hunter', 'artifact-brute', 'artifact-immune', 'artifact-strong'), tributes: tributes([['basilisk-scale', 2], ['megalodon-tooth', 5], ['sauropod-vertebra', 5], ['spinosaurus-sail', 2], ['thylacoleo-hook-claw', 5], ['therizino-claws', 5]]) }),
    alpha: requirement({ level: 100, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Dinopithecus_King`, artifacts: artifacts('artifact-devious', 'artifact-devourer', 'artifact-massive', 'artifact-hunter'), tributes: tributes([['basilisk-scale', 2], ['giganotosaurus-heart', 1], ['megalania-toxin', 10], ['megalodon-tooth', 10], ['spinosaurus-sail', 2], ['therizino-claws', 5], ['tusoteuthis-tentacle', 2], ['tyrannosaurus-arm', 5], ['yutyrannus-lungs', 2]]) }),
  },
});

const centerArenaItems = [
  ['argentavis-talon', 10], ['basilosaurus-blubber', 10], ['megalania-toxin', 10], ['megalodon-tooth', 10],
  ['sarcosuchus-skin', 10], ['sauropod-vertebra', 10], ['spinosaurus-sail', 10], ['thylacoleo-hook-claw', 10],
  ['titanoboa-venom', 10], ['tusoteuthis-tentacle', 10],
];
const centerArenaRequirements = {
  gamma: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/The_Center_Arena_(The_Center)`, artifacts: artifacts('artifact-brute', 'artifact-clever', 'artifact-devourer', 'artifact-hunter', 'artifact-massive', 'artifact-pack') }),
  beta: requirement({ level: 80, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/The_Center_Arena_(The_Center)`, artifacts: artifacts('artifact-brute', 'artifact-clever', 'artifact-devourer', 'artifact-hunter', 'artifact-massive', 'artifact-pack'), tributes: tributes(centerArenaItems) }),
  alpha: requirement({ level: 90, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/The_Center_Arena_(The_Center)`, artifacts: artifacts('artifact-brute', 'artifact-clever', 'artifact-devourer', 'artifact-hunter', 'artifact-massive', 'artifact-pack'), tributes: tributes(centerArenaItems.map(([id, qty]) => [id, qty * 2.5])) }),
};

const ragnarokArenaRequirements = {
  gamma: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Ragnarok_Arena_(Ragnarok)`, artifacts: artifacts('artifact-clever', 'artifact-cunning', 'artifact-devious', 'artifact-devourer', 'artifact-hunter', 'artifact-immune', 'artifact-massive', 'artifact-pack', 'artifact-skylord', 'artifact-strong') }),
  beta: requirement({ level: 80, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Ragnarok_Arena_(Ragnarok)`, artifacts: artifacts('artifact-clever', 'artifact-cunning', 'artifact-devious', 'artifact-devourer', 'artifact-hunter', 'artifact-immune', 'artifact-massive', 'artifact-pack', 'artifact-skylord', 'artifact-strong'), tributes: tributes(centerArenaItems) }),
  alpha: requirement({ level: 90, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Ragnarok_Arena_(Ragnarok)`, artifacts: artifacts('artifact-clever', 'artifact-cunning', 'artifact-devious', 'artifact-devourer', 'artifact-hunter', 'artifact-immune', 'artifact-massive', 'artifact-pack', 'artifact-skylord', 'artifact-strong'), tributes: tributes(centerArenaItems.map(([id, qty]) => [id, qty * 2.5])) }),
};

const nunatakArtifacts = artifacts('artifact-clever', 'artifact-cunning', 'artifact-devious', 'artifact-devourer', 'artifact-hunter', 'artifact-immune', 'artifact-massive', 'artifact-pack', 'artifact-skylord', 'artifact-strong');
const nunatakTributeItems = [
  ['argentavis-talon', 10], ['basilosaurus-blubber', 5], ['megalania-toxin', 10], ['megalodon-tooth', 10],
  ['sarcosuchus-skin', 10], ['sauropod-vertebra', 10], ['spinosaurus-sail', 10], ['thylacoleo-hook-claw', 10],
  ['titanoboa-venom', 10], ['tusoteuthis-tentacle', 10],
];
const nunatakAlphaTributes = [
  ['argentavis-talon', 25], ['basilosaurus-blubber', 10], ['megalania-toxin', 25], ['megalodon-tooth', 25],
  ['sarcosuchus-skin', 25], ['sauropod-vertebra', 25], ['spinosaurus-sail', 25], ['thylacoleo-hook-claw', 25],
  ['titanoboa-venom', 25], ['tusoteuthis-tentacle', 25],
];
const nunatakRequirements = {
  gamma: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Nunatak`, artifacts: nunatakArtifacts }),
  beta: requirement({ level: 80, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Nunatak`, artifacts: nunatakArtifacts, tributes: tributes(nunatakTributeItems) }),
  alpha: requirement({ level: 90, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Nunatak`, artifacts: nunatakArtifacts, tributes: tributes(nunatakAlphaTributes) }),
};

const valgueroTributeItems = {
  gamma: [['allosaurus-brain', 5], ['argentavis-talon', 5], ['sauropod-vertebra', 5], ['sarcosuchus-skin', 5], ['titanoboa-venom', 5]],
  beta: [['allosaurus-brain', 10], ['argentavis-talon', 8], ['sauropod-vertebra', 8], ['sarcosuchus-skin', 8], ['titanoboa-venom', 5], ['tyrannosaurus-arm', 10]],
  alpha: [['allosaurus-brain', 15], ['argentavis-talon', 15], ['giganotosaurus-heart', 2], ['sarcosuchus-skin', 10], ['titanoboa-venom', 10], ['tyrannosaurus-arm', 15]],
};
const valgueroArtifacts = {
  gamma: artifacts('artifact-devourer', 'artifact-pack', 'artifact-skylord'),
  beta: artifacts('artifact-cunning', 'artifact-immune', 'artifact-strong'),
  alpha: artifacts('artifact-brute', 'artifact-crag', 'artifact-destroyer', 'artifact-gatekeeper'),
};

const valgueroArenaRequirements = {
  gamma: requirement({ level: 30, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Valguero_Arena_(Valguero)`, artifacts: valgueroArtifacts.gamma, tributes: tributes(valgueroTributeItems.gamma) }),
  beta: requirement({ level: 50, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Valguero_Arena_(Valguero)`, artifacts: valgueroArtifacts.beta, tributes: tributes(valgueroTributeItems.beta) }),
  alpha: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Valguero_Arena_(Valguero)`, artifacts: valgueroArtifacts.alpha, tributes: tributes(valgueroTributeItems.alpha) }),
};

const grendelRequirements = {
  gamma: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Grendel`, artifacts: valgueroArtifacts.gamma, tributes: tributes(valgueroTributeItems.gamma) }),
  beta: requirement({ level: 80, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Grendel`, artifacts: valgueroArtifacts.beta, tributes: tributes(valgueroTributeItems.beta) }),
  alpha: requirement({ level: 90, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Grendel`, artifacts: valgueroArtifacts.alpha, tributes: tributes(valgueroTributeItems.alpha) }),
};

const redHandedRequirements = {
  gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Red-Handed_(Lost_Colony)`, tributes: tributes([['alpha-zombie-brains', 1], ['neophyte-horns', 5], ['minor-aberrant-sigil', 100], ['minor-crimson-sigil', 100]]) }),
  beta: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Red-Handed_(Lost_Colony)`, tributes: tributes([['alpha-ossidon-skull', 1], ['alpha-zombie-brains', 5], ['neophyte-horns', 10], ['greater-aberrant-sigil', 150], ['greater-crimson-sigil', 150]]) }),
  alpha: requirement({ level: 95, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Red-Handed_(Lost_Colony)`, tributes: tributes([['alpha-ossidon-skull', 5], ['alpha-zombie-brains', 10], ['neophyte-horns', 15], ['prime-aberrant-sigil', 200], ['prime-crimson-sigil', 200]]) }),
};

const natrixArtifacts = artifacts('artifact-clever', 'artifact-hunter', 'artifact-massive');
const natrixTributeItems = {
  beta: [['argentavis-talon', 5], ['sarcosuchus-skin', 5], ['sauropod-vertebra', 5], ['titanoboa-venom', 5]],
  alpha: [['argentavis-talon', 10], ['sarcosuchus-skin', 10], ['sauropod-vertebra', 10], ['titanoboa-venom', 10]],
};
const natrixRequirements = {
  gamma: requirement({ level: 30, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Natrix`, artifacts: natrixArtifacts }),
  beta: requirement({ level: 50, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Natrix`, artifacts: natrixArtifacts, tributes: tributes(natrixTributeItems.beta) }),
  alpha: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Natrix`, artifacts: natrixArtifacts, tributes: tributes(natrixTributeItems.alpha) }),
};

const thodesArtifacts = artifacts('artifact-brute', 'artifact-pack', 'artifact-devourer');
const thodesTributeItems = {
  beta: [['megalodon-tooth', 5], ['megalania-toxin', 5], ['spinosaurus-sail', 5], ['therizino-claws', 5], ['thylacoleo-hook-claw', 5]],
  alpha: [['megalodon-tooth', 10], ['megalania-toxin', 10], ['spinosaurus-sail', 10], ['therizino-claws', 10], ['thylacoleo-hook-claw', 10]],
};
const thodesRequirements = {
  gamma: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Thodes`, artifacts: thodesArtifacts, notesEs: 'Nivel de jugador no publicado por la fuente (marcado como "?"); artefactos y tributos verificados.', notesEn: 'Player level not published by the source (marked as "?"); artifacts and tributes verified.' }),
  beta: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Thodes`, artifacts: thodesArtifacts, tributes: tributes(thodesTributeItems.beta), notesEs: 'Nivel de jugador no publicado por la fuente (marcado como "?"); artefactos y tributos verificados.', notesEn: 'Player level not published by the source (marked as "?"); artifacts and tributes verified.' }),
  alpha: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Thodes`, artifacts: thodesArtifacts, tributes: tributes(thodesTributeItems.alpha), notesEs: 'Nivel de jugador no publicado por la fuente (marcado como "?"); artefactos y tributos verificados.', notesEn: 'Player level not published by the source (marked as "?"); artifacts and tributes verified.' }),
};

const hydraskosArtifacts = artifacts('artifact-cunning', 'artifact-immune', 'artifact-skylord', 'artifact-strong');
const hydraskosTributeItems = {
  beta: [['allosaurus-brain', 5], ['basilosaurus-blubber', 5], ['giganotosaurus-heart', 1], ['tusoteuthis-tentacle', 5], ['tyrannosaurus-arm', 5], ['yutyrannus-lungs', 5]],
  alpha: [['allosaurus-brain', 10], ['basilosaurus-blubber', 10], ['giganotosaurus-heart', 2], ['tusoteuthis-tentacle', 10], ['tyrannosaurus-arm', 15], ['yutyrannus-lungs', 10]],
};
const hydraskosRequirements = {
  gamma: requirement({ level: 90, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Hydraskos`, artifacts: hydraskosArtifacts }),
  beta: requirement({ level: 90, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Hydraskos`, artifacts: hydraskosArtifacts, tributes: tributes(hydraskosTributeItems.beta) }),
  alpha: requirement({ level: 90, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Hydraskos`, artifacts: hydraskosArtifacts, tributes: tributes(hydraskosTributeItems.alpha) }),
};

const cymathoaRequirements = {
  gamma: requirement({ level: 45, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Cymathoa`, artifacts: artifacts('artifact-mighty'), tributes: tributes([['onchopristis-blade', 1], ['sarcosuchus-skin', 1]]) }),
  beta: requirement({ level: 65, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Cymathoa`, artifacts: artifacts('artifact-mighty'), tributes: tributes([['onchopristis-blade', 5], ['sarcosuchus-skin', 5], ['spinosaurus-sail', 5], ['megalodon-tooth', 5]]) }),
  alpha: requirement({ level: 85, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Cymathoa`, artifacts: artifacts('artifact-mighty'), tributes: tributes([['onchopristis-blade', 10], ['sarcosuchus-skin', 10], ['spinosaurus-sail', 10], ['megalodon-tooth', 10], ['alpha-mosasaur-tooth', 1]]) }),
};

const fractalisRequirements = {
  gamma: requirement({ level: 10, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Fractalis`, artifacts: artifacts('artifact-fallen'), tributes: tributes([['monodon-horn', 1], ['sauropod-vertebra', 1]]) }),
  beta: requirement({ level: 50, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Fractalis`, artifacts: artifacts('artifact-fallen'), tributes: tributes([['monodon-horn', 5], ['sauropod-vertebra', 5], ['basilosaurus-blubber', 5]]) }),
  alpha: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Fractalis`, artifacts: artifacts('artifact-fallen'), tributes: tributes([['monodon-horn', 10], ['sauropod-vertebra', 10], ['basilosaurus-blubber', 10], ['alpha-megalodon-fin', 1]]) }),
};

const vulcanithysRequirements = {
  gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Vulcanithys`, artifacts: artifacts('artifact-seeking'), tributes: tributes([['monodon-horn', 1], ['water-talon', 1]]) }),
  beta: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Vulcanithys`, artifacts: artifacts('artifact-seeking'), tributes: tributes([['monodon-horn', 5], ['water-talon', 5], ['therizino-claws', 5], ['tusoteuthis-tentacle', 5], ['tyrannosaurus-arm', 5]]) }),
  alpha: requirement({ level: 95, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Vulcanithys`, artifacts: artifacts('artifact-seeking'), tributes: tributes([['monodon-horn', 10], ['water-talon', 10], ['therizino-claws', 10], ['tusoteuthis-tentacle', 10], ['tyrannosaurus-arm', 10], ['alpha-water-talon', 1]]) }),
};

const pygocentrusRequirements = {
  gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Pygocentrus`, tributes: tributes([['gamma-cymathoa-trophy', 1], ['gamma-fractalis-trophy', 1], ['gamma-vulcanithys-trophy', 1]]) }),
  beta: requirement({ level: 75, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Pygocentrus`, tributes: tributes([['beta-cymathoa-trophy', 1], ['beta-fractalis-trophy', 1], ['beta-vulcanithys-trophy', 1], ['megalania-toxin', 5], ['thylacoleo-hook-claw', 5], ['yutyrannus-lungs', 5]]) }),
  alpha: requirement({ level: 100, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Pygocentrus`, tributes: tributes([['alpha-cymathoa-trophy', 1], ['alpha-fractalis-trophy', 1], ['alpha-vulcanithys-trophy', 1], ['megalania-toxin', 10], ['thylacoleo-hook-claw', 10], ['yutyrannus-lungs', 10], ['alpha-karkinos-claw', 1], ['alpha-tusoteuthis-eye', 1], ['alpha-tyrannosaur-tooth', 1]]) }),
};

const minotarchosRequirements = {
  gamma: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Minotarchos`, tributes: tributes([['corrupt-heart', 2], ['corrupted-nodule', 25], ['lightning-talon', 5], ['megalodon-tooth', 25], ['thylacoleo-hook-claw', 10]]) }),
};

const erymanthianRequirements = {
  gamma: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Erymanthian_%26_Kalydonios`, tributes: tributes([['corrupt-heart', 2], ['corrupted-nodule', 25], ['fire-talon', 5], ['poison-talon', 5], ['therizino-claws', 10]]) }),
};

const desertTitanRequirements = {
  gamma: requirement({ level: 1, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Desert_Titan`, artifacts: artifacts('artifact-chaos'), tributes: tributes([['corrupt-heart', 100], ['fire-talon', 10], ['sarcosuchus-skin', 10]]) }),
};

const forestTitanRequirements = {
  gamma: requirement({ level: 1, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Forest_Titan`, artifacts: artifacts('artifact-growth'), tributes: tributes([['corrupt-heart', 100], ['sauropod-vertebra', 10], ['tyrannosaurus-arm', 10]]) }),
};

const iceTitanRequirements = {
  gamma: requirement({ level: 1, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Ice_Titan`, artifacts: artifacts('artifact-void'), tributes: tributes([['corrupt-heart', 100], ['spinosaurus-sail', 10], ['therizino-claws', 10]]) }),
};

const kingTitanRequirements = {
  gamma: requirement({ level: 1, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/King_Titan_Arena_(Extinction)`, tributes: tributes([['alpha-tyrannosaur-tooth', 5], ['corrupt-heart', 150], ['titanoboa-venom', 10], ['desert-titan-trophy', 1], ['forest-titan-trophy', 1], ['ice-titan-trophy', 1]]) }),
  beta: requirement({ level: 1, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/King_Titan_Arena_(Extinction)`, tributes: tributes([['alpha-tyrannosaur-tooth', 10], ['corrupt-heart', 300], ['titanoboa-venom', 20], ['desert-titan-trophy', 1], ['forest-titan-trophy', 1], ['ice-titan-trophy', 1], ['king-titan-trophy-gamma', 1]]) }),
  alpha: requirement({ level: 1, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/King_Titan_Arena_(Extinction)`, tributes: tributes([['alpha-tyrannosaur-tooth', 10], ['corrupt-heart', 300], ['giganotosaurus-heart', 20], ['spinosaurus-sail', 20], ['titanoboa-venom', 20], ['desert-titan-trophy', 1], ['forest-titan-trophy', 1], ['ice-titan-trophy', 1], ['king-titan-trophy-beta', 1]]) }),
};

const corruptedMasterControllerRequirements = {
  gamma: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Corrupted_Master_Controller`, notesEs: 'El superviviente que inicia The Final Test debe haber completado al menos 58 misiones.', notesEn: 'The survivor starting The Final Test must have completed at least 58 missions.' }),
  beta: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Corrupted_Master_Controller`, notesEs: 'El superviviente que inicia The Final Test debe haber completado al menos 116 misiones.', notesEn: 'The survivor starting The Final Test must have completed at least 116 missions.' }),
  alpha: requirement({ level: null, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Corrupted_Master_Controller`, notesEs: 'El superviviente que inicia The Final Test debe haber completado al menos 168 misiones.', notesEn: 'The survivor starting The Final Test must have completed at least 168 missions.' }),
};

const beylaRequirements = {
  gamma: requirement({ level: 50, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Beyla`, tributes: tributes([['runestone', 30]]) }),
};

const hatiSkollRequirements = {
  gamma: requirement({ level: 50, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Hati_and_Sk%C3%B6ll`, tributes: tributes([['runestone', 30]]) }),
};

const steinbjornRequirements = {
  gamma: requirement({ level: 50, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Steinbj%C3%B6rn`, tributes: tributes([['runestone', 30]]) }),
};

const fjordurBroodmotherRequirements = {
  gamma: requirement({ level: 30, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Broodmother_Lysrix`, artifacts: artifacts('artifact-clever', 'artifact-hunter', 'artifact-massive'), tributes: tributes([['beyla-relic', 1]]) }),
  beta: requirement({ level: 50, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Broodmother_Lysrix`, artifacts: artifacts('artifact-clever', 'artifact-hunter', 'artifact-massive'), tributes: tributes([['beyla-relic', 1], ['argentavis-talon', 5], ['sarcosuchus-skin', 5], ['sauropod-vertebra', 5], ['titanoboa-venom', 5]]) }),
  alpha: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Broodmother_Lysrix`, artifacts: artifacts('artifact-clever', 'artifact-hunter', 'artifact-massive'), tributes: tributes([['beyla-relic', 1], ['argentavis-talon', 10], ['sarcosuchus-skin', 10], ['sauropod-vertebra', 10], ['titanoboa-venom', 10]]) }),
};

const fjordurMegapithecusRequirements = {
  gamma: requirement({ level: 45, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Megapithecus`, artifacts: artifacts('artifact-brute', 'artifact-devourer', 'artifact-pack'), tributes: tributes([['steinbjorn-relic', 1]]) }),
  beta: requirement({ level: 65, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Megapithecus`, artifacts: artifacts('artifact-brute', 'artifact-devourer', 'artifact-pack'), tributes: tributes([['steinbjorn-relic', 1], ['megalania-toxin', 5], ['megalodon-tooth', 5], ['spinosaurus-sail', 5], ['therizino-claws', 5], ['thylacoleo-hook-claw', 5]]) }),
  alpha: requirement({ level: 85, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Megapithecus`, artifacts: artifacts('artifact-brute', 'artifact-devourer', 'artifact-pack'), tributes: tributes([['steinbjorn-relic', 1], ['megalania-toxin', 10], ['megalodon-tooth', 10], ['spinosaurus-sail', 10], ['therizino-claws', 10], ['thylacoleo-hook-claw', 10]]) }),
};

const fjordurDragonRequirements = {
  gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Dragon`, artifacts: artifacts('artifact-cunning', 'artifact-immune', 'artifact-skylord', 'artifact-strong'), tributes: tributes([['hati-relic', 1], ['skoll-relic', 1]]) }),
  beta: requirement({ level: 75, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Dragon`, artifacts: artifacts('artifact-cunning', 'artifact-immune', 'artifact-skylord', 'artifact-strong'), tributes: tributes([['hati-relic', 1], ['skoll-relic', 1], ['allosaurus-brain', 5], ['basilosaurus-blubber', 5], ['tusoteuthis-tentacle', 5], ['yutyrannus-lungs', 5], ['giganotosaurus-heart', 1], ['tyrannosaurus-arm', 5]]) }),
  alpha: requirement({ level: 100, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Dragon`, artifacts: artifacts('artifact-cunning', 'artifact-immune', 'artifact-skylord', 'artifact-strong'), tributes: tributes([['hati-relic', 1], ['skoll-relic', 1], ['allosaurus-brain', 10], ['basilosaurus-blubber', 10], ['tusoteuthis-tentacle', 10], ['yutyrannus-lungs', 10], ['giganotosaurus-heart', 2], ['tyrannosaurus-arm', 15]]) }),
};

const fenrisulfrRequirements = {
  gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Fenris%C3%BAlfr`, tributes: tributes([['gamma-broodmother-trophy', 1], ['gamma-megapithecus-trophy', 1], ['gamma-dragon-trophy', 1]]) }),
  beta: requirement({ level: 75, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Fenris%C3%BAlfr`, tributes: tributes([['beta-broodmother-trophy', 1], ['beta-megapithecus-trophy', 1], ['beta-dragon-trophy', 1]]) }),
  alpha: requirement({ level: 100, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Fenris%C3%BAlfr`, tributes: tributes([['alpha-broodmother-trophy', 1], ['alpha-megapithecus-trophy', 1], ['alpha-dragon-trophy', 1]]) }),
};

const rockwellRequirements = {
  gamma: requirement({ level: 60, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Rockwell_Arena_(Aberration)`, artifacts: artifacts('artifact-depths', 'artifact-shadows', 'artifact-stalker') }),
  beta: requirement({ level: 75, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Rockwell_Arena_(Aberration)`, artifacts: artifacts('artifact-depths', 'artifact-shadows', 'artifact-stalker'), tributes: tributes([['basilisk-scale', 4], ['nameless-venom', 12], ['reaper-pheromone-gland', 2], ['rock-drake-feather', 2]]) }),
  alpha: requirement({ level: 100, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Rockwell_Arena_(Aberration)`, artifacts: artifacts('artifact-depths', 'artifact-shadows', 'artifact-stalker'), tributes: tributes([['basilisk-scale', 8], ['nameless-venom', 20], ['reaper-pheromone-gland', 7], ['rock-drake-feather', 7], ['alpha-basilisk-fang', 1], ['alpha-karkinos-claw', 1], ['alpha-reaper-king-barb', 1]]) }),
};

const manticoreRequirements = {
  gamma: requirement({ level: 55, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Manticore_Arena_(Scorched_Earth)`, artifacts: artifacts('artifact-gatekeeper', 'artifact-crag', 'artifact-destroyer'), tributes: tributes([['fire-talon', 2], ['lightning-talon', 2], ['poison-talon', 2]]) }),
  beta: requirement({ level: 70, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Manticore_Arena_(Scorched_Earth)`, artifacts: artifacts('artifact-gatekeeper', 'artifact-crag', 'artifact-destroyer'), tributes: tributes([['fire-talon', 10], ['lightning-talon', 10], ['poison-talon', 10]]) }),
  alpha: requirement({ level: 95, reviewedAt: REVIEWED_AT_PHASE_C, source: `${WIKI}/wiki/Manticore_Arena_(Scorched_Earth)`, artifacts: artifacts('artifact-gatekeeper', 'artifact-crag', 'artifact-destroyer'), tributes: tributes([['fire-talon', 20], ['lightning-talon', 20], ['poison-talon', 20]]) }),
};

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
  'the-center': [
    boss({
      slug: 'the-center-guardians', name: 'The Center Guardians', nameEs: 'Guardianes de The Center', nameEn: 'The Center Guardians',
      type: 'arena',
      descriptionEs: 'Broodmother Lysrix + Megapithecus. Encuentro combinado de guardianes en The Center Arena.',
      descriptionEn: 'Broodmother Lysrix + Megapithecus. Combined guardian encounter in The Center Arena.',
      source: `${WIKI}/wiki/The_Center_Arena_(The_Center)`, requirements: centerArenaRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
  ],
  'scorched-earth': [boss({ slug: 'manticore', name: 'Manticore', type: 'final', descriptionEs: 'Guardiana final de Scorched Earth (niveles 55/70/95); tres dificultades con tributos verificados.', descriptionEn: 'Scorched Earth final guardian (levels 55/70/95); three verified tribute difficulties.', source: `${WIKI}/wiki/Manticore`, requirements: manticoreRequirements, reviewedAt: REVIEWED_AT_PHASE_C })],
  ragnarok: [
    boss({
      slug: 'ragnarok-guardians', name: 'Ragnarok Guardians', nameEs: 'Guardianes de Ragnarok', nameEn: 'Ragnarok Guardians',
      type: 'arena', game: 'evolved',
      descriptionEs: 'Dragon + Manticore. Encuentro combinado de guardianes de ASE en la arena de Ragnarok.',
      descriptionEn: 'Dragon + Manticore. ASE combined guardian encounter in the Ragnarok arena.',
      source: `${WIKI}/wiki/Ragnarok_Arena_(Ragnarok)`, requirements: ragnarokArenaRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
    boss({
      slug: 'nunatak', name: 'Nunatak', nameEs: 'Nunatak', nameEn: 'Nunatak',
      type: 'main', game: 'ascended',
      descriptionEs: 'Guardiana de hielo de Ragnarok Ascended, invocada en la Nunatak Arena (niveles 70/80/90).',
      descriptionEn: 'Ragnarok Ascended ice guardian, summoned in the Nunatak Arena (levels 70/80/90).',
      source: `${WIKI}/wiki/Nunatak`, requirements: nunatakRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
    boss({
      slug: 'lava-elemental', name: 'Lava Elemental', nameEs: 'Elemental de Lava', nameEn: 'Lava Elemental',
      type: 'mini', game: 'evolved',
      descriptionEs: 'Mini-boss de mazmorra de Ragnarok en la Arena de Lava; opcional y sin requisitos de portal.',
      descriptionEn: 'Ragnarok dungeon mini-boss in the Lava Arena; optional with no portal requirements.',
      source: `${WIKI}/wiki/Lava_Elemental`,
    }),
    boss({
      slug: 'iceworm-queen', name: 'Iceworm Queen', nameEs: 'Reina Gusano de Hielo', nameEn: 'Iceworm Queen',
      type: 'mini', game: 'both',
      descriptionEs: 'Reina de la mazmorra helada de Ragnarok (ASE y ASA); sin requisitos de portal.',
      descriptionEn: 'Queen of the Ragnarok frozen dungeon (ASE and ASA); no portal requirements.',
      source: `${WIKI}/wiki/Iceworm_Queen`,
    }),
    boss({
      slug: 'spirit-direwolf-dire-bear', name: 'Spirit Direwolf & Dire Bear', nameEs: 'Espíritu del Direwolf y del Dire Bear', nameEn: 'Spirit Direwolf & Dire Bear',
      type: 'mini', game: 'both',
      descriptionEs: 'Pareja de espíritus que custodia el Laberinto de la Vida en Ragnarok (ASE y ASA); sin requisitos de portal.',
      descriptionEn: 'Spirit pair guarding Life\'s Labyrinth on Ragnarok (ASE and ASA); no portal requirements.',
      source: `${WIKI}/wiki/Spirit_Direwolf_%26_Spirit_Dire_Bear`,
    }),
  ],
  aberration: [boss({ slug: 'rockwell', name: 'Rockwell', type: 'final', descriptionEs: 'Jefe de ascensión de Aberration (niveles 60/75/100); tres dificultades con tributos verificados.', descriptionEn: 'Aberration ascension boss (levels 60/75/100); three verified tribute difficulties.', source: `${WIKI}/wiki/Rockwell`, requirements: rockwellRequirements, reviewedAt: REVIEWED_AT_PHASE_C })],
  extinction: [
    boss({ slug: 'desert-titan', name: 'Desert Titan', type: 'titan', descriptionEs: 'Titán del desierto; tributo de portal verificado (Artifact of Chaos, Corrupt Heart, Fire Talon, Sarcosuchus Skin).', descriptionEn: 'Desert titan; verified portal tribute (Artifact of Chaos, Corrupt Heart, Fire Talon, Sarcosuchus Skin).', source: `${WIKI}/wiki/Desert_Titan`, requirements: desertTitanRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'forest-titan', name: 'Forest Titan', type: 'titan', descriptionEs: 'Titán del bosque; tributo de portal verificado (Artifact of Growth, Corrupt Heart, Sauropod Vertebra, Tyrannosaurus Arm).', descriptionEn: 'Forest titan; verified portal tribute (Artifact of Growth, Corrupt Heart, Sauropod Vertebra, Tyrannosaurus Arm).', source: `${WIKI}/wiki/Forest_Titan`, requirements: forestTitanRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'ice-titan', name: 'Ice Titan', type: 'titan', descriptionEs: 'Titán del hielo; tributo de portal verificado (Artifact of the Void, Corrupt Heart, Spinosaurus Sail, Therizino Claws).', descriptionEn: 'Ice titan; verified portal tribute (Artifact of the Void, Corrupt Heart, Spinosaurus Sail, Therizino Claws).', source: `${WIKI}/wiki/Ice_Titan`, requirements: iceTitanRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'king-titan', name: 'King Titan', type: 'final', descriptionEs: 'Encuentro final de Extinction (niveles 1/1/1 en las tres dificultades); tres dificultades con tributos verificados.', descriptionEn: 'Extinction final encounter (levels 1/1/1 at all three difficulties); three verified tribute difficulties.', source: `${WIKI}/wiki/King_Titan`, requirements: kingTitanRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
  ],
  valguero: [
    boss({
      slug: 'valguero-guardians', name: 'Valguero Guardians', nameEs: 'Guardianes de Valguero', nameEn: 'Valguero Guardians',
      type: 'arena', game: 'evolved',
      descriptionEs: 'Megapithecus + Dragon + Manticore. Encuentro combinado de guardianes exclusivo de ASE (niveles 30/50/70).',
      descriptionEn: 'Megapithecus + Dragon + Manticore. Combined guardian encounter, ASE exclusive (levels 30/50/70).',
      source: `${WIKI}/wiki/Valguero_Arena_(Valguero)`, requirements: valgueroArenaRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
    boss({
      slug: 'valguero-broodmother', name: 'Wild Broodmother', nameEs: 'Broodmother salvaje', nameEn: 'Wild Broodmother',
      type: 'other', game: 'evolved',
      descriptionEs: 'Broodmother Lysrix. Encuentro de mundo/special en Valguero, sin dificultades ni requisitos de portal.',
      descriptionEn: 'Broodmother Lysrix. Valguero world/special encounter with no difficulties or portal requirements.',
      source: `${WIKI}/wiki/Broodmother_Lysrix`,
    }),
    boss({ slug: 'grendel-valguero', name: 'Grendel', type: 'main', game: 'ascended', descriptionEs: 'Jefe de Valguero exclusivo de ARK: Survival Ascended (niveles 70/80/90); tres dificultades con tributos verificados.', descriptionEn: 'Valguero boss exclusive to ARK: Survival Ascended (levels 70/80/90); three verified tribute difficulties.', source: `${WIKI}/wiki/Grendel`, requirements: grendelRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
  ],
  'genesis-part-1': [
    boss({ slug: 'moeder', name: 'Moeder', type: 'mission', descriptionEs: 'Encuentro oceánico de Genesis: Part 1.', descriptionEn: 'Genesis: Part 1 ocean encounter.', source: `${WIKI}/wiki/Moeder` }),
    boss({ slug: 'corrupted-master-controller', name: 'Corrupted Master Controller', type: 'final', descriptionEs: 'Jefe de ascensión de la simulación Genesis; The Final Test exige completar misiones, no un nivel de jugador.', descriptionEn: 'Genesis simulation ascension boss; The Final Test requires completed missions, not a player level.', source: `${WIKI}/wiki/Corrupted_Master_Controller`, requirements: corruptedMasterControllerRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
  ],
  'genesis-part-2': [boss({ slug: 'rockwell-prime', name: 'Rockwell Prime', type: 'final', game: 'evolved', descriptionEs: 'Encuentro final de Genesis: Part 2.', descriptionEn: 'Genesis: Part 2 final encounter.', source: `${WIKI}/wiki/Rockwell_Prime` })],
  'crystal-isles': [crystalWyvernQueen],
  'lost-island': [dinopithecusKing],
  fjordur: [
    boss({ slug: 'beyla', name: 'Beyla', type: 'mini', game: 'evolved', descriptionEs: 'Mini-boss de Fjordur convocado con 30 Runestones (nivel 50).', descriptionEn: 'Fjordur mini-boss summoned with 30 Runestones (level 50).', source: `${WIKI}/wiki/Beyla`, requirements: beylaRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'hati-and-skoll', name: 'Hati & Sköll', type: 'mini', game: 'evolved', descriptionEs: 'Dúo de mini-bosses de Fjordur convocados con 30 Runestones (nivel 50).', descriptionEn: 'Fjordur mini-boss pair summoned with 30 Runestones (level 50).', source: `${WIKI}/wiki/Hati_and_Sk%C3%B6ll`, requirements: hatiSkollRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'steinbjorn', name: 'Steinbjörn', type: 'mini', game: 'evolved', descriptionEs: 'Mini-boss pétreo de Jotunheim convocado con 30 Runestones (nivel 50).', descriptionEn: 'Stone mini-boss in Jotunheim summoned with 30 Runestones (level 50).', source: `${WIKI}/wiki/Steinbj%C3%B6rn`, requirements: steinbjornRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'broodmother-fjordur', name: 'Broodmother Lysrix', game: 'evolved', descriptionEs: 'Guardiana de Fjordur; requiere la Reliquia de Beyla además del tributo estándar (niveles 30/50/70).', descriptionEn: 'Fjordur guardian; requires the Beyla Relic in addition to the standard tribute (levels 30/50/70).', source: `${WIKI}/wiki/Broodmother_Lysrix`, requirements: fjordurBroodmotherRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'megapithecus-fjordur', name: 'Megapithecus', game: 'evolved', descriptionEs: 'Guardiana de Fjordur; requiere la Reliquia de Steinbjörn además del tributo estándar (niveles 45/65/85).', descriptionEn: 'Fjordur guardian; requires the Steinbjörn Relic in addition to the standard tribute (levels 45/65/85).', source: `${WIKI}/wiki/Megapithecus`, requirements: fjordurMegapithecusRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'dragon-fjordur', name: 'Dragon', game: 'evolved', descriptionEs: 'Guardiana de Fjordur; requiere las Reliquias de Hati y Sköll además del tributo estándar (niveles 55/75/100).', descriptionEn: 'Fjordur guardian; requires the Hati and Sköll Relics in addition to the standard tribute (levels 55/75/100).', source: `${WIKI}/wiki/Dragon`, requirements: fjordurDragonRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'fenrisulfr', name: 'Fenrisúlfr', type: 'final', game: 'evolved', descriptionEs: 'Jefe final de Fjordur; requiere los trofeos de los guardianes de dificultad equivalente (niveles 55/75/100).', descriptionEn: 'Fjordur final boss; requires the matching-difficulty guardian trophies (levels 55/75/100).', source: `${WIKI}/wiki/Fenris%C3%BAlfr`, requirements: fenrisulfrRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
  ],
  'lost-colony': [
    boss({
      slug: 'red-handed', name: 'Red-Handed', type: 'mission', game: 'ascended',
      descriptionEs: 'Lost King + Lost Queen. Misión de Lost Colony con tres dificultades y tributos verificados.',
      descriptionEn: 'Lost King + Lost Queen. Lost Colony mission with three verified tribute difficulties.',
      source: `${WIKI}/wiki/Red-Handed_(Lost_Colony)`, requirements: redHandedRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
  ],
  astraeos: [
    boss({
      slug: 'natrix', name: 'Natrix', nameEs: 'Natrix', nameEn: 'Natrix',
      type: 'main', game: 'ascended',
      descriptionEs: 'Guardiana Medusa de Astraeos, invocada en la Natrix Arena (niveles 30/50/70); tres dificultades con tributos verificados.',
      descriptionEn: 'Astraeos Medusa guardian, summoned in the Natrix Arena (levels 30/50/70); three verified tribute difficulties.',
      source: `${WIKI}/wiki/Natrix`, requirements: natrixRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
    boss({
      slug: 'thodes', name: 'Thodes', nameEs: 'Thodes', nameEn: 'Thodes',
      type: 'main', game: 'ascended',
      descriptionEs: 'Guardiana Cíclope de Astraeos; tres dificultades con artefactos y tributos verificados.',
      descriptionEn: 'Astraeos Cyclops guardian; three difficulties with verified artifacts and tributes.',
      source: `${WIKI}/wiki/Thodes`, requirements: thodesRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
    boss({
      slug: 'hydraskos', name: 'Hydraskos', nameEs: 'Hydraskos', nameEn: 'Hydraskos',
      type: 'main', game: 'ascended',
      descriptionEs: 'Hidra guardiana de Astraeos (nivel 90 en las tres dificultades); tres dificultades con tributos verificados.',
      descriptionEn: 'Astraeos Hydra guardian (level 90 at all three difficulties); three verified tribute difficulties.',
      source: `${WIKI}/wiki/Hydraskos`, requirements: hydraskosRequirements, reviewedAt: REVIEWED_AT_PHASE_C,
    }),
    boss({ slug: 'minotarchos', name: 'Minotarchos', type: 'mini', game: 'ascended', nameEs: 'Minotarchos', nameEn: 'Minotarchos', descriptionEs: 'Minotauro dorado de Astraeos; requiere un tributo de invocación verificado.', descriptionEn: 'Astraeos golden Minotaur; requires a verified summon tribute.', source: `${WIKI}/wiki/Minotarchos`, requirements: minotarchosRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'erymanthian-kalydonios', name: 'Erymanthian & Kalydonios', type: 'mini', game: 'ascended', nameEs: 'Erymanthian y Kalydonios', nameEn: 'Erymanthian & Kalydonios', descriptionEs: 'Doble mini-boss de Astraeos; requiere un tributo de invocación verificado.', descriptionEn: 'Astraeos double mini-boss; requires a verified summon tribute.', source: `${WIKI}/wiki/Erymanthian_%26_Kalydonios`, requirements: erymanthianRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'pulmonoscorpius-monarch', name: 'Pulmonoscorpius Monarch', type: 'mini', game: 'ascended', nameEs: 'Escorpión Monarca Pulmonoscorpius', nameEn: 'Pulmonoscorpius Monarch', descriptionEs: 'Escorpión monarca de Astraeos, sin requisitos de portal.', descriptionEn: 'Astraeos monarch scorpion with no portal requirements.', source: `${WIKI}/wiki/Pulmonoscorpius_Monarch` }),
    boss({ slug: 'thanatos', name: 'Thanatos', type: 'mini', game: 'ascended', nameEs: 'Thanatos', nameEn: 'Thanatos', descriptionEs: 'Jefe esquelético de Astraeos, sin requisitos de portal.', descriptionEn: 'Astraeos skeletal boss with no portal requirements.', source: `${WIKI}/wiki/Thanatos` }),
    boss({ slug: 'manticore-astraeos', name: 'Manticore', type: 'other', game: 'ascended', nameEs: 'Manticora', nameEn: 'Manticore', descriptionEs: 'Manticora presente en Astraeos, sin requisitos de portal.', descriptionEn: 'Manticore found on Astraeos with no portal requirements.', source: `${WIKI}/wiki/Manticore` }),
  ],
  aquatica: [
    boss({ slug: 'cymathoa', name: 'Cymathoa', type: 'main', game: 'evolved', nameEs: 'Cymathoa', nameEn: 'Cymathoa', descriptionEs: 'Isópodo gigante de Aquatica (niveles 45/65/85); tres dificultades con tributos verificados.', descriptionEn: 'Aquatica giant isopod (levels 45/65/85); three verified tribute difficulties.', source: `${WIKI}/wiki/Cymathoa`, requirements: cymathoaRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'fractalis', name: 'Fractalis', type: 'main', game: 'evolved', nameEs: 'Fractalis', nameEn: 'Fractalis', descriptionEs: 'Criatura de cristal de Aquatica (niveles 10/50/70); tres dificultades con tributos verificados.', descriptionEn: 'Aquatica crystal creature (levels 10/50/70); three verified tribute difficulties.', source: `${WIKI}/wiki/Fractalis`, requirements: fractalisRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'pygocentrus', name: 'Pygocentrus', type: 'main', game: 'evolved', nameEs: 'Pygocentrus', nameEn: 'Pygocentrus', descriptionEs: 'Piraña gigante final de Aquatica (niveles 55/75/100); exige los trofeos de los otros tres jefes en la misma dificultad.', descriptionEn: 'Aquatica final giant piranha (levels 55/75/100); requires the other three bosses trophies at the same difficulty.', source: `${WIKI}/wiki/Pygocentrus`, requirements: pygocentrusRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'vulcanithys', name: 'Vulcanithys', type: 'main', game: 'evolved', nameEs: 'Vulcanithys', nameEn: 'Vulcanithys', descriptionEs: 'Pez volcánico de Aquatica (niveles 55/70/95); tres dificultades con tributos verificados.', descriptionEn: 'Aquatica volcanic fish (levels 55/70/95); three verified tribute difficulties.', source: `${WIKI}/wiki/Vulcanithys`, requirements: vulcanithysRequirements, reviewedAt: REVIEWED_AT_PHASE_C }),
    boss({ slug: 'alpha-tridacna', name: 'Alpha Tridacna', type: 'other', game: 'evolved', nameEs: 'Tridacna Alfa', nameEn: 'Alpha Tridacna', descriptionEs: 'Almeja gigante alfa que actúa como jefe de mundo en Aquatica; otorga Perlas Abisales y Elemento.', descriptionEn: 'Alpha giant clam acting as an Aquatica world boss; drops Abyssal Pearls and Element.', source: `${WIKI}/wiki/Alpha_Tridacna` }),
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
  map({ slug: 'genesis-part-1', name: 'Genesis: Part 1', game: 'both', type: 'story', canonical: true, orderEvolved: 8, orderAscended: 10, descriptionEs: 'Simulación por biomas con misiones y ascensión.', descriptionEn: 'Biome simulation with missions and ascension.', source: `${WIKI}/wiki/Genesis_1` }),
  map({ slug: 'crystal-isles', name: 'Crystal Isles', game: 'evolved', type: 'official_mod', canonical: false, orderEvolved: 9, orderAscended: null, descriptionEs: 'Expansión oficial no canónica disponible en ASE.', descriptionEn: 'Official non-canonical expansion available in ASE.', source: `${WIKI}/wiki/Crystal_Isles` }),
  map({ slug: 'genesis-part-2', name: 'Genesis: Part 2', game: 'evolved', type: 'story', canonical: true, orderEvolved: 10, orderAscended: null, descriptionEs: 'Cierre de la saga Genesis en ASE.', descriptionEn: 'The Genesis saga finale in ASE.', source: `${WIKI}/wiki/Genesis_2` }),
  map({ slug: 'lost-island', name: 'Lost Island', game: 'evolved', type: 'official_mod', canonical: false, orderEvolved: 11, orderAscended: null, descriptionEs: 'Expansión oficial no canónica disponible en ASE.', descriptionEn: 'Official non-canonical expansion available in ASE.', source: `${WIKI}/wiki/Lost_Island` }),
  map({ slug: 'fjordur', name: 'Fjordur', game: 'evolved', type: 'official_mod', canonical: false, orderEvolved: 12, orderAscended: null, descriptionEs: 'Reinos nórdicos, mini-bosses, guardianes y Fenrisúlfr.', descriptionEn: 'Norse realms, mini-bosses, guardians, and Fenrisúlfr.', source: `${WIKI}/wiki/Fjordur` }),
  map({ slug: 'aquatica', name: 'Aquatica', game: 'evolved', type: 'anniversary', canonical: false, orderEvolved: 13, orderAscended: null, descriptionEs: 'DLC de aniversario no canónico centrado en exploración submarina.', descriptionEn: 'Non-canonical anniversary DLC focused on underwater exploration.', source: 'https://store.steampowered.com/app/3537070/ARK_Aquatica/', platformNotes: 'PC / Steam; contenido premium no canónico.' }),
  map({ slug: 'astraeos', name: 'Astraeos', game: 'ascended', type: 'premium', canonical: false, orderEvolved: null, orderAscended: 6, descriptionEs: 'Mapa premium no canónico inspirado en mitología griega.', descriptionEn: 'Premium non-canonical map inspired by Greek mythology.', source: 'https://store.steampowered.com/app/3483400/ARK_Astraeos/', platformNotes: 'Contenido premium de ARK: Survival Ascended.' }),
  map({ slug: 'lost-colony', name: 'Lost Colony', game: 'ascended', type: 'story', canonical: true, orderEvolved: null, orderAscended: 9, descriptionEs: 'Primera expansión canónica de pago de ARK: Survival Ascended.', descriptionEn: 'The first paid canonical ARK: Survival Ascended expansion.', source: `${WIKI}/wiki/Lost_Colony`, platformNotes: 'Expansión canónica de pago de ARK: Survival Ascended.' }),
];

export const iniPresets = [
  {
    id: 'clean-visibility', slug: 'clean-visibility', title: 'Visibilidad limpia', title_es: 'Visibilidad limpia', title_en: 'Clean visibility',
    category: 'other', game: 'both', game_availability: 'both', file_target: 'Engine.ini',
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
    category: 'other', game: 'ascended', game_availability: 'ascended', file_target: 'Engine.ini',
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
    category: 'other', game: 'both', game_availability: 'both', file_target: 'Game.ini',
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
