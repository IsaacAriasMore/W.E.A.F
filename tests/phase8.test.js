import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('cookie consent separates necessary, analytics and advertising preferences', () => {
  const service = read('src/services/consentService.js');
  const manager = read('src/components/privacy/ConsentManager.js');
  assert.match(service, /necessary: true/);
  assert.match(service, /analytics: false/);
  assert.match(service, /advertising: false/);
  assert.match(manager, /Solo necesarias/);
  assert.match(manager, /Preferencias de privacidad/);
  assert.doesNotMatch(service, /document\.cookie/);
});

test('PWA manifest, service worker and required icons are present', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/?source=pwa');
  assert.equal(manifest.icons.length, 4);
  for (const path of ['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/apple-touch-icon.png']) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} is missing`);
  }
  const worker = read('public/sw.js');
  assert.match(worker, /weaf-shell-v2/);
  assert.match(worker, /request\.method !== 'GET'/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /request\.headers\.has\('Authorization'\)/);
  assert.match(worker, /response\.clone\(\)/);
  assert.match(worker, /!response\.redirected/);
  assert.match(worker, /response\.type !== 'opaque'/);
  assert.match(worker, /safeCachePut/);
  assert.match(worker, /\/servers\/publish/);
  assert.match(worker, /OFFLINE_URL/);
  assert.match(read('index.html'), /<meta name="mobile-web-app-capable" content="yes" \/>/);
});

test('sponsored placements avoid critical forms and checkout', () => {
  const allowedPages = [
    'src/pages/public/home.js',
    'src/pages/public/inis.js',
    'src/pages/public/mapsBosses.js',
    'src/pages/public/creatures.js',
    'src/pages/public/servers.js',
    'src/pages/app/tribeDashboard.js',
  ];
  const protectedPages = [
    'src/pages/app/breedingWorkspace.js',
    'src/pages/app/tribeSettings.js',
    'src/pages/public/serverPublish.js',
    'src/pages/public/serverOwners.js',
  ];
  allowedPages.forEach((path) => assert.match(read(path), /createSponsoredServerSlot/));
  protectedPages.forEach((path) => assert.doesNotMatch(read(path), /createSponsoredServerSlot/));
});

test('sponsored tracking requires measurement consent', () => {
  const slots = read('src/components/ads/SponsoredServerSlot.js');
  assert.match(slots, /hasMeasurementConsent\(\)/);
  assert.match(slots, /provider !== 'internal'/);
});
