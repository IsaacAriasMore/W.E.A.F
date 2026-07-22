import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const motion = readFileSync(new URL('../src/utils/motion.js', import.meta.url), 'utf8');
const motionCss = readFileSync(new URL('../src/css/motion.css', import.meta.url), 'utf8');
const gsapMotion = readFileSync(new URL('../src/utils/gsapMotion.js', import.meta.url), 'utf8');
const lottieMotion = readFileSync(new URL('../src/components/visuals/LottieMotion.js', import.meta.url), 'utf8');

test('public motion uses IntersectionObserver with a cleanup path', () => {
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /observer\.disconnect\(\)/);
  assert.match(motion, /classList\.add\('reveal-pending'/);
  assert.match(motionCss, /\.pending:not\(\.visible\)/);
  assert.doesNotMatch(motion, /addEventListener\(['"]scroll/);
});
test('public motion has an explicit reduced-motion fallback', () => {
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motionCss, /prefers-reduced-motion: reduce/);
});

test('advanced motion is route-scoped and cleaned up', () => {
  assert.match(gsapMotion, /ALLOWED_PATHS/);
  assert.match(gsapMotion, /routeKind === 'admin'/);
  assert.match(gsapMotion, /context\?\.revert\(\)/);
  assert.match(motion, /export function cleanupMotion/);
});

test('lottie stays optional and keeps a CSS fallback', () => {
  assert.match(lottieMotion, /lottie-fallback/);
  assert.match(lottieMotion, /getFallbackVariant/);
  assert.match(lottieMotion, /dataset\.lottieVariant/);
  assert.match(lottieMotion, /import\('@lottiefiles\/dotlottie-web'\)/);
  assert.match(lottieMotion, /animation\?\.destroy\(\)/);
  assert.match(motionCss, /data-lottie-variant='success'/);
  assert.match(motionCss, /weaf-skeleton-sweep/);
});
