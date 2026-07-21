import test from 'node:test';
import assert from 'node:assert/strict';
import { safeInternalDestination } from '../src/utils/navigation.js';

test('internal destinations preserve invite queries and reject external redirects', () => {
  assert.equal(safeInternalDestination('/app?invite=one-time-token'), '/app?invite=one-time-token');
  assert.equal(safeInternalDestination('//attacker.example', '/app'), '/app');
  assert.equal(safeInternalDestination('/\\attacker.example', '/app'), '/app');
});
