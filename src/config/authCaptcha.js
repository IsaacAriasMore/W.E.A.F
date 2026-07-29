const env = import.meta.env || {};

export const AUTH_CAPTCHA_ENABLED = env.VITE_AUTH_CAPTCHA_ENABLED === 'true';
export const TURNSTILE_SITE_KEY = String(env.VITE_TURNSTILE_SITE_KEY || '').trim();

export function isAuthCaptchaConfigured({
  enabled = AUTH_CAPTCHA_ENABLED,
  siteKey = TURNSTILE_SITE_KEY,
} = {}) {
  return !enabled || Boolean(siteKey);
}
