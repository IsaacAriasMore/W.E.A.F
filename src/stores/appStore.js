export function createAppStore(initialState = {}) {
  let state = {
    ready: false,
    configured: false,
    session: null,
    profile: null,
    ...initialState,
  };
  const listeners = new Set();

  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
