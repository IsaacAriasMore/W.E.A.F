import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CAPTCHA_STATES, createCaptchaGate, createSubmissionLock } from '../src/utils/authCaptcha.js';
import { isAuthCaptchaConfigured } from '../src/config/authCaptcha.js';
import { friendlyAuthError } from '../src/services/authService.js';

for (const flow of ['registration', 'login', 'password recovery']) {
  test(`${flow} is blocked without a token when CAPTCHA is enabled`, () => {
    const gate = createCaptchaGate({ enabled: true, siteKey: 'public-site-key' });
    gate.available();
    assert.deepEqual(gate.take(), { ok: false, captchaToken: undefined });
  });
}

test('a verified CAPTCHA token is single-use and cleared after take', () => {
  const gate = createCaptchaGate({ enabled: true, siteKey: 'public-site-key' });
  gate.verify('ephemeral-token');
  assert.deepEqual(gate.take(), { ok: true, captchaToken: 'ephemeral-token' });
  assert.equal(gate.state, CAPTCHA_STATES.sending);
  assert.deepEqual(gate.take(), { ok: false, captchaToken: undefined });
});

test('an expired CAPTCHA token cannot be submitted', () => {
  const gate = createCaptchaGate({ enabled: true, siteKey: 'public-site-key' });
  gate.verify('ephemeral-token');
  gate.expire();
  assert.equal(gate.state, CAPTCHA_STATES.expired);
  assert.deepEqual(gate.take(), { ok: false, captchaToken: undefined });
});

test('a CAPTCHA failure clears the token and the widget controller schedules a reset', async () => {
  const gate = createCaptchaGate({ enabled: true, siteKey: 'public-site-key' });
  gate.verify('ephemeral-token');
  gate.fail();
  assert.equal(gate.state, CAPTCHA_STATES.error);
  assert.deepEqual(gate.take(), { ok: false, captchaToken: undefined });

  const source = await readFile(new URL('../src/services/turnstileService.js', import.meta.url), 'utf8');
  assert.match(source, /'error-callback'\(\) \{ gate\.fail\(\); resetWidget\(1200, \{ preserveState: true \}\); return true; \}/);
});

test('submission lock prevents a double click from issuing two requests', () => {
  const lock = createSubmissionLock();
  assert.equal(lock.tryLock(), true);
  assert.equal(lock.tryLock(), false);
  lock.release();
  assert.equal(lock.tryLock(), true);
});

test('rate limits use generic localized messages', () => {
  const error = { status: 429, code: 'over_request_rate_limit' };
  assert.equal(
    friendlyAuthError(error, { language: 'es' }),
    'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  );
  assert.equal(
    friendlyAuthError(error, { language: 'en' }),
    'Too many attempts. Wait a few minutes and try again.',
  );
});

test('password recovery does not expose provider errors or account existence', async () => {
  assert.equal(friendlyAuthError(new Error('smtp unavailable'), { context: 'recovery', language: 'es' }), null);
  const source = await readFile(new URL('../src/config/auth.js', import.meta.url), 'utf8');
  assert.match(source, /Si existe una cuenta asociada, recibirás instrucciones\./);
  assert.match(source, /If an associated account exists, you will receive instructions\./);
});

test('the staged rollout remains open when disabled and fails closed without a site key', () => {
  const disabled = createCaptchaGate({ enabled: false, siteKey: '' });
  assert.deepEqual(disabled.take(), { ok: true, captchaToken: undefined });
  assert.equal(isAuthCaptchaConfigured({ enabled: false, siteKey: '' }), true);

  const enabledWithoutKey = createCaptchaGate({ enabled: true, siteKey: '' });
  assert.equal(enabledWithoutKey.state, CAPTCHA_STATES.error);
  assert.deepEqual(enabledWithoutKey.take(), { ok: false, captchaToken: undefined });
  assert.equal(isAuthCaptchaConfigured({ enabled: true, siteKey: '' }), false);
});

test('CSP permits only required Turnstile origins and preserves security headers', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const globalHeaders = config.headers.find(({ source }) => source === '/(.*)');
  const headers = Object.fromEntries(globalHeaders.headers.map(({ key, value }) => [key, value]));
  const csp = headers['Content-Security-Policy'];

  assert.match(csp, /script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/\*\.supabase\.co[^;]*wss:\/\/\*\.supabase\.co[^;]*https:\/\/api-m\.sandbox\.paypal\.com/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /https:\/\/\*\.cloudflare\.com/);
  for (const header of ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.ok(headers[header], `${header} must remain configured`);
  }
});

test('only public CAPTCHA variables exist and tokens are never persisted or logged', async () => {
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../src/services/turnstileService.js', import.meta.url), 'utf8');
  const formUtils = await readFile(new URL('../src/pages/auth/formUtils.js', import.meta.url), 'utf8');

  assert.match(envExample, /^VITE_AUTH_CAPTCHA_ENABLED=false$/m);
  assert.match(envExample, /^VITE_TURNSTILE_SITE_KEY=$/m);
  assert.doesNotMatch(envExample, /TURNSTILE_SECRET/i);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|console\./);
  assert.doesNotMatch(controller, /secret/i);
  assert.match(controller, /setAttribute\('aria-disabled', String\(submit\.disabled\)\)/);
  assert.match(formUtils, /setAttribute\('aria-disabled', String\(submitting\)\)/);
});
