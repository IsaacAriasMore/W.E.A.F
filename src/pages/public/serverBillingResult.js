import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';

export function render({ path }) {
  if (path === '/servers/cancel') {
    const listingId = new URLSearchParams(window.location.search).get('listing_id') || '';
    return `<section class="publish-shell container"><div class="publish-message"><p>Pago cancelado</p><h1>No se realizó ningún cargo nuevo.</h1><p>Tu ficha quedó guardada y no será pública hasta que Stripe confirme un pago.</p><a class="button button-primary" href="/servers/publish?listing_id=${escapeHtml(listingId)}" data-link>Volver a la publicación</a><a class="button button-quiet" href="/servers/owners" data-link>Ver planes</a></div></section>`;
  }
  return `<section class="publish-shell container"><div class="publish-message" data-checkout-result><p>Pago recibido</p><h1>Estamos confirmando tu suscripción.</h1><p>La publicación se activará al recibir el webhook firmado de Stripe.</p></div></section>`;
}

export function bind({ path, authService }) {
  if (path !== '/servers/success') return;
  const service = createServerService(authService.getClient());
  const target = document.querySelector('[data-checkout-result]');
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  let canceled = false;
  async function check(attempt = 0) {
    const result = await service.getMyBilling();
    if (canceled) return;
    const listing = result.data?.listings?.find((item) => item.stripe_checkout_session_id === sessionId);
    if (listing?.status === 'active') {
      target.innerHTML = `<p>Suscripción activa</p><h1>${escapeHtml(listing.title)} ya está publicado.</h1><p>Plan ${escapeHtml(listing.plan_type || listing.plan)} vigente hasta ${new Date(listing.expires_at).toLocaleDateString('es-CR')}.</p><a class="button button-primary" href="/servers" data-link>Ver en el directorio</a><a class="button button-quiet" href="/account/billing" data-link>Administrar facturación</a>`;
      return;
    }
    if (result.error) {
      target.innerHTML = `<h1>No pudimos consultar el estado.</h1><p>${escapeHtml(result.error)}</p>`;
      return;
    }
    if (attempt < 6) window.setTimeout(() => check(attempt + 1), 2000);
    else target.innerHTML = '<p>Confirmación pendiente</p><h1>Stripe aún no envía el webhook.</h1><p>No vuelvas a pagar. Revisa esta página en unos instantes.</p><a class="button button-primary" href="/servers/publish" data-link>Ver mis publicaciones</a>';
  }
  check();
  return () => { canceled = true; };
}
