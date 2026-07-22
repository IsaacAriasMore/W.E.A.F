const STORAGE_KEY = 'weaf:consent:v1';

export const consentCategories = Object.freeze({
  necessary: true,
  analytics: false,
  advertising: false,
});

export function readConsent() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (!saved || saved.version !== 1) return null;
    return {
      ...consentCategories,
      analytics: Boolean(saved.analytics),
      advertising: Boolean(saved.advertising),
      updatedAt: saved.updatedAt,
      version: 1,
    };
  } catch {
    return null;
  }
}

export function saveConsent(preferences) {
  const consent = {
    ...consentCategories,
    analytics: Boolean(preferences.analytics),
    advertising: Boolean(preferences.advertising),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // The preference still applies to the current page when storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent('weaf:consent-changed', { detail: consent }));
  return consent;
}

export function hasMeasurementConsent() {
  const consent = readConsent();
  return Boolean(consent?.analytics || consent?.advertising);
}
