export const FALLBACK_IMAGE = '/assets/weaf-hero.webp';

export const mapImageCandidate = (slug) => `/assets/ark/maps/${encodeURIComponent(slug)}.webp`;
export const bossImageCandidate = (slug) => `/assets/ark/bosses/${encodeURIComponent(slug)}.webp`;

export function resolveImage(value, localCandidate) {
  if (value) return value;
  return localCandidate || FALLBACK_IMAGE;
}

export const resolveMapImage = (map) => resolveImage(map.image_url, mapImageCandidate(map.slug));
export const resolveBossImage = (boss) => resolveImage(boss.image_url, bossImageCandidate(boss.slug));