export const CAPTCHA_STATES = Object.freeze({
  disabled: 'disabled',
  loading: 'loading',
  available: 'available',
  verified: 'verified',
  expired: 'expired',
  error: 'error',
  sending: 'sending',
});

export function createCaptchaGate({ enabled, siteKey, onStateChange = () => {} }) {
  let token = null;
  let state = enabled ? (siteKey ? CAPTCHA_STATES.loading : CAPTCHA_STATES.error) : CAPTCHA_STATES.disabled;

  const transition = (nextState) => {
    state = nextState;
    onStateChange(state);
  };

  return {
    get state() { return state; },
    get enabled() { return enabled; },
    available() {
      token = null;
      if (enabled && siteKey) transition(CAPTCHA_STATES.available);
    },
    verify(nextToken) {
      token = typeof nextToken === 'string' && nextToken ? nextToken : null;
      transition(token ? CAPTCHA_STATES.verified : CAPTCHA_STATES.error);
    },
    expire() {
      token = null;
      if (enabled) transition(CAPTCHA_STATES.expired);
    },
    fail() {
      token = null;
      if (enabled) transition(CAPTCHA_STATES.error);
    },
    take() {
      if (!enabled) return { ok: true, captchaToken: undefined };
      if (!siteKey || state !== CAPTCHA_STATES.verified || !token) return { ok: false, captchaToken: undefined };
      const captchaToken = token;
      token = null;
      transition(CAPTCHA_STATES.sending);
      return { ok: true, captchaToken };
    },
    reset() {
      token = null;
      if (enabled) transition(siteKey ? CAPTCHA_STATES.loading : CAPTCHA_STATES.error);
    },
    clear() { token = null; },
  };
}

export function createSubmissionLock() {
  let locked = false;
  return {
    tryLock() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() { locked = false; },
    get locked() { return locked; },
  };
}
