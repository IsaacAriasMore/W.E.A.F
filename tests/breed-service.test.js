import test from 'node:test';
import assert from 'node:assert/strict';
import { createBreedService } from '../src/services/breedService.js';

test('breed creation is scoped to a tribe with base stats and caretaker', async () => {
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
    baseStats: { health: 50 },
    caretakerUserId: 'member-id',
    notes: 'Prioridad de la tribu',
  });

  assert.equal(result.data, 'breed-id');
  assert.deepEqual(call, {
    name: 'create_breed_v2',
    params: {
      p_tribe_id: 'tribe-id',
      p_species_id: 'species-id',
      p_title: 'Rex health line',
      p_base_stats: { health: 50 },
      p_caretaker_user_id: 'member-id',
      p_notes: 'Prioridad de la tribu',
    },
  });
});

test('stat mutation registration sends the improved value and odd confirmation', async () => {
  let call;
  const service = createBreedService({
    async rpc(name, params) { call = { name, params }; return { data: { mutation_count: 3 }, error: null }; },
  });
  await service.registerStatMutation({
    tribeId: 'tribe-id', breedId: 'breed-id', statKey: 'health', newValue: '61', notes: 'new baby', allowOdd: true,
  });
  assert.deepEqual(call, {
    name: 'register_breed_stat_mutation',
    params: {
      p_tribe_id: 'tribe-id', p_breed_id: 'breed-id', p_stat_key: 'health', p_new_value: 61,
      p_notes: 'new baby', p_allow_odd: true,
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
