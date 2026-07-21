export function createTribeStore(storage = window.localStorage) {
  let state = { memberships: [], activeTribeId: storage.getItem('weaf:active-tribe'), members: [], invites: [] };

  return {
    getState: () => state,
    setMemberships(memberships) {
      state = { ...state, memberships };
    },
    selectTribe(tribeId) {
      state = { ...state, activeTribeId: tribeId };
      if (tribeId) storage.setItem('weaf:active-tribe', tribeId);
    },
    setWorkspace({ members, invites }) {
      state = { ...state, members, invites };
    },
    clear() {
      state = { memberships: [], activeTribeId: null, members: [], invites: [] };
      storage.removeItem('weaf:active-tribe');
    },
  };
}
