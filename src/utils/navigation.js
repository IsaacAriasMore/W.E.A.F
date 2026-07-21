export function safeInternalDestination(value, fallback = '/app') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replaceAll('\\', '/');
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return fallback;
  const url = new URL(normalized, 'https://weaf.invalid');
  if (url.origin !== 'https://weaf.invalid') return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function destinationFromSearch(search = window.location.search, fallback = '/app') {
  return safeInternalDestination(new URLSearchParams(search).get('next'), fallback);
}

export function pathWithNext(path, destination) {
  return destination ? `${path}?next=${encodeURIComponent(destination)}` : path;
}
