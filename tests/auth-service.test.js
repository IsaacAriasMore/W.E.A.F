import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../src/services/authService.js';

test('signup sends only profile metadata and the current legal versions', async () => {
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
  });

  assert.equal(result.error, null);
  assert.deepEqual(request.options.data, {
    display_name: 'Survivor',
    default_game_mode: 'ascended',
    terms_version: '2026-07-draft',
    privacy_version: '2026-07-draft',
  });
  assert.equal(request.options.emailRedirectTo, 'https://weaf.example/onboarding');
  assert.equal('global_role' in request.options.data, false);
});
