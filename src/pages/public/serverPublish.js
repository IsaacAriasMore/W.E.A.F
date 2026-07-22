import { REAL_STRIPE_BILLING } from '../../config/billing.js';
import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';

const value = (item, key, fallback = '') => escapeHtml(String(item?.[key] ?? fallback));
const join = (items) => escapeHtml(items?.join(', ') || '');
const planLabel = (plan) => plan === 'plus' ? 'Plus · $7 USD/mes' : 'Normal · $3 USD/mes';

function form(plan, listing) {
  const paidAndActive = listing?.status === 'active';
  return `<form class="publish-form" data-publish-form data-listing="${listing?.id || ''}" data-plan="${plan}">
    <header><p>${listing ? 'Editar publicación' : 'Nueva publicación'}</p><h2>${listing ? escapeHtml(listing.title) : planLabel(plan)}</h2><span>${paidAndActive ? `Activa hasta ${listing.expires_at ? new Date(listing.expires_at).toLocaleDateString('es-CR') : 'nuevo aviso'}` : 'La ficha se activará únicamente con el webhook firmado de Stripe.'}</span></header>
    <div class="publish-fields"><label><span>Título</span><input name="title" value="${value(listing, 'title')}" minlength="2" maxlength="100" required></label><label><span>Slug público</span><input name="slug" value="${value(listing, 'slug')}" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required></label>
    <div><label><span>Juego</span><select name="game"><option value="ascended" ${listing?.game === 'ascended' ? 'selected' : ''}>ASA</option><option value="evolved" ${listing?.game === 'evolved' ? 'selected' : ''}>ASE</option><option value="both" ${listing?.game === 'both' ? 'selected' : ''}>ASE + ASA</option></select></label><label><span>Modo</span><select name="server_type"><option value="pve" ${listing?.server_type === 'pve' ? 'selected' : ''}>PvE</option><option value="pvp" ${listing?.server_type === 'pvp' ? 'selected' : ''}>PvP</option><option value="pvpve" ${listing?.server_type === 'pvpve' ? 'selected' : ''}>PvPvE</option></select></label></div>
    <div><label><span>Región</span><input name="region" value="${value(listing, 'region')}" required></label><label><span>Idioma</span><input name="language" value="${value(listing, 'language')}" required></label></div>
    <label><span>Plataformas, por coma</span><input name="platforms" value="${join(listing?.platforms)}" placeholder="Steam, Crossplay" required></label><label><span>Mapas, por coma</span><input name="maps" value="${join(listing?.maps)}" required></label><label><span>Mods, por coma</span><input name="mods" value="${join(listing?.mods)}"></label>
    <div><label><span>Cluster</span><input name="cluster_name" value="${value(listing, 'cluster_name')}"></label><label><span>Último wipe</span><input name="wipe_date" type="date" value="${value(listing, 'wipe_date')}"></label></div>
    <label><span>Rates (JSON)</span><input name="rates" value='${escapeHtml(JSON.stringify(listing?.rates || { XP: '3x', Taming: '5x' }))}' required></label><label><span>Discord</span><input name="discord" type="url" value="${value(listing, 'discord_invite_url')}" placeholder="https://discord.gg/..." required></label><label><span>Sitio web</span><input name="website" type="url" value="${value(listing, 'website_url')}"></label><label><span>Banner</span><input name="banner" type="url" value="${value(listing, 'banner_url')}"></label><label><span>Descripción</span><textarea name="description" minlength="20" maxlength="4000" rows="6" required>${value(listing, 'description')}</textarea></label><label class="publish-check"><input name="propagators" type="checkbox" ${listing?.uses_propagators ? 'checked' : ''}><span>Este servidor usa propagadores</span></label></div>
    <footer><p>${paidAndActive ? 'Los cambios se publican inmediatamente.' : REAL_STRIPE_BILLING ? 'Serás redirigido a Stripe Checkout.' : 'Se guardará como pendiente para activación administrativa.'}</p><button class="button button-primary" type="submit">${paidAndActive ? 'Guardar cambios' : REAL_STRIPE_BILLING ? 'Continuar al pago' : 'Guardar borrador'}</button></footer>
  </form>`;
}

