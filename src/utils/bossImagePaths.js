export const FALLBACK_IMAGE = '/assets/weaf-hero.webp';

export const mapImageCandidate = (slug) => `/assets/ark/maps/${encodeURIComponent(slug)}.webp`;
export const bossImageCandidate = (slug) => `/assets/ark/bosses/${encodeURIComponent(slug)}.webp`;

export function resolveImage(value, localCandidate) {
  if (!value) return localCandidate || FALLBACK_IMAGE;

  try {
    const url = new URL(String(value).trim());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // invalid or non-absolute explicit URL
  }

  return FALLBACK_IMAGE;
}

export const resolveMapImage = (map) => resolveImage(map.image_url, mapImageCandidate(map.slug));
export const resolveBossImage = (boss) => resolveImage(boss.image_url, bossImageCandidate(boss.slug));