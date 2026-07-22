import test from 'node:test';
import assert from 'node:assert/strict';
import { safeInternalDestination } from '../src/utils/navigation.js';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('internal destinations preserve invite queries and reject external redirects', () => {
  assert.equal(safeInternalDestination('/app?invite=one-time-token'), '/app?invite=one-time-token');
  assert.equal(safeInternalDestination('//attacker.example', '/app'), '/app');
  assert.equal(safeInternalDestination('/\\attacker.example', '/app'), '/app');
});

test('SPA navigation preserves hashes and scrolls after rendering', () => {
  const router = read('src/router.js');
  const app = read('src/App.js');
  const header = read('src/components/layout/PublicHeader.js');
  assert.match(router, /const nextUrl = `\$\{path\}\$\{url\.search\}\$\{url\.hash\}`/);
  assert.match(router, /replaceState\(\{\}, '', `\$\{normalizePath\(url\.pathname\)\}\$\{url\.search\}\$\{url\.hash\}`\)/);
  assert.match(router, /scrollToCurrentHash/);
  assert.match(router, /scrollIntoView\(\{ behavior, block: 'start' \}\)/);
  assert.match(app, /link\.pathname\}\$\{link\.search\}\$\{link\.hash/);
  assert.match(header, /link\.pathname\}\$\{link\.search\}\$\{link\.hash/);
});
