import test from 'node:test';
import assert from 'node:assert/strict';
import { createBreedService } from '../src/services/breedService.js';

test('breed creation is scoped to a tribe and starts with empty mutations', async () => {
  let call;
  const service = createBreedService({
    async rpc(name, params) {
      call = { name, params };
      return { data: 'breed-id', error: null };
    },
  });

  const result = await service.createBreed({
    tribeId: 'tribe-id',
    speciesId: 'species-id',
    title: 'Rex health line',
    targetStats: { health: 50 },
    notes: 'Prioridad de la tribu',
  });

  assert.equal(result.data, 'breed-id');
  assert.deepEqual(call, {
    name: 'create_breed',
    params: {
      p_tribe_id: 'tribe-id',
      p_species_id: 'species-id',
      p_title: 'Rex health line',
      p_target_stats: { health: 50 },
      p_current_mutations: {},
      p_notes: 'Prioridad de la tribu',
    },
  });
});

test('mutation registration sends only the selected breed and tribe', async () => {
  let call;
  const service = createBreedService({
    async rpc(name, params) {
      call = { name, params };
      return { data: { mutation_id: 'mutation-id' }, error: null };
    },
  });

  await service.registerMutation({
    tribeId: 'tribe-id', breedId: 'breed-id', stats: { melee: 2 }, notes: '',
  });

  assert.deepEqual(call, {
    name: 'register_breed_mutation',
    params: {
      p_tribe_id: 'tribe-id',
      p_breed_id: 'breed-id',
      p_stats: { melee: 2 },
      p_notes: null,
    },
  });
});

test('propagator mode does not leak a breeding multiplier into configuration', async () => {
  let call;
  const service = createBreedService({
    async rpc(name, params) {
      call = { name, params };
      return { error: null };
    },
  });

  await service.configureBreeding({
    tribeId: 'tribe-id', usesPropagators: true, cooldownHours: '8', breedingMultiplier: '12',
  });

  assert.equal(call.name, 'configure_tribe_breeding');
  assert.equal(call.params.p_cooldown_hours, 8);
  assert.equal(call.params.p_breeding_multiplier, null);
});

test('Discord notifications use the protected Edge Function', async () => {
  let invocation;
  const service = createBreedService({
    functions: {
      async invoke(name, options) {
        invocation = { name, options };
        return { data: { delivered: true }, error: null };
      },
    },
  });

  const result = await service.notifyDiscord({
    tribeId: 'tribe-id', eventType: 'mutation_created', entityId: 'mutation-id',
  });

  assert.equal(result.error, null);
  assert.deepEqual(invocation, {
    name: 'notify-discord-tribe',
    options: {
      body: { tribeId: 'tribe-id', eventType: 'mutation_created', entityId: 'mutation-id' },
    },
  });
});
