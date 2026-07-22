import { REAL_STRIPE_BILLING } from '../../config/billing.js';
import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';

export function render() {
  return `<section class="publish-shell container"><header><a href="/servers/publish" data-link>← Publicaciones</a><p>Cuenta</p><h1>Facturación de servidores</h1></header><div class="publish-loading" data-billing-workspace><span></span><p>Cargando Stripe…</p></div></section>`;
}

export function bind({ authService }) {
  const service = createServerService(authService.getClient());
  const workspace = document.querySelector('[data-billing-workspace]');
  workspace.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-open-portal]');
    if (!button) return;
    button.disabled = true;
    const result = await service.openBillingPortal();
    if (result.error) { showToast(result.error, 'error'); button.disabled = false; return; }
    window.location.assign(result.data.url);
  });
  service.getMyBilling().then((result) => {
    workspace.className = 'publish-message';
    if (result.error) { workspace.innerHTML = `<h2>No pudimos cargar facturación.</h2><p>${escapeHtml(result.error)}</p>`; return; }
    const listings = result.data?.listings || [];
    workspace.innerHTML = `<h2>Suscripciones y vigencias</h2><div class="billing-list">${listings.length ? listings.map((listing) => `<article><strong>${escapeHtml(listing.title)}</strong><span>${escapeHtml(listing.plan_type || listing.plan)} · ${escapeHtml(listing.payment_status)} · ${escapeHtml(listing.status)}</span>${listing.current_period_end ? `<small>Periodo hasta ${new Date(listing.current_period_end).toLocaleDateString('es-CR')}</small>` : ''}</article>`).join('') : '<p>No tienes publicaciones facturadas.</p>'}</div>${REAL_STRIPE_BILLING && result.data?.has_customer ? '<button class="button button-primary" type="button" data-open-portal>Administrar en Stripe</button>' : '<p>El portal de Stripe no está disponible mientras la facturación esté desactivada.</p>'}`;
  });
}
