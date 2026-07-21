import test from 'node:test';
import assert from 'node:assert/strict';
import { createTribeStore } from '../src/stores/tribeStore.js';

test('tribe selection persists without storing private tribe data', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const store = createTribeStore(storage);
  store.setMemberships([{ tribe_id: 'tribe-a', role: 'owner' }]);
  store.selectTribe('tribe-a');

  assert.equal(store.getState().activeTribeId, 'tribe-a');
  assert.equal(values.get('weaf:active-tribe'), 'tribe-a');
  assert.equal(values.size, 1);
});
