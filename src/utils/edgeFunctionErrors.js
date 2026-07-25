import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

const commonMessages = {
  authentication_required:
    'Tu sesión expiró o ya no es válida. Inicia sesión nuevamente.',

  billing_disabled:
    'La facturación está desactivada temporalmente.',

  billing_not_configured:
    'PayPal Sandbox todavía necesita configuración privada.',

  paypal_disabled:
    'PayPal Sandbox está desactivado temporalmente.',

  edge_fetch_error:
    'No pudimos conectar con Supabase. Revisa tu conexión e inténtalo nuevamente.',

  edge_relay_error:
    'Supabase no pudo completar la solicitud. Inténtalo nuevamente en unos segundos.',

  edge_unknown_error:
    'Ocurrió un error inesperado al comunicarnos con el servidor.',
};

async function getHttpPayload(error) {
  if (!(error instanceof FunctionsHttpError) || !error.context) {
    return null;
  }

  try {
    const response =
      typeof error.context.clone === 'function'
        ? error.context.clone()
        : error.context;

    return await response.json();
  } catch {
    return null;
  }
}

export async function getEdgeFunctionError(error, data = null) {
  if (!error && !data?.error) return null;

  let payload =
    data && typeof data === 'object'
      ? data
      : null;

  if (error instanceof FunctionsHttpError) {
    payload = (await getHttpPayload(error)) || payload;
  }

  const code =
    typeof payload?.error === 'string'
      ? payload.error
      : typeof payload?.code === 'string'
        ? payload.code
        : null;

  if (code) {
    return {
      code,
      status:
        error instanceof FunctionsHttpError
          ? error.context?.status ?? null
          : null,
      payload,
    };
  }

  if (error instanceof FunctionsFetchError) {
    return {
      code: 'edge_fetch_error',
      status: null,
      payload: null,
    };
  }

  if (error instanceof FunctionsRelayError) {
    return {
      code: 'edge_relay_error',
      status: null,
      payload: null,
    };
  }

  return {
    code: error?.message || 'edge_unknown_error',
    status:
      error instanceof FunctionsHttpError
        ? error.context?.status ?? null
        : null,
    payload,
  };
}

export async function friendlyEdgeFunctionError(
  error,
  data,
  messages = {},
  fallback = commonMessages.edge_unknown_error,
) {
  const detail = await getEdgeFunctionError(error, data);

  if (!detail) return null;

  if (import.meta.env?.DEV) {
    console.error('[W.E.A.F] Edge Function error', detail);
  }

  return (
    messages[detail.code]
    || commonMessages[detail.code]
    || fallback
  );
}