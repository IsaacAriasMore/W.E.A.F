export const iniPresets = [
  {
    id: 'clean-visibility',
    title: 'Visibilidad limpia',
    category: 'visibility',
    categoryLabel: 'Visibilidad',
    game: 'both',
    description: 'Reduce efectos ambientales que dificultan leer el terreno sin alterar controles.',
    copies: 1284,
    downloads: 638,
    content: '[SystemSettings]\nr.VolumetricCloud=0\nr.Fog=0\nr.MotionBlurQuality=0\nr.BloomQuality=0',
  },
  {
    id: 'fps-balanced',
    title: 'FPS competitivo',
    category: 'fps',
    categoryLabel: 'FPS Boost',
    game: 'ascended',
    description: 'Base moderada para equipos que priorizan respuesta y lectura en ASA.',
    copies: 943,
    downloads: 482,
    content: '[SystemSettings]\nr.ShadowQuality=1\nr.ViewDistanceScale=0.8\nr.Lumen.Reflections.Allow=0\nr.Nanite.MaxPixelsPerEdge=4',
  },
  {
    id: 'pvp-focus',
    title: 'PvP enfocado',
    category: 'pvp',
    categoryLabel: 'PvP',
    game: 'evolved',
    description: 'Configuración legible para combates y movimiento rápido en ASE.',
    copies: 776,
    downloads: 391,
    content: '[SystemSettings]\nr.LightShaftQuality=0\nr.TrueSkyQuality=0\nr.PostProcessQuality=1\nr.DetailMode=0',
  },
  {
    id: 'farm-comfort',
    title: 'Farmeo cómodo',
    category: 'farming',
    categoryLabel: 'Farmeo',
    game: 'both',
    description: 'Ajustes visuales suaves para rutas largas de recolección.',
    copies: 619,
    downloads: 254,
    content: '[SystemSettings]\nr.MotionBlurQuality=0\nr.DepthOfFieldQuality=0\nr.LensFlareQuality=0\nr.BloomQuality=1',
  },
  {
    id: 'hard-survival',
    title: 'Supervivencia hard',
    category: 'hard',
    categoryLabel: 'Hard',
    game: 'both',
    description: 'Mantiene atmósfera y contraste para sesiones de supervivencia exigente.',
    copies: 412,
    downloads: 188,
    content: '[SystemSettings]\nr.Fog=1\nr.BloomQuality=2\nr.ShadowQuality=2\nr.ViewDistanceScale=1.0',
  },
  {
    id: 'clean-default',
    title: 'Base limpia',
    category: 'clean',
    categoryLabel: 'Clean',
    game: 'both',
    description: 'Punto de partida breve y fácil de adaptar para cualquier servidor.',
    copies: 359,
    downloads: 146,
    content: '[SystemSettings]\nr.MotionBlurQuality=0\nr.LensFlareQuality=0\nr.DepthOfFieldQuality=0',
  },
];

