import { mapBosses } from '../data/publicData.js';

const EXTRA_MAPS = [
  { id: 'the-center', name: 'The Center', game: 'both' },
  { id: 'ragnarok', name: 'Ragnarok', game: 'both' },
  { id: 'extinction', name: 'Extinction', game: 'both' },
  { id: 'valguero', name: 'Valguero', game: 'evolved' },
  { id: 'genesis-1', name: 'Genesis: Part 1', game: 'evolved' },
  { id: 'crystal-isles', name: 'Crystal Isles', game: 'evolved' },
  { id: 'genesis-2', name: 'Genesis: Part 2', game: 'evolved' },
  { id: 'lost-island', name: 'Lost Island', game: 'evolved' },
  { id: 'fjordur', name: 'Fjordur', game: 'evolved' },
];

const catalogMaps = mapBosses.map(({ id, name, game }) => ({ id, name, game }));

export const SERVER_MAPS = [...catalogMaps, ...EXTRA_MAPS]
  .filter((map, index, maps) => maps.findIndex((item) => item.name === map.name) === index);

export const SERVER_PLATFORMS = [
  { id: 'steam', label: 'Steam', game: 'both' },
  { id: 'epic-games', label: 'Epic Games', game: 'evolved' },
  { id: 'xbox', label: 'Xbox', game: 'ascended' },
  { id: 'playstation', label: 'PlayStation', game: 'ascended' },
  { id: 'microsoft-store', label: 'Windows / Microsoft Store', game: 'ascended' },
  { id: 'crossplay', label: 'Crossplay', game: 'ascended' },
];

export const RATE_FIELDS = [
  ['xp', 'XP', 'Ejemplo: 1x, 2x o 5x'],
  ['harvesting', 'Recolección / Farmeo', 'Cantidad obtenida al recolectar'],
  ['taming', 'Tameo', 'Velocidad para domesticar'],
  ['breeding', 'Crianza', 'Velocidad general de reproducción'],
  ['maturation', 'Maduración de bebé', 'Tiempo hasta llegar a adulto'],
  ['incubation', 'Incubación / Huevo', 'Velocidad de incubación'],
  ['mating_interval', 'Intervalo de apareamiento', 'Tiempo entre cruces'],
  ['imprint', 'Imprint / Cuidado', 'Progreso de impronta por cuidado'],
];

export const RATE_PRESETS = {
  not_specified: null,
  vanilla: { xp: 1, harvesting: 1, taming: 1, breeding: 1, maturation: 1, incubation: 1, mating_interval: 1, imprint: 1 },
  low: { xp: 2, harvesting: 2, taming: 3, breeding: 3, maturation: 3, incubation: 3, mating_interval: 0.5, imprint: 2 },
  medium: { xp: 5, harvesting: 5, taming: 10, breeding: 10, maturation: 10, incubation: 10, mating_interval: 0.25, imprint: 5 },
  high: { xp: 10, harvesting: 10, taming: 25, breeding: 25, maturation: 25, incubation: 25, mating_interval: 0.1, imprint: 10 },
};

export function availableForGame(items, game) {
  return items.filter((item) => game === 'both' || item.game === 'both' || item.game === game);
}

export function normalizeRates(preset, values = {}) {
  if (preset === 'not_specified') return { preset: 'not_specified' };
  const source = preset === 'custom' ? values : RATE_PRESETS[preset];
  return {
    preset,
    ...Object.fromEntries(RATE_FIELDS.map(([key]) => [key, Number(source?.[key] ?? 1)])),
  };
}

