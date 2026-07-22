import { REAL_STRIPE_BILLING } from '../../config/billing.js';
import {
  RATE_FIELDS,
  RATE_PRESETS,
  SERVER_MAPS,
  SERVER_PLATFORMS,
  availableForGame,
  normalizeRates,
} from '../../config/serverListing.js';
import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';

const value = (item, key, fallback = '') => escapeHtml(String(item?.[key] ?? fallback));
const planLabel = (plan) => plan === 'plus' ? 'Plus - $7 USD/mes' : 'Normal - $3 USD/mes';
const checked = (condition) => condition ? 'checked' : '';

function choiceGroup({ legend, help, name, items, selected = [], type = 'checkbox' }) {
  return `<fieldset class="publish-choice-group" data-choice-group="${name}">
    <legend>${legend}</legend><p class="field-help">${help}</p>
    <div class="publish-choices">${items.map((item) => `<label data-game-support="${item.game || 'both'}"><input type="${type}" name="${name}" value="${escapeHtml(item.value || item.name || item.label)}" ${checked(selected.includes(item.value || item.name || item.label))}><span>${escapeHtml(item.label || item.name)}</span></label>`).join('')}</div>
  </fieldset>`;
}
function ratesSection(listing) {
  const rates = listing?.rates || {};
  const preset = rates.preset && (rates.preset === 'custom' || rates.preset in RATE_PRESETS) ? rates.preset : 'not_specified';
  return `<fieldset class="publish-choice-group publish-rates">
    <legend>Rates del servidor</legend>
    <p class="field-help">Los rates son multiplicadores del servidor. Por ejemplo, 5x significa cinco veces más rápido que vanilla/oficial.</p>
    <label><span>Configuración</span><select name="rate_preset" data-rate-preset>
      <option value="not_specified" ${preset === 'not_specified' ? 'selected' : ''}>No estoy seguro / No especificar</option>
      <option value="vanilla" ${preset === 'vanilla' ? 'selected' : ''}>Vanilla / Oficial</option>
      <option value="low" ${preset === 'low' ? 'selected' : ''}>Bajo</option>
      <option value="medium" ${preset === 'medium' ? 'selected' : ''}>Medio</option>
      <option value="high" ${preset === 'high' ? 'selected' : ''}>Alto</option>
      <option value="custom" ${preset === 'custom' ? 'selected' : ''}>Personalizado</option>
    </select></label>
    <div class="rate-grid" data-custom-rates ${preset === 'custom' ? '' : 'hidden'}>${RATE_FIELDS.map(([key, label, help]) => `<label><span>${label}</span><input name="rate_${key}" type="number" inputmode="decimal" min="0.01" max="1000" step="0.01" value="${escapeHtml(String(rates[key] ?? 1))}"><small>${help}</small></label>`).join('')}</div>
  </fieldset>`;
}

