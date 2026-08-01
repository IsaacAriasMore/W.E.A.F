const SENSITIVE = /(authorization|bearer|password|passwd|token|secret|service[_-]?role|captcha|paypal)[^\s]*/gi;
const MAX_MESSAGE = 500;
const sent = new Set();

export function sanitizeFrontendErrorMessage(value) {
  const text = value instanceof Error ? value.message : String(value || 'Unexpected error');
  return text.replace(SENSITIVE, '[redacted]').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, MAX_MESSAGE);
}

async function fingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function routeOnly() {
  return window.location.pathname.replace(/[^/A-Za-z0-9_.-]/g, '').slice(0, 180) || '/';
}

export function initializeFrontendErrorMonitor(client, { sampleRate = 0.25 } = {}) {
  if (!client || !globalThis.crypto?.subtle) return () => {};
  let stopped = false;
  const record = async (kind, error, metadata = {}) => {
    if (stopped || Math.random() > sampleRate) return;
    const message = sanitizeFrontendErrorMessage(error);
    const key = await fingerprint(`${kind}|${routeOnly()}|${message}`);
    if (sent.has(key)) return;
    sent.add(key);
    if (sent.size > 100) sent.delete(sent.values().next().value);
    await client.rpc('record_frontend_error', {
      p_fingerprint: key,
      p_kind: kind,
      p_route: routeOnly(),
      p_message: message,
      p_metadata: {
        code: String(metadata.code || '').slice(0, 80),
        source: String(metadata.source || '').slice(0, 80),
        online: navigator.onLine,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    }).catch(() => {});
  };
  const onError = (event) => record('window_error', event.error || event.message, { source: 'window' });
  const onRejection = (event) => record('unhandled_rejection', event.reason, { source: 'promise' });
  const onCustom = (event) => record(event.detail?.kind || 'render', event.detail?.error, event.detail || {});
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('weaf:frontend-error', onCustom);
  return () => {
    stopped = true;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('weaf:frontend-error', onCustom);
  };
}

export function reportFrontendError(kind, error, metadata = {}) {
  window.dispatchEvent(new CustomEvent('weaf:frontend-error', { detail: { kind, error, ...metadata } }));
}