function dashboard(listings, hasCustomer) {
  if (!listings.length) return `<div class="publish-message"><h2>Aún no tienes publicaciones.</h2><p>Elige Normal o Plus, completa la ficha y continúa al pago seguro.</p><a class="button button-primary" href="/servers/owners" data-link>Ver planes</a></div>`;
  return `<div class="publish-message"><h2>Tus publicaciones</h2><p>Consulta su estado, edita la ficha o administra la suscripción.</p><div class="billing-list">${listings.map((listing) => `<article><strong>${escapeHtml(listing.title)}</strong><span>${escapeHtml(listing.status)} · ${escapeHtml(listing.plan_type || listing.plan)}</span><a class="button button-secondary" href="/servers/publish?listing_id=${listing.id}" data-link>Editar</a></article>`).join('')}</div><div class="server-card-actions">${hasCustomer && REAL_STRIPE_BILLING ? '<button class="button button-primary" type="button" data-billing-portal>Administrar facturación</button>' : ''}<a class="button button-quiet" href="/servers/owners" data-link>Nueva publicación</a></div></div>`;
}

export function render() {
  return `<section class="publish-shell container"><header><a href="/servers/owners" data-link>← Planes</a><p>Cuenta de servidor</p><h1>Tu publicación, bajo control.</h1></header><div data-publish-workspace class="publish-loading"><span></span><p>Cargando tus publicaciones…</p></div></section>`;
}

export function bind({ authService, navigate }) {
  const service = createServerService(authService.getClient());
  const workspace = document.querySelector('[data-publish-workspace]');
  const query = new URLSearchParams(window.location.search);
  const chosenPlan = ['normal', 'plus'].includes(query.get('plan')) ? query.get('plan') : null;
  const requestedListingId = query.get('listing_id');
  let selectedListing = null;

  async function load() {
    const result = await service.getMyBilling();
    if (result.error) {
      workspace.className = 'publish-message';
      workspace.innerHTML = `<h2>No pudimos abrir tu cuenta.</h2><p>${escapeHtml(result.error)}</p>`;
      return;
    }
    const listings = result.data?.listings || [];
    selectedListing = requestedListingId ? listings.find((item) => item.id === requestedListingId) : null;
    if (requestedListingId && !selectedListing) {
      workspace.className = 'publish-message';
      workspace.innerHTML = '<h2>Publicación no disponible.</h2><p>Solo puedes editar publicaciones que te pertenecen.</p>';
      return;
    }
    if (selectedListing || chosenPlan) {
      const plan = selectedListing?.plan_type || selectedListing?.plan || chosenPlan;
      workspace.className = 'publish-workspace';
      workspace.innerHTML = form(plan === 'manual' ? 'normal' : plan, selectedListing);
      return;
    }
    workspace.className = 'publish-workspace';
    workspace.innerHTML = dashboard(listings, Boolean(result.data?.has_customer));
  }

  workspace.addEventListener('click', async (event) => {
    const portal = event.target.closest('[data-billing-portal]');
    if (!portal) return;
    portal.disabled = true;
    portal.textContent = 'Abriendo Stripe…';
    const result = await service.openBillingPortal();
    if (result.error) {
      showToast(result.error, 'error');
      portal.disabled = false;
      portal.textContent = 'Administrar facturación';
      return;
    }
    window.location.assign(result.data.url);
  });

  workspace.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-publish-form]')) return;
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true;
    const values = new FormData(event.target);
    const split = (name) => String(values.get(name) || '').split(',').map((item) => item.trim()).filter(Boolean);
    let rates;
    try { rates = JSON.parse(values.get('rates')); } catch {
      showToast('Rates debe ser JSON válido.', 'error');
      button.disabled = false;
      return;
    }
    const payload = {
      title: values.get('title').trim(), slug: values.get('slug').trim(), game: values.get('game'), server_type: values.get('server_type'),
      region: values.get('region').trim(), language: values.get('language').trim(), platforms: split('platforms'), maps: split('maps'), mods: split('mods'),
      gallery_urls: [], rates, discord_invite_url: values.get('discord').trim(), website_url: values.get('website').trim(), banner_url: values.get('banner').trim(),
      description: values.get('description').trim(), cluster_name: values.get('cluster_name').trim(), wipe_date: values.get('wipe_date'), uses_propagators: values.has('propagators'),
    };
    const plan = event.target.dataset.plan;
    const result = await service.saveListingDraft(event.target.dataset.listing || null, plan, payload);
    if (result.error) {
      showToast(result.error, 'error');
      button.disabled = false;
      return;
    }
    const listingId = result.data;
    if (selectedListing?.status === 'active') {
      showToast('Cambios publicados.');
      await load();
      return;
    }
    if (!REAL_STRIPE_BILLING) {
      showToast('Borrador guardado. La activación será administrativa.');
      navigate(`/servers/publish?listing_id=${listingId}`);
      return;
    }
    button.textContent = 'Abriendo Stripe…';
    const checkout = await service.startCheckout(listingId, plan);
    if (checkout.error) {
      showToast(checkout.error, 'error');
      button.disabled = false;
      button.textContent = 'Continuar al pago';
      return;
    }
    window.location.assign(checkout.data.url);
  });

  load();
}
