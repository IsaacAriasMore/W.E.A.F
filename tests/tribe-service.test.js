import test from 'node:test';
import assert from 'node:assert/strict';
import { createTribeService } from '../src/services/tribeService.js';

test('tribe creation goes through the transactional RPC with scoped fields', async () => {
  let call;
  const service = createTribeService({
    async rpc(name, params) {
      call = { name, params };
      return { data: 'tribe-id', error: null };
    },
  });

  const result = await service.createTribe({
    name: 'Northern Forge',
    gameMode: 'ascended',
    characterName: 'Isaac',
    steamId: '76561190000000000',
    usesPropagators: true,
    cooldownHours: '12',
  });

  assert.equal(result.data, 'tribe-id');
  assert.deepEqual(call, {
    name: 'create_tribe_with_breeding',
    params: {
      p_name: 'Northern Forge',
      p_game_mode: 'ascended',
      p_character_name: 'Isaac',
      p_steam_id: '76561190000000000',
      p_uses_propagators: true,
      p_cooldown_hours: 12,
      p_breeding_multiplier: null,
    },
  });
});

test('invite creation sends the raw target only to the protected RPC', async () => {
  let call;
  const service = createTribeService({
    async rpc(name, params) {
      call = { name, params };
      return { data: 'one-time-token', error: null };
    },
  });

  await service.createInvite({
    tribeId: 'tribe-id', targetType: 'email', target: 'member@example.com', role: 'member', expiresHours: '72',
  });

  assert.equal(call.name, 'create_tribe_invite');
  assert.equal(call.params.p_invited_email, 'member@example.com');
  assert.equal(call.params.p_invited_steam_id, null);
  assert.equal('token_hash' in call.params, false);
});
