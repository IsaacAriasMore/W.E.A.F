export const AD_DISMISSAL_DAYS = 7;

const keyFor = (placement) => `weaf:dismissed-ad:${placement}`;

export function isAdDismissed(placement, storage = window.localStorage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(keyFor(placement)));
    if (!saved?.expiresAt || Number(saved.expiresAt) <= now) {
      storage.removeItem(keyFor(placement));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function dismissAd(placement, storage = window.localStorage, now = Date.now(), days = AD_DISMISSAL_DAYS) {
  try {
    storage.setItem(keyFor(placement), JSON.stringify({
      dismissedAt: now,
      expiresAt: now + days * 86400000,
    }));
  } catch {
    // Dismiss the current render even when storage is unavailable.
  }
}
