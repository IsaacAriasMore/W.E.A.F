import { AUTH_CAPTCHA_ENABLED, TURNSTILE_SITE_KEY } from '../config/authCaptcha.js';
import { getAuthCopy } from '../config/auth.js';
import { getLanguage } from '../i18n/index.js';
import { CAPTCHA_STATES, createCaptchaGate } from '../utils/authCaptcha.js';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile-script]');
    const script = existing || document.createElement('script');
    const onLoad = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile_api_unavailable'));
    const onError = () => reject(new Error('turnstile_script_failed'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      document.head.append(script);
    }
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export function renderAuthCaptcha({ action, language = getLanguage() }) {
  if (!AUTH_CAPTCHA_ENABLED) return '';
  const copy = getAuthCopy(language).captcha;
  const initialState = TURNSTILE_SITE_KEY ? 'loading' : 'error';
  const initialMessage = TURNSTILE_SITE_KEY ? copy.loading : copy.missingKey;
  return `
    <div class="auth-captcha" data-auth-captcha data-action="${action}" data-state="${initialState}">
      <div class="auth-captcha-widget" data-turnstile-widget aria-label="${copy.label}"></div>
      <p class="auth-captcha-status" data-captcha-status role="status" aria-live="polite">${initialMessage}</p>
    </div>`;
}

export function authCaptchaSubmitAttributes() {
  return AUTH_CAPTCHA_ENABLED ? ' disabled aria-disabled="true"' : '';
}

export function bindAuthCaptcha(form, { action, language = getLanguage() } = {}) {
  const copy = getAuthCopy(language).captcha;
  const root = form?.querySelector('[data-auth-captcha]');
  const widgetContainer = root?.querySelector('[data-turnstile-widget]');
  const status = root?.querySelector('[data-captcha-status]');
  const submit = form?.querySelector('[type="submit"]');
  let widgetId = null;
  let api = null;
  let destroyed = false;
  let resetTimer = null;

  const gate = createCaptchaGate({
    enabled: AUTH_CAPTCHA_ENABLED,
    siteKey: TURNSTILE_SITE_KEY,
    onStateChange(state) {
      if (!root) return;
      root.dataset.state = state;
      if (status) status.textContent = copy[state] || copy.error;
      if (submit) {
        submit.disabled = state !== CAPTCHA_STATES.verified;
        submit.setAttribute('aria-disabled', String(submit.disabled));
      }
    },
  });

  const resetWidget = (delay = 0, { preserveState = false } = {}) => {
    if (!preserveState) gate.reset();
    if (resetTimer) window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      if (destroyed || !api || widgetId === null) return;
      if (preserveState) gate.reset();
      api.reset(widgetId);
      gate.available();
    }, delay);
  };

  if (AUTH_CAPTCHA_ENABLED) {
    if (submit) submit.disabled = true;
    if (!TURNSTILE_SITE_KEY || !root || !widgetContainer) {
      gate.fail();
    } else {
      loadTurnstileScript()
        .then((turnstile) => {
          if (destroyed) return;
          api = turnstile;
          widgetId = api.render(widgetContainer, {
            sitekey: TURNSTILE_SITE_KEY,
            action,
            theme: 'dark',
            size: 'flexible',
            language,
            appearance: 'always',
            retry: 'never',
            callback(token) { gate.verify(token); },
            'expired-callback'() { gate.expire(); },
            'timeout-callback'() { gate.expire(); resetWidget(400); },
            'error-callback'() { gate.fail(); resetWidget(1200, { preserveState: true }); return true; },
            'unsupported-callback'() { gate.fail(); return true; },
          });
          gate.available();
        })
        .catch(() => gate.fail());
    }
  }

  return {
    get enabled() { return AUTH_CAPTCHA_ENABLED; },
    takeToken() {
      const result = gate.take();
      if (!result.ok && status) status.textContent = TURNSTILE_SITE_KEY ? copy.required : copy.missingKey;
      return result;
    },
    reset: resetWidget,
    expire: () => gate.expire(),
    destroy() {
      destroyed = true;
      gate.clear();
      if (resetTimer) window.clearTimeout(resetTimer);
      if (api && widgetId !== null) api.remove(widgetId);
    },
  };
}