function form(plan, listing) {
  const paidAndActive = listing?.status === 'active';
  const game = listing?.game || 'ascended';
  return `<form class="publish-form" data-publish-form data-listing="${listing?.id || ''}" data-plan="${plan}" novalidate>
    <header><p>${listing ? 'Editar publicación' : 'Nueva publicación'}</p><h2>${listing ? escapeHtml(listing.title) : planLabel(plan)}</h2><span>${paidAndActive ? `Activa hasta ${listing.expires_at ? new Date(listing.expires_at).toLocaleDateString('es-CR') : 'nuevo aviso'}` : 'La ficha se activa únicamente cuando Stripe confirma el pago.'}</span></header>
    <div class="publish-fields">
      <fieldset class="publish-section"><legend>Información básica</legend>
        <label><span>Nombre del servidor</span><input name="title" value="${value(listing, 'title')}" minlength="2" maxlength="100" placeholder="Ej. Forja del Sur" required></label>
        <label><span>Descripción</span><textarea name="description" minlength="20" maxlength="4000" rows="6" placeholder="Explica el estilo, reglas y comunidad del servidor." required>${value(listing, 'description')}</textarea></label>
        <div class="publish-field-pair"><label><span>Juego</span><select name="game" data-listing-game required><option value="ascended" ${game === 'ascended' ? 'selected' : ''}>ASA</option><option value="evolved" ${game === 'evolved' ? 'selected' : ''}>ASE</option><option value="both" ${game === 'both' ? 'selected' : ''}>ASE + ASA</option></select></label><label><span>Modo</span><select name="server_type" required><option value="pve" ${listing?.server_type === 'pve' ? 'selected' : ''}>PvE</option><option value="pvp" ${listing?.server_type === 'pvp' ? 'selected' : ''}>PvP</option><option value="pvpve" ${listing?.server_type === 'pvpve' ? 'selected' : ''}>PvPvE</option></select></label></div>
        <div class="publish-field-pair"><label><span>Región</span><input name="region" value="${value(listing, 'region')}" placeholder="Ej. LATAM" minlength="2" maxlength="40" required></label><label><span>Idioma</span><input name="language" value="${value(listing, 'language')}" placeholder="Ej. Español" minlength="2" maxlength="40" required></label></div>
        <div class="publish-field-pair"><label><span>Discord</span><input name="discord" type="url" value="${value(listing, 'discord_invite_url')}" placeholder="https://discord.gg/..." required></label><label><span>Sitio web (opcional)</span><input name="website" type="url" value="${value(listing, 'website_url')}" placeholder="https://..."></label></div>
        <label><span>Banner (opcional)</span><input name="banner" type="url" value="${value(listing, 'banner_url')}" placeholder="https://..."></label>
      </fieldset>
      ${choiceGroup({ legend: 'Mapas disponibles', help: 'Marca todos los mapas que tiene tu servidor.', name: 'maps', items: availableForGame(SERVER_MAPS, game), selected: listing?.maps || [] })}
      ${choiceGroup({ legend: 'Plataformas disponibles', help: 'Selecciona todas las plataformas desde las que se puede entrar al servidor.', name: 'platforms', items: availableForGame(SERVER_PLATFORMS, game).map((item) => ({ ...item, value: item.label })), selected: listing?.platforms || [] })}
      ${choiceGroup({ legend: '¿Tiene mods?', help: 'Solo necesitamos saber si el servidor utiliza mods.', name: 'has_mods', type: 'radio', items: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }], selected: [String(listing?.has_mods ?? false)] })}
      ${ratesSection(listing)}
      <fieldset class="publish-section"><legend>Detalles adicionales</legend>
        <div class="publish-field-pair"><label><span>Cluster (opcional)</span><input name="cluster_name" value="${value(listing, 'cluster_name')}"></label><label><span>Último wipe (opcional)</span><input name="wipe_date" type="date" value="${value(listing, 'wipe_date')}"></label></div>
        <label class="publish-check"><input name="propagators" type="checkbox" ${checked(listing?.uses_propagators)}><span>Este servidor usa propagadores</span></label>
      </fieldset>
    </div>
    <footer><p>${paidAndActive ? 'Los cambios se publican inmediatamente.' : REAL_STRIPE_BILLING ? 'Serás redirigido a Stripe Checkout.' : 'Se guardará como pendiente para activación administrativa.'}</p><button class="button button-primary" type="submit">${paidAndActive ? 'Guardar cambios' : REAL_STRIPE_BILLING ? 'Continuar al pago' : 'Guardar borrador'}</button></footer>
  </form>`;
}

function dashboard(listings, hasCustomer) {
  if (!listings.length) return `<div class="publish-message"><h2>Aún no tienes publicaciones.</h2><p>Elige Normal o Plus, completa la ficha y continúa al pago seguro.</p><a class="button button-primary" href="/servers/owners" data-link>Ver planes</a></div>`;
  return `<div class="publish-message"><h2>Tus publicaciones</h2><p>Consulta su estado, edita la ficha o administra la suscripción.</p><div class="billing-list">${listings.map((listing) => `<article><strong>${escapeHtml(listing.title)}</strong><span>${escapeHtml(listing.status)} - ${escapeHtml(listing.plan_type || listing.plan)}</span><a class="button button-secondary" href="/servers/publish?listing_id=${listing.id}" data-link>Editar</a></article>`).join('')}</div><div class="server-card-actions">${hasCustomer && REAL_STRIPE_BILLING ? '<button class="button button-primary" type="button" data-billing-portal>Gestionar facturación</button>' : ''}<a class="button button-quiet" href="/servers/owners" data-link>Nueva publicación</a></div></div>`;
}

export function render() {
  return `<section class="publish-shell container"><header><a href="/servers/owners" data-link>← Planes</a><p>Cuenta de servidor</p><h1>Publica con datos claros.</h1></header><div data-publish-workspace class="publish-loading"><span></span><p>Cargando tus publicaciones…</p></div></section>`;
}

