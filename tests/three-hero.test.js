import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/visuals/WeafThreeHero.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/pages/public/home.js', import.meta.url), 'utf8');

test('the home WebGL layer is lazy, capped and optional', () => {
  assert.match(source, /import\('three'\)/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /navigator\.connection\?\.saveData/);
  assert.match(home, /data-three-hero/);
});

test('the home WebGL layer pauses and releases GPU resources', () => {
  assert.match(source, /document\.hidden/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /\.dispose\(\)/);
  assert.match(source, /renderer\.domElement\.remove\(\)/);
  assert.match(home, /cleanupThree\(\)/);
});
