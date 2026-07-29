export function createMarketplaceState() {
  return { status: 'loading', data: null, error: null };
}

export function beginMarketplaceLoad(previous = createMarketplaceState()) {
  return { status: 'loading', data: previous.data ?? null, error: null };
}

export function completeMarketplaceLoad(previous, result) {
  if (result?.error || !result?.data?.setting) {
    return {
      status: 'error',
      data: previous?.data ?? null,
      error: result?.error || 'La respuesta del marketplace está incompleta.',
    };
  }

  return { status: 'loaded', data: result.data, error: null };
}

export function canSaveMarketplace(state) {
  return state?.status === 'loaded' && Boolean(state.data?.setting);
}
