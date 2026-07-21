import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';

const value = (item, key, fallback = '') => escapeHtml(String(item?.[key] ?? fallback));
const join = (items) => escapeHtml(items?.join(', ') || '');

function form(subscription, listing) {
  return `<form class="publish-form" data-publish-form data-subscription="${subscription.id}" data-listing="${listing?.id || ''}"><header><p>${listing ? 'Editar publicación' : 'Completar publicación'}</p><h2>${listing ? escapeHtml(listing.title) : `Plan ${escapeHtml(subscription.plan_name)}`}</h2><span>Activo hasta ${new Date(subscription.current_period_end).toLocaleDateString('es-CR')}</span></header>
    <div class="publish-fields"><label><span>Título</span><input name="title" value="${value(listing,'title')}" minlength="2" maxlength="100" required></label><label><span>Slug público</span><input name="slug" value="${value(listing,'slug')}" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required></label>
    <div><label><span>Juego</span><select name="game"><option value="ascended" ${listing?.game === 'ascended' ? 'selected' : ''}>ASA</option><option value="evolved" ${listing?.game === 'evolved' ? 'selected' : ''}>ASE</option></select></label><label><span>Modo</span><select name="server_type"><option value="pve" ${listing?.server_type === 'pve' ? 'selected' : ''}>PvE</option><option value="pvp" ${listing?.server_type === 'pvp' ? 'selected' : ''}>PvP</option><option value="pvpve" ${listing?.server_type === 'pvpve' ? 'selected' : ''}>PvPvE</option></select></label></div>
    <div><label><span>Región</span><input name="region" value="${value(listing,'region')}" required></label><label><span>Idioma</span><input name="language" value="${value(listing,'language')}" required></label></div>
    <label><span>Plataformas, por coma</span><input name="platforms" value="${join(listing?.platforms)}" placeholder="Steam, Crossplay" required></label><label><span>Mapas, por coma</span><input name="maps" value="${join(listing?.maps)}" required></label><label><span>Mods, por coma</span><input name="mods" value="${join(listing?.mods)}"></label>
    <div><label><span>Cluster</span><input name="cluster_name" value="${value(listing,'cluster_name')}"></label><label><span>Último wipe</span><input name="wipe_date" type="date" value="${value(listing,'wipe_date')}"></label></div>
    <label><span>Rates (JSON)</span><input name="rates" value='${escapeHtml(JSON.stringify(listing?.rates || { XP: '3x', Taming: '5x' }))}' required></label><label><span>Discord</span><input name="discord" type="url" value="${value(listing,'discord_invite_url')}" placeholder="https://discord.gg/..." required></label><label><span>Sitio web</span><input name="website" type="url" value="${value(listing,'website_url')}"></label><label><span>Banner</span><input name="banner" type="url" value="${value(listing,'banner_url')}"></label><label><span>Descripción</span><textarea name="description" minlength="20" maxlength="4000" rows="6" required>${value(listing,'description')}</textarea></label><label class="publish-check"><input name="propagators" type="checkbox" ${listing?.uses_propagators ? 'checked' : ''}><span>Este servidor usa propagadores</span></label></div><footer><p>Los cambios se publican inmediatamente.</p><button class="button button-primary" type="submit">${listing ? 'Guardar cambios' : 'Publicar servidor'}</button></footer></form>`;
}

export function render() {
  return `<section class="publish-shell container"><header><a href="/servers/owners" data-link>← Planes</a><p>Cuenta de servidor</p><h1>Tu publicación, bajo control.</h1></header><div data-publish-workspace class="publish-loading"><span></span><p>Verificando el estado de Stripe…</p></div></section>`;
}

export function bind({ authService }) {
  const service = createServerService(authService.getClient());
  const workspace = document.querySelector('[data-publish-workspace]');
  const query = new URLSearchParams(window.location.search);
  const chosenPlan = ['normal','plus'].includes(query.get('plan')) ? query.get('plan') : null;

  async function load(attempt = 0) {
    const result = await service.getMyBilling();
    if (result.error) { workspace.innerHTML = `<div class="publish-message"><h2>No pudimos abrir tu cuenta.</h2><p>${escapeHtml(result.error)}</p></div>`; return; }
    const subscriptions = result.data?.subscriptions || [];
    const listings = result.data?.listings || [];
    const available = subscriptions.find((item) => ['active','trialing'].includes(item.status) && new Date(item.current_period_end) > new Date());
    if (!available && query.get('checkout') === 'success' && attempt < 6) { workspace.innerHTML = '<div class="publish-message"><h2>Confirmando tu pago…</h2><p>Stripe ya nos devolvió el control. Esperamos la confirmación firmada antes de habilitar el formulario.</p></div>'; window.setTimeout(() => load(attempt + 1), 2000); return; }
    if (available) { const listing = listings.find((item) => item.id === available.listing_id); workspace.className = 'publish-workspace'; workspace.innerHTML = form(available, listing); return; }
    workspace.className = 'publish-message';
    workspace.innerHTML = `<h2>${query.get('checkout') === 'success' ? 'La confirmación aún no llegó.' : 'Elige un plan para publicar.'}</h2><p>${query.get('checkout') === 'success' ? 'No cobraremos de nuevo. Recarga esta página en unos instantes o revisa Stripe.' : 'Checkout se abre en Stripe y W.E.A.F solo activa la ficha después del webhook firmado.'}</p>${chosenPlan ? `<button class="button button-primary" type="button" data-start-checkout="${chosenPlan}">Continuar con ${escapeHtml(chosenPlan)}</button>` : '<a class="button button-secondary" href="/servers/owners" data-link>Ver planes</a>'}`;
  }

  workspace.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-start-checkout]');
    if (!button) return;
    button.disabled = true; button.textContent = 'Abriendo Stripe…';
    const result = await service.startCheckout(button.dataset.startCheckout);
    if (result.error) { showToast(result.error, 'error'); button.disabled = false; button.textContent = 'Intentar de nuevo'; return; }
    window.location.assign(result.data.checkoutUrl);
  });

  workspace.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-publish-form]')) return;
    event.preventDefault(); const button = event.target.querySelector('button[type="submit"]'); button.disabled = true;
    const values = new FormData(event.target); const split = (name) => values.get(name).split(',').map((item) => item.trim()).filter(Boolean);
    let rates; try { rates = JSON.parse(values.get('rates')); } catch { showToast('Rates debe ser JSON válido.', 'error'); button.disabled = false; return; }
    const payload = { title: values.get('title').trim(), slug: values.get('slug').trim(), game: values.get('game'), server_type: values.get('server_type'), region: values.get('region').trim(), language: values.get('language').trim(), platforms: split('platforms'), maps: split('maps'), mods: split('mods'), gallery_urls: [], rates, discord_invite_url: values.get('discord').trim(), website_url: values.get('website').trim(), banner_url: values.get('banner').trim(), description: values.get('description').trim(), cluster_name: values.get('cluster_name').trim(), wipe_date: values.get('wipe_date'), uses_propagators: values.has('propagators') };
    const listingId = event.target.dataset.listing;
    const result = listingId ? await service.updateListing(listingId, payload) : await service.createListing(event.target.dataset.subscription, payload);
    if (result.error) { showToast(result.error, 'error'); button.disabled = false; return; }
    showToast(listingId ? 'Cambios publicados.' : 'Servidor publicado.'); await load();
  });
  load();
}
