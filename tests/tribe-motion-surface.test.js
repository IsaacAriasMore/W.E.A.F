import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const dashboard = read('../src/pages/app/tribeDashboard.js');
const breeding = read('../src/pages/app/breedingWorkspace.js');
const settings = read('../src/pages/app/tribeSettings.js');

test('private async views refresh and clean their CSS motion', () => {
  for (const source of [dashboard, breeding, settings]) {
    assert.match(source, /initScrollAnimations\(view\)/);
    assert.match(source, /initCardHoverEffects\(view\)/);
    assert.match(source, /cleanupViewMotion\(\)/);
  }
});

test('tribe empty states keep Lottie optional and forms out of advanced motion', () => {
  assert.match(dashboard, /empty-tribe\.lottie/);
  assert.match(dashboard, /data-create-tribe-form data-motion="none"/);
  assert.match(breeding, /data-breeding-empty-lottie/);
  assert.match(breeding, /mountLottieMotion/);
});
