import test from 'node:test';
import assert from 'node:assert/strict';

test('expires an authenticated session after the configured idle interval', async () => {
  const windowListeners = new Map();
  globalThis.window = {
    setTimeout,
    clearTimeout,
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    removeEventListener(type) { windowListeners.delete(type); },
  };
  globalThis.document = new EventTarget();

  const { createInactivityLogout } = await import('../src/utils/inactivityLogout.js');
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  let expirations = 0;
  const tracker = createInactivityLogout({
    timeoutMs: 20,
    eventTarget: globalThis.document,
    storage,
    onExpire: () => { expirations += 1; },
  });

  tracker.start();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(expirations, 1);
  assert.equal(windowListeners.size, 0);
});

test('does not reset an already expired persisted session on page reload', async () => {
  globalThis.window = {
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.document = new EventTarget();
  const { createInactivityLogout } = await import('../src/utils/inactivityLogout.js');
  let expirations = 0;
  const tracker = createInactivityLogout({
    timeoutMs: 100,
    resetOnStart: false,
    clock: () => 1_000,
    eventTarget: globalThis.document,
    storage: {
      getItem: () => '800',
      setItem() { throw new Error('expired activity must not be overwritten'); },
    },
    onExpire: () => { expirations += 1; },
  });

  tracker.start();
  await Promise.resolve();
  assert.equal(expirations, 1);
});
