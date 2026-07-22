const CACHE_NAME = 'weaf-shell-v3';
const OFFLINE_URL = '/offline.html';
const APP_SHELL = ['/', OFFLINE_URL, '/assets/weaf-mark.svg'];
const PRIVATE_PATHS = [
  '/login', '/register', '/reset-password', '/onboarding', '/app', '/admin',
  '/auth', '/functions', '/stripe', '/checkout', '/billing', '/account/billing',
  '/servers/publish', '/servers/success', '/servers/cancel',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function mustUseNetwork(request, url) {
  return request.method !== 'GET'
    || url.origin !== self.location.origin
    || request.headers.has('Authorization')
    || PRIVATE_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
}

function canCache(response) {
  return response.ok
    && !response.redirected
    && response.type !== 'opaque'
    && response.type !== 'opaqueredirect';
}

async function safeCachePut(key, response) {
  if (!response || response.bodyUsed || !canCache(response)) return;
  try {
    const cacheResponse = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, cacheResponse);
  } catch (error) {
    console.warn('weaf_cache_put_failed', error?.message || 'cache_error');
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    await safeCachePut('/', response);
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/')) || caches.match(OFFLINE_URL);
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await safeCachePut(request, response);
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (mustUseNetwork(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (['style', 'script', 'font', 'image'].includes(request.destination)) {
    event.respondWith(cacheFirstAsset(request));
  }
});
