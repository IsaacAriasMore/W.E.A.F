import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../src/services/authService.js';

test('signup sends CAPTCHA, profile metadata and the current legal versions', async () => {
  let request;
  globalThis.window = { location: { origin: 'https://weaf.example' } };
  const client = {
    auth: {
      async signUp(payload) {
        request = payload;
        return { data: { user: { id: 'user-1' }, session: null }, error: null };
      },
    },
  };

  const result = await createAuthService(client).signUp({
    email: 'survivor@example.com',
    password: 'strong-passphrase',
    displayName: 'Survivor',
    gameMode: 'ascended',
    next: '/app?invite=one-time-token',
    captchaToken: 'captcha-signup',
  });

  assert.equal(result.error, null);
  assert.equal(request.options.captchaToken, 'captcha-signup');
  assert.deepEqual(request.options.data, {
    display_name: 'Survivor',
    default_game_mode: 'ascended',
    terms_version: '2026-07-draft',
    privacy_version: '2026-07-draft',
  });
  assert.equal(request.options.emailRedirectTo, 'https://weaf.example/onboarding?next=%2Fapp%3Finvite%3Done-time-token');
  assert.equal('global_role' in request.options.data, false);
});

test('direct signup preserves the session returned by Supabase', async () => {
  globalThis.window = { location: { origin: 'https://weaf.example' } };
  const session = { access_token: 'token', user: { id: 'user-2', email_confirmed_at: null } };
  const client = { auth: { async signUp() { return { data: { user: session.user, session }, error: null }; } } };

  const result = await createAuthService(client).signUp({
    email: 'direct@example.com', password: 'strong-passphrase', displayName: 'Directo', gameMode: 'both',
  });

  assert.equal(result.error, null);
  assert.equal(result.data.session, session);
});

test('login passes CAPTCHA and does not reject an unconfirmed email while confirmation is disabled', async () => {
  let request;
  const session = { access_token: 'token', user: { id: 'user-3', email_confirmed_at: null } };
  const client = {
    auth: {
      async signInWithPassword(payload) {
        request = payload;
        return { data: { user: session.user, session }, error: null };
      },
    },
  };
  const result = await createAuthService(client).signIn({
    email: 'direct@example.com', password: 'strong-passphrase', captchaToken: 'captcha-login',
  });
  assert.equal(result.error, null);
  assert.equal(result.data.session, session);
  assert.deepEqual(request.options, { captchaToken: 'captcha-login' });
});

test('password recovery passes CAPTCHA and masks provider details', async () => {
  globalThis.window = { location: { origin: 'https://weaf.example' } };
  let options;
  const client = {
    auth: {
      async resetPasswordForEmail(_email, value) {
        options = value;
        return { data: null, error: new Error('smtp unavailable') };
      },
    },
  };
  const result = await createAuthService(client).requestPasswordReset('survivor@example.com', 'captcha-recovery');
  assert.equal(result.error, null);
  assert.equal(options.redirectTo, 'https://weaf.example/reset-password');
  assert.equal(options.captchaToken, 'captcha-recovery');
});
