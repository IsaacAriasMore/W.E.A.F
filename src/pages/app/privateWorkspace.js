import { createTribeService } from '../../services/tribeService.js';
import { createTribeStore } from '../../stores/tribeStore.js';

export async function resolvePrivateWorkspace({ state, authService }) {
  const tribeService = createTribeService(authService.getClient());
  const tribeStore = createTribeStore();
  const membershipsResult = await tribeService.listMemberships(state.session.user.id);
  if (membershipsResult.error) return { error: membershipsResult.error };
  if (!membershipsResult.data.length) return { empty: true, memberships: [] };

  tribeStore.setMemberships(membershipsResult.data);
  const requestedId = new URLSearchParams(window.location.search).get('tribe');
  const storedId = tribeStore.getState().activeTribeId;
  const activeMembership = membershipsResult.data.find((item) => item.tribe_id === requestedId)
    || membershipsResult.data.find((item) => item.tribe_id === storedId)
    || membershipsResult.data[0];
  tribeStore.selectTribe(activeMembership.tribe_id);

  return {
    memberships: membershipsResult.data,
    activeMembership,
    tribeStore,
  };
}

export function tribePath(path, tribeId) {
  return `${path}?tribe=${encodeURIComponent(tribeId)}`;
}