function updateGameChoices(formElement) {
  const game = formElement.querySelector('[data-listing-game]')?.value || 'ascended';
  for (const [name, items] of [['maps', SERVER_MAPS], ['platforms', SERVER_PLATFORMS]]) {
    const group = formElement.querySelector(`[data-choice-group="${name}"] .publish-choices`);
    if (!group) continue;
    const selected = new Set(new FormData(formElement).getAll(name));
    const normalized = name === 'platforms' ? items.map((item) => ({ ...item, value: item.label })) : items;
    group.innerHTML = availableForGame(normalized, game).map((item) => `<label><input type="checkbox" name="${name}" value="${escapeHtml(item.value || item.name)}" ${checked(selected.has(item.value || item.name))}><span>${escapeHtml(item.label || item.name)}</span></label>`).join('');
  }
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
    if (result.error) { workspace.className = 'publish-message'; workspace.innerHTML = `<h2>No pudimos abrir tu cuenta.</h2><p>${escapeHtml(result.error)}</p>`; return; }
    const listings = result.data?.listings || [];
    selectedListing = requestedListingId ? listings.find((item) => item.id === requestedListingId) : null;
    if (requestedListingId && !selectedListing) { workspace.className = 'publish-message'; workspace.innerHTML = '<h2>Publicación no disponible.</h2><p>Solo puedes editar publicaciones que te pertenecen.</p>'; return; }
    workspace.className = 'publish-workspace';
    if (selectedListing || chosenPlan) {
      const plan = selectedListing?.plan_type || selectedListing?.plan || chosenPlan;
      workspace.innerHTML = form(plan === 'manual' ? 'normal' : plan, selectedListing);
      return;
    }
    workspace.innerHTML = dashboard(listings, Boolean(result.data?.has_customer));
  }

  workspace.addEventListener('change', (event) => {
    const publishForm = event.target.closest('[data-publish-form]');
    if (!publishForm) return;
    if (event.target.matches('[data-listing-game]')) updateGameChoices(publishForm);
    if (event.target.matches('[data-rate-preset]')) publishForm.querySelector('[data-custom-rates]').hidden = event.target.value !== 'custom';
  });

  workspace.addEventListener('click', async (event) => {
    const portal = event.target.closest('[data-billing-portal]');
    if (!portal) return;
    portal.disabled = true; portal.textContent = 'Abriendo Stripe…';
    const result = await service.openBillingPortal();
    if (result.error) { showToast(result.error, 'error'); portal.disabled = false; portal.textContent = 'Gestionar facturación'; return; }
    window.location.assign(result.data.url);
  });

  workspace.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-publish-form]')) return;
    event.preventDefault();
    const publishForm = event.target;
    if (!publishForm.reportValidity()) return;
    const values = new FormData(publishForm);
    const maps = values.getAll('maps');
    const platforms = values.getAll('platforms');
    if (!maps.length || !platforms.length) { showToast('Selecciona al menos un mapa y una plataforma.', 'error'); return; }
    const button = publishForm.querySelector('button[type="submit"]');
    button.disabled = true;
    const customRates = Object.fromEntries(RATE_FIELDS.map(([key]) => [key, values.get(`rate_${key}`)]));
    const payload = {
      title: values.get('title').trim(), game: values.get('game'), server_type: values.get('server_type'),
      region: values.get('region').trim(), language: values.get('language').trim(), platforms, maps,
      has_mods: values.get('has_mods') === 'true', mods: [], gallery_urls: [],
      rates: normalizeRates(values.get('rate_preset'), customRates),
      discord_invite_url: values.get('discord').trim(), website_url: values.get('website').trim(), banner_url: values.get('banner').trim(),
      description: values.get('description').trim(), cluster_name: values.get('cluster_name').trim(), wipe_date: values.get('wipe_date'), uses_propagators: values.has('propagators'),
    };
    const plan = publishForm.dataset.plan;
    const result = await service.saveListingDraft(publishForm.dataset.listing || null, plan, payload);
    if (result.error) { showToast(result.error, 'error'); button.disabled = false; return; }
    const listingId = result.data;
    if (selectedListing?.status === 'active') { showToast('Cambios publicados.'); await load(); return; }
    if (!REAL_STRIPE_BILLING) { showToast('Borrador guardado. La activación será administrativa.'); navigate(`/servers/publish?listing_id=${listingId}`); return; }
    button.textContent = 'Abriendo Stripe…';
    const checkout = await service.startCheckout(listingId, plan);
    if (checkout.error) { showToast(checkout.error, 'error'); button.disabled = false; button.textContent = 'Continuar al pago'; return; }
    window.location.assign(checkout.data.url);
  });

  load();
}
