import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import {
  initializeFrontendErrorMonitor,
  sanitizeFrontendErrorMessage,
} from '../src/services/frontendErrorMonitor.js';

function installWindow(pathname = '/') {
  const listeners = new Map();
  const previousWindow = globalThis.window;
  const previousCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  }
  globalThis.window = {
    location: { pathname },
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  return {
    emitError(error) { listeners.get('error')?.({ error, message: error?.message }); },
    restore() {
      globalThis.window = previousWindow;
      if (previousCrypto) Object.defineProperty(globalThis, 'crypto', previousCrypto);
      else delete globalThis.crypto;
    },
  };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

test('frontend error monitor accepts Supabase thenables and never leaks its own failures', async (t) => {
  await t.test('awaits a thenable that has no catch method', async () => {
    const page = installWindow('/marketplace');
    const calls = [];
    const cleanup = initializeFrontendErrorMonitor({
      rpc(name, payload) {
        calls.push({ name, payload });
        return { then(resolve) { resolve({ data: null, error: null }); } };
      },
    }, { sampleRate: 1 });
    page.emitError(new Error('thenable-without-catch'));
    await settle();
    cleanup();
    page.restore();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'record_frontend_error');
  });

  await t.test('swallows rejected thenables, synchronous exceptions, and { error } responses', async () => {
    for (const rpc of [
      () => ({ then(_resolve, reject) { reject(new Error('network rejected')); } }),
      () => { throw new Error('synchronous rpc failure'); },
      () => Promise.resolve({ data: null, error: new Error('remote rejected') }),
    ]) {
      const page = installWindow(`/monitor-${Math.random().toString(16).slice(2)}`);
      const cleanup = initializeFrontendErrorMonitor({ rpc }, { sampleRate: 1 });
      page.emitError(new Error(`contained-${Math.random().toString(16).slice(2)}`));
      await settle();
      cleanup();
      page.restore();
    }
    assert.ok(true);
  });

  await t.test('honors sampling and deduplicates matching reports', async () => {
    const samplePage = installWindow('/sampled');
    let sampledCalls = 0;
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    const sampleCleanup = initializeFrontendErrorMonitor({
      rpc() { sampledCalls += 1; return Promise.resolve({ data: null, error: null }); },
    }, { sampleRate: 0.25 });
    samplePage.emitError(new Error('sampled-out'));
    await settle();
    sampleCleanup();
    samplePage.restore();
    Math.random = originalRandom;
    assert.equal(sampledCalls, 0);

    const dedupePage = installWindow('/dedupe');
    let dedupeCalls = 0;
    const dedupeCleanup = initializeFrontendErrorMonitor({
      rpc() { dedupeCalls += 1; return Promise.resolve({ data: null, error: null }); },
    }, { sampleRate: 1 });
    dedupePage.emitError(new Error('same-error'));
    await settle();
    dedupePage.emitError(new Error('same-error'));
    await settle();
    dedupeCleanup();
    dedupePage.restore();
    assert.equal(dedupeCalls, 1);
  });

  await t.test('sanitizes sensitive values and strips query strings and fragments from routes', async () => {
    const page = installWindow('/marketplace?token=not-for-logs#private');
    let payload;
    const cleanup = initializeFrontendErrorMonitor({
      rpc(_name, value) { payload = value; return Promise.resolve({ data: null, error: null }); },
    }, { sampleRate: 1 });
    page.emitError(new Error('Authorization Bearer-supersecret password=hunter2'));
    await settle();
    cleanup();
    page.restore();
    assert.equal(payload.p_route, '/marketplace');
    assert.doesNotMatch(payload.p_message, /supersecret|hunter2/i);
    assert.equal(sanitizeFrontendErrorMessage('bad\u0000value'), 'bad value');
  });
});
