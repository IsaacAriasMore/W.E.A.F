const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const activityEvents = ['click', 'keydown', 'touchstart'];

export function createInactivityLogout({
  onExpire,
  timeoutMs = FOUR_HOURS_MS,
  eventTarget = document,
  clock = () => Date.now(),
  storage = window.localStorage,
  storageKey = 'weaf:last-activity',
  resetOnStart = true,
} = {}) {
  let timeoutId = null;
  let lastMouseReset = 0;
  let running = false;

  const readLastActivity = () => Number(storage?.getItem(storageKey)) || clock();

  const schedule = () => {
    window.clearTimeout(timeoutId);
    const remaining = Math.max(0, timeoutMs - (clock() - readLastActivity()));
    timeoutId = window.setTimeout(expire, remaining);
  };

  const markActivity = () => {
    if (!running) return;
    storage?.setItem(storageKey, String(clock()));
    schedule();
  };

  const onMouseMove = () => {
    const now = clock();
    if (now - lastMouseReset < 60_000) return;
    lastMouseReset = now;
    markActivity();
  };

  const onVisibilityChange = () => {
    if (eventTarget.visibilityState === 'visible') {
      if (clock() - readLastActivity() >= timeoutMs) expire();
      else markActivity();
    }
  };

  const onStorage = (event) => {
    if (event.key === storageKey) schedule();
  };

  async function expire() {
    if (!running) return;
    stop();
    await onExpire?.();
  }

  function start() {
    if (running) return;
    running = true;
    activityEvents.forEach((event) => eventTarget.addEventListener(event, markActivity, { passive: true }));
    eventTarget.addEventListener('mousemove', onMouseMove, { passive: true });
    eventTarget.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', onStorage);
    const storedActivity = Number(storage?.getItem(storageKey));
    if (!resetOnStart && storedActivity && clock() - storedActivity >= timeoutMs) {
      expire();
      return;
    }
    markActivity();
  }

  function stop() {
    running = false;
    window.clearTimeout(timeoutId);
    activityEvents.forEach((event) => eventTarget.removeEventListener(event, markActivity));
    eventTarget.removeEventListener('mousemove', onMouseMove);
    eventTarget.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('storage', onStorage);
  }

  return { start, stop, markActivity };
}

export { FOUR_HOURS_MS };
