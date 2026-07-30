import test from 'node:test';
import assert from 'node:assert/strict';
import { median } from '../scripts/lighthouse-audit.mjs';

test('median returns middle value for odd-length integer arrays', () => {
  assert.equal(median([2513, 2524, 2512]), 2513);
});

test('median returns middle value when two values repeat', () => {
  assert.equal(median([89, 97, 97]), 97);
});

test('median works with decimal CLS values', () => {
  assert.equal(median([0.05, 0.02, 0.08]), 0.05);
});

test('median handles two values', () => {
  assert.equal(median([100, 200]), 200);
});

test('median handles single value', () => {
  assert.equal(median([42]), 42);
});

test('median handles all equal values', () => {
  assert.equal(median([50, 50, 50]), 50);
});

test('median does not mutate input array', () => {
  const input = [3, 1, 2];
  const copy = [...input];
  median(input);
  assert.deepEqual(input, copy);
});

test('median handles negative values', () => {
  assert.equal(median([-5, 0, 5]), 0);
});
