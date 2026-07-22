import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = read('../src/pages/public/home.js');
const servers = read('../src/pages/public/servers.js');
const owners = read('../src/pages/public/serverOwners.js');
const publish = read('../src/pages/public/serverPublish.js');
const billing = read('../src/pages/public/serverBillingResult.js');

test('public motion targets high-value surfaces without covering the publish form', () => {
  assert.match(home, /data-gsap-hero/);
  assert.match(home, /data-gsap-stagger/);
  assert.match(servers, /server-card interactive-card/);
  assert.match(owners, /data-owner-plans data-gsap-stagger/);
  assert.match(publish, /data-publish-form data-motion="none"/);
  assert.match(publish, /publish-plan-selector[^>]+data-gsap-stagger/);
});

test('Stripe results use optional Lottie assets with a fallback component', () => {
  assert.match(billing, /payment-success\.lottie/);
  assert.match(billing, /payment-cancel\.lottie/);
  assert.match(billing, /mountLottieMotion/);
  assert.match(billing, /cleanupAnimation\(\)/);
});
