import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const motion = readFileSync(new URL('../src/utils/motion.js', import.meta.url), 'utf8');
const publicCss = readFileSync(new URL('../src/css/public.css', import.meta.url), 'utf8');

test('public motion uses IntersectionObserver with a cleanup path', () => {
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /observer\.disconnect\(\)/);
  assert.doesNotMatch(motion, /addEventListener\(['"]scroll/);
});
test('public motion has an explicit reduced-motion fallback', () => {
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(publicCss, /prefers-reduced-motion: no-preference/);
});
