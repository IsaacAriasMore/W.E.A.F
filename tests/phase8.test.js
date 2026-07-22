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
  assert.match(worker, /weaf-shell-v5/);
  assert.match(worker, /request\.method !== 'GET'/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /request\.headers\.has\('Authorization'\)/);
  assert.match(worker, /response\.clone\(\)/);
  assert.match(worker, /response\.bodyUsed/);
  assert.match(worker, /!response\.redirected/);
  assert.match(worker, /response\.type !== 'opaque'/);
  assert.match(worker, /safeCachePut/);
  assert.match(worker, /\/servers\/publish/);
  assert.match(worker, /OFFLINE_URL/);
  assert.match(read('index.html'), /<meta name="mobile-web-app-capable" content="yes" \/>/);
});

test('production example exposes only client-safe configuration', () => {
  const example = read('.env.example');
  assert.match(example, /VITE_SUPABASE_URL=https:\/\/vwxqewpvtucygbaethkv\.supabase\.co/);
  assert.match(example, /VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_/);
  assert.match(example, /VITE_BILLING_ENABLED=true/);
  assert.match(example, /VITE_STRIPE_ENABLED=true/);
  assert.match(example, /VITE_PUBLIC_SITE_URL=https:\/\/weaf\.vercel\.app/);
  assert.match(example, /STRIPE_SECRET_KEY=sk_test_xxx/);
  assert.match(example, /STRIPE_WEBHOOK_SECRET=whsec_xxx/);
  assert.doesNotMatch(example, /sk_live_[A-Za-z0-9]/);
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
  ];
  allowedPages.forEach((path) => assert.match(read(path), /createSponsoredServerSlot/));
  protectedPages.forEach((path) => assert.doesNotMatch(read(path), /createSponsoredServerSlot/));
  assert.match(read('src/pages/public/serverPublish.js'), /server_publish_example[\s\S]*preview: true/);
  assert.match(read('src/pages/public/serverPublish.js'), /data-publish-form data-motion="none"/);
});

test('sponsored tracking requires measurement consent', () => {
  const slots = read('src/components/ads/SponsoredServerSlot.js');
  assert.match(slots, /hasMeasurementConsent\(\)/);
  assert.match(slots, /provider !== 'internal'/);
});