export const mapBosses = [
  {
    id: 'island',
    name: 'The Island',
    game: 'both',
    description: 'Progresión clásica con tres guardianes y el Overseer.',
    bosses: [
      {
        id: 'broodmother',
        name: 'Broodmother Lysrix',
        preparation: 'Ejército resistente, monturas y consumibles para daño prolongado.',
        requirements: {
          gamma: ['Artifact of the Clever x1', 'Artifact of the Hunter x1', 'Artifact of the Massive x1'],
          beta: ['Argentavis Talon x5', 'Sarcosuchus Skin x5', 'Titanoboa Venom x5'],
          alpha: ['Argentavis Talon x10', 'Sarcosuchus Skin x10', 'Titanoboa Venom x10'],
        },
      },
      {
        id: 'megapithecus',
        name: 'Megapithecus',
        preparation: 'Daño alto, control de formación y atención al borde de la arena.',
        requirements: {
          gamma: ['Artifact of the Brute x1', 'Artifact of the Devourer x1', 'Artifact of the Pack x1'],
          beta: ['Megalania Toxin x5', 'Megalodon Tooth x5', 'Spinosaurus Sail x5'],
          alpha: ['Megalania Toxin x10', 'Megalodon Tooth x10', 'Spinosaurus Sail x10'],
        },
      },
    ],
  },
  {
    id: 'scorched-earth',
    name: 'Scorched Earth',
    game: 'both',
    description: 'Una ruta directa al Manticore bajo condiciones extremas.',
    bosses: [
      {
        id: 'manticore',
        name: 'Manticore',
        preparation: 'Daño a distancia, estimulantes y criaturas con buena movilidad.',
        requirements: {
          gamma: ['Artifact of the Crag x1', 'Artifact of the Destroyer x1', 'Artifact of the Gatekeeper x1'],
          beta: ['Fire Talon x10', 'Lightning Talon x10', 'Poison Talon x10'],
          alpha: ['Fire Talon x20', 'Lightning Talon x20', 'Poison Talon x20'],
        },
      },
    ],
  },
  {
    id: 'aberration',
    name: 'Aberration',
    game: 'both',
    description: 'Preparación especializada para descender hasta Rockwell.',
    bosses: [
      {
        id: 'rockwell',
        name: 'Rockwell',
        preparation: 'Armas a distancia, resistencia ambiental y una ruta de movimiento clara.',
        requirements: {
          gamma: ['Artifact of the Depths x1', 'Artifact of the Shadows x1', 'Artifact of the Stalker x1'],
          beta: ['Basilisk Scale x4', 'Nameless Venom x12', 'Reaper Pheromone x2'],
          alpha: ['Basilisk Scale x8', 'Nameless Venom x20', 'Reaper Pheromone x7'],
        },
      },
    ],
  },
];

export const creatures = [
  { id: 'rex', name: 'Rex', game: 'both', type: 'Terrestre', map: 'The Island', use: 'Boss', cooldown: '18-48 h', note: 'Base sólida para líneas de vida y daño.' },
  { id: 'therizinosaur', name: 'Therizinosaur', game: 'both', type: 'Terrestre', map: 'The Island', use: 'Boss', cooldown: '18-48 h', note: 'Versátil y compatible con curación vegetal.' },
  { id: 'argentavis', name: 'Argentavis', game: 'both', type: 'Volador', map: 'The Island', use: 'Farmeo', cooldown: '18-48 h', note: 'Transporte fiable para rutas de metal.' },
  { id: 'rock-drake', name: 'Rock Drake', game: 'both', type: 'Especial', map: 'Aberration', use: 'Exploración', cooldown: 'Sin reproducción vanilla ASE', note: 'Movilidad vertical y camuflaje.' },
  { id: 'carcharodontosaurus', name: 'Carcharodontosaurus', game: 'both', type: 'Terrestre', map: 'The Island', use: 'PvP', cooldown: '18-48 h', note: 'Presión sostenida cuando mantiene ritmo.' },
  { id: 'deinosuchus', name: 'Deinosuchus', game: 'ascended', type: 'Acuático', map: 'The Center', use: 'PvP', cooldown: 'Datos por validar', note: 'Emboscada anfibia y alto daño cargado.' },
  { id: 'managarmr', name: 'Managarmr', game: 'evolved', type: 'Especial', map: 'Extinction', use: 'Movilidad', cooldown: '18-48 h', note: 'Control de distancia y desplazamiento rápido.' },
  { id: 'basilosaurus', name: 'Basilosaurus', game: 'both', type: 'Acuático', map: 'The Island', use: 'Exploración', cooldown: '18-48 h', note: 'Resistencia para rutas oceánicas profundas.' },
];

export const featuredServers = [
  { name: 'Obsidian Coast', game: 'ASA', type: 'PvPvE', region: 'LATAM', rate: '5x', tag: 'Ejemplo Plus' },
  { name: 'Valhalla Origins', game: 'ASE', type: 'PvE', region: 'NA', rate: '3x', tag: 'Ejemplo' },
];
