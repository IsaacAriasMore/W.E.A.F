import { REAL_PAYPAL_BILLING } from '../../config/billing.js';
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
import { getLanguage, t } from '../../i18n/index.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { billingCadence, billingPrice, formatBillingMoney } from '../../utils/billingPlans.js';

const value = (item, key, fallback = '') => escapeHtml(String(item?.[key] ?? fallback));
const planLabel = (plan) => plan ? `${plan.offer_name || plan.name} · ${formatBillingMoney(billingPrice(plan), plan.currency, getLanguage() === 'es' ? 'es-CR' : 'en-US')} ${billingCadence(plan, getLanguage())}` : t('servers.form.planUnavailable');
const checked = (condition) => condition ? 'checked' : '';
const formatDate = (date) => new Date(date).toLocaleDateString(getLanguage() === 'es' ? 'es-CR' : 'en-US');
const billingStatusLabel = (listing) => {
  if (listing?.cancel_at_period_end) return t('servers.form.statusCanceling');
  const labels = { active: 'statusActive', canceled: 'statusCanceled', paused: 'statusPaused', expired: 'statusExpired', pending_payment: 'statusPending', draft: 'statusDraft', hidden: 'statusHidden', rejected: 'statusRejected' };
  return labels[listing?.status] ? t(`servers.form.${labels[listing.status]}`) : listing?.status || t('servers.form.statusUnknown');
};

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
    <legend>${t('servers.rates')}</legend>
    <p class="field-help">${t('servers.ratesHelp')}</p>
    <label><span>${t('servers.configuration')}</span><select name="rate_preset" data-rate-preset>
      <option value="not_specified" ${preset === 'not_specified' ? 'selected' : ''}>${t('servers.unsure')}</option>
      <option value="vanilla" ${preset === 'vanilla' ? 'selected' : ''}>${t('servers.vanilla')}</option>
      <option value="low" ${preset === 'low' ? 'selected' : ''}>${t('servers.low')}</option>
      <option value="medium" ${preset === 'medium' ? 'selected' : ''}>${t('servers.medium')}</option>
      <option value="high" ${preset === 'high' ? 'selected' : ''}>${t('servers.high')}</option>
      <option value="custom" ${preset === 'custom' ? 'selected' : ''}>${t('servers.custom')}</option>
    </select></label>
    <div class="rate-grid" data-custom-rates ${preset === 'custom' ? '' : 'hidden'}>${RATE_FIELDS.map(([key, label, help]) => `<label><span>${label}</span><input name="rate_${key}" type="number" inputmode="decimal" min="0.01" max="1000" step="0.01" value="${escapeHtml(String(rates[key] ?? 1))}"><small>${help}</small></label>`).join('')}</div>
  </fieldset>`;
}

function form(plan, listing) {
  const paidAndActive = listing?.status === 'active';
  const game = listing?.game || 'ascended';
  const tier = listing?.plan_type || listing?.plan || plan?.code || 'normal';
  return `<form class="publish-form" data-publish-form data-motion="none" data-listing="${listing?.id || ''}" data-plan="${tier}" data-plan-version="${plan?.plan_version_id || listing?.billing_plan_version_id || ''}" novalidate>
    <header><p>${t(listing ? 'servers.form.editEyebrow' : 'servers.form.newEyebrow')}</p><h2>${listing ? escapeHtml(listing.title) : planLabel(plan)}</h2><span>${paidAndActive ? t('servers.form.activeUntil', { date: listing.expires_at ? formatDate(listing.expires_at) : t('servers.form.activeNotice') }) : t('servers.form.paymentGate')}</span>${plan?.offer_name ? `<small>${escapeHtml(t('servers.form.offerTerms', { cycles: plan.benefit_cycles || plan.total_cycles || '∞', behavior: plan.end_behavior }))}</small>` : ''}</header>
    <div class="publish-fields">
      <fieldset class="publish-section"><legend>${t('servers.form.basic')}</legend>
        <label><span>${t('servers.form.name')}</span><input name="title" value="${value(listing, 'title')}" minlength="2" maxlength="100" placeholder="${t('servers.form.nameExample')}" required></label>
        <label><span>${t('servers.form.description')}</span><textarea name="description" minlength="20" maxlength="4000" rows="6" placeholder="${t('servers.form.descriptionExample')}" required>${value(listing, 'description')}</textarea></label>
        <div class="publish-field-pair"><label><span>${t('servers.form.game')}</span><select name="game" data-listing-game required><option value="ascended" ${game === 'ascended' ? 'selected' : ''}>ASA</option><option value="evolved" ${game === 'evolved' ? 'selected' : ''}>ASE</option><option value="both" ${game === 'both' ? 'selected' : ''}>ASE + ASA</option></select></label><label><span>${t('servers.form.mode')}</span><select name="server_type" required><option value="pve" ${listing?.server_type === 'pve' ? 'selected' : ''}>PvE</option><option value="pvp" ${listing?.server_type === 'pvp' ? 'selected' : ''}>PvP</option><option value="pvpve" ${listing?.server_type === 'pvpve' ? 'selected' : ''}>PvPvE</option></select></label></div>
        <div class="publish-field-pair"><label><span>${t('servers.form.region')}</span><input name="region" value="${value(listing, 'region')}" placeholder="${t('servers.directory.regionExample')}" minlength="2" maxlength="40" required></label><label><span>${t('servers.form.language')}</span><input name="language" value="${value(listing, 'language')}" placeholder="${t('servers.directory.languageExample')}" minlength="2" maxlength="40" required></label></div>
        <div class="publish-field-pair"><label><span>${t('servers.form.discord')}</span><input name="discord" type="url" value="${value(listing, 'discord_invite_url')}" placeholder="https://discord.gg/..." required></label><label><span>${t('servers.form.website')}</span><input name="website" type="url" value="${value(listing, 'website_url')}" placeholder="https://..."></label></div>
        <label><span>${t('servers.form.banner')}</span><input name="banner" type="url" value="${value(listing, 'banner_url')}" placeholder="https://..."></label>
      </fieldset>
      ${choiceGroup({ legend: t('servers.maps'), help: t('servers.mapsHelp'), name: 'maps', items: availableForGame(SERVER_MAPS, game), selected: listing?.maps || [] })}
      ${choiceGroup({ legend: t('servers.platforms'), help: t('servers.platformsHelp'), name: 'platforms', items: availableForGame(SERVER_PLATFORMS, game).map((item) => ({ ...item, value: item.label })), selected: listing?.platforms || [] })}
      ${choiceGroup({ legend: t('servers.modsQuestion'), help: t('servers.modsHelp'), name: 'has_mods', type: 'radio', items: [{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }], selected: [String(listing?.has_mods ?? false)] })}
      ${ratesSection(listing)}
      <fieldset class="publish-section"><legend>${t('servers.form.details')}</legend>
        <div class="publish-field-pair"><label><span>${t('servers.form.cluster')}</span><input name="cluster_name" value="${value(listing, 'cluster_name')}"></label><label><span>${t('servers.form.wipe')}</span><input name="wipe_date" type="date" value="${value(listing, 'wipe_date')}"></label></div>
        <label class="publish-check"><input name="propagators" type="checkbox" ${checked(listing?.uses_propagators)}><span>${t('servers.form.propagators')}</span></label>
      </fieldset>
    </div>
    <footer><p>${t(paidAndActive ? 'servers.form.immediate' : REAL_PAYPAL_BILLING ? 'servers.form.redirectPayPal' : 'servers.form.adminPending')}</p><button class="button button-primary" type="submit">${paidAndActive ? t('common.saveChanges') : REAL_PAYPAL_BILLING ? t('servers.checkout') : t('servers.form.saveDraft')}</button></footer>
  </form>`;
}

function dashboard(listings) {
  if (!listings.length) return `<div class="publish-message"><h2>${t('servers.form.noneTitle')}</h2><p>${t('servers.form.noneBody')}</p><a class="button button-primary" href="/servers/owners" data-link>${t('servers.form.viewPlans')}</a></div>`;
  return `<div class="publish-message"><h2>${t('servers.form.yours')}</h2><p>${t('servers.form.yoursBody')}</p><div class="billing-list">${listings.map((listing) => `<article><strong>${escapeHtml(listing.title)}</strong><span>${escapeHtml(billingStatusLabel(listing))} - ${escapeHtml(listing.plan_type || listing.plan)}</span><a class="button button-secondary" href="/servers/publish?listing_id=${listing.id}" data-link>${t('common.edit')}</a></article>`).join('')}</div><div class="server-card-actions"><a class="button button-primary" href="/account/billing" data-link>${t('servers.billing')}</a><a class="button button-quiet" href="/servers/owners" data-link>${t('servers.form.newListing')}</a></div></div>`;
}

function planSelector(plans, listings) {
  return `<section class="publish-plan-selector" aria-labelledby="publish-plan-title" data-gsap-stagger>
    <div><p>${t('servers.form.selectorEyebrow')}</p><h2 id="publish-plan-title">${t('servers.form.selectorTitle')}</h2><span>${t('servers.form.selectorBody')}</span></div>
    <div class="publish-plan-options">${plans.map((plan) => {
      const plus = plan.code === 'plus'; const discounted = billingPrice(plan) < Number(plan.base_price_minor || 0);
      return `<button class="publish-plan-option interactive-card ${plus ? 'is-plus' : ''}" type="button" data-select-publish-plan="${plan.plan_version_id}" data-tier="${plan.code}" data-gsap-item><span>${escapeHtml(plan.offer_name || t(plus ? 'servers.owner.visibility' : 'servers.owner.essential'))}</span><strong>${escapeHtml(plan.name)}</strong><b>${discounted ? `<del>${formatBillingMoney(plan.base_price_minor, plan.currency, getLanguage() === 'es' ? 'es-CR' : 'en-US')}</del>` : ''}${formatBillingMoney(billingPrice(plan), plan.currency, getLanguage() === 'es' ? 'es-CR' : 'en-US')} <small>${billingCadence(plan, getLanguage())}</small></b><em>${escapeHtml(plan.offer_description || t(`servers.form.${plus ? 'plusBody' : 'normalBody'}`))}</em>${plan.acquisition_ends_at ? `<small>${t('servers.form.offerEnds', { date: formatDate(plan.acquisition_ends_at) })}</small>` : ''}</button>`;
    }).join('')}</div>
    ${createSponsoredServerSlot('server_publish_example', { variant: 'preview', preview: true })}
    ${listings.length ? dashboard(listings) : ''}
  </section>`;
}

export function render() {
  return `<section class="publish-shell container"><header data-gsap-hero><a href="/servers/owners" data-link data-gsap-hero-item>← ${t('servers.form.plansBack')}</a><p data-gsap-hero-item>${t('servers.form.accountEyebrow')}</p><h1 data-gsap-hero-item>${t('servers.form.pageTitle')}</h1></header><div data-publish-workspace class="publish-loading"><span></span><p>${t('servers.form.loading')}</p></div></section>`;
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
  let chosenPlan = ['normal', 'plus'].includes(query.get('plan')) ? query.get('plan') : null;
  const requestedOfferId = query.get('offer');
  const requestedListingId = query.get('listing_id');
  let selectedListing = null;
  let catalog = [];

  async function load() {
    const [result, plansResult] = await Promise.all([service.getMyBilling(), service.listPlans()]);
    if (result.error) { workspace.className = 'publish-message'; workspace.innerHTML = `<h2>${t('servers.form.accountError')}</h2><p>${escapeHtml(result.error)}</p>`; return; }
    if (plansResult.error || !plansResult.data?.length) { workspace.className = 'publish-message'; workspace.innerHTML = `<h2>${t('servers.form.plansUnavailable')}</h2><p>${escapeHtml(plansResult.error || t('servers.form.syncRequired'))}</p>`; return; }
    catalog = plansResult.data;
    const listings = result.data?.listings || [];
    selectedListing = requestedListingId ? listings.find((item) => item.id === requestedListingId) : null;
    if (requestedListingId && !selectedListing) { workspace.className = 'publish-message'; workspace.innerHTML = `<h2>${t('servers.form.unavailable')}</h2><p>${t('servers.form.ownershipError')}</p>`; return; }
    workspace.className = 'publish-workspace';
    if (selectedListing || chosenPlan) {
      const tier = selectedListing?.plan_type || selectedListing?.plan || chosenPlan;
      const plan = catalog.find((item) => item.plan_version_id === selectedListing?.billing_plan_version_id)
        || catalog.find((item) => item.offer_id === requestedOfferId)
        || catalog.find((item) => item.code === (tier === 'manual' ? 'normal' : tier) && !item.offer_id);
      workspace.innerHTML = form(plan, selectedListing);
      return;
    }
    workspace.innerHTML = planSelector(catalog, listings);
  }

  workspace.addEventListener('change', (event) => {
    const publishForm = event.target.closest('[data-publish-form]');
    if (!publishForm) return;
    if (event.target.matches('[data-listing-game]')) updateGameChoices(publishForm);
    if (event.target.matches('[data-rate-preset]')) publishForm.querySelector('[data-custom-rates]').hidden = event.target.value !== 'custom';
  });

  workspace.addEventListener('click', async (event) => {
    const planChoice = event.target.closest('[data-select-publish-plan]');
    if (planChoice) {
      chosenPlan = planChoice.dataset.tier;
      const selectedPlan = catalog.find((item) => item.plan_version_id === planChoice.dataset.selectPublishPlan);
      window.history.replaceState({}, '', `/servers/publish?plan=${chosenPlan}${selectedPlan?.offer_id ? `&offer=${selectedPlan.offer_id}` : ''}`);
      workspace.innerHTML = form(selectedPlan, null);
      workspace.querySelector('[name="title"]')?.focus();
      return;
    }
  });

  workspace.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-publish-form]')) return;
    event.preventDefault();
    const publishForm = event.target;
    if (!publishForm.reportValidity()) return;
    const values = new FormData(publishForm);
    const maps = values.getAll('maps');
    const platforms = values.getAll('platforms');
    if (!maps.length || !platforms.length) { showToast(t('servers.form.choicesError'), 'error'); return; }
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
    if (selectedListing?.status === 'active') { showToast(t('servers.form.saved')); await load(); return; }
    if (!REAL_PAYPAL_BILLING) { showToast(t('servers.form.draftSaved')); navigate(`/servers/publish?listing_id=${listingId}`); return; }
    if (!publishForm.dataset.planVersion) { showToast(t('servers.form.planUnavailable'), 'error'); button.disabled = false; return; }
    button.textContent = t('servers.form.openingPayPal');
    const storageKey = `weaf:paypal-idempotency:${listingId}:${publishForm.dataset.planVersion}`;
    let idempotencyKey = sessionStorage.getItem(storageKey);
    if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); sessionStorage.setItem(storageKey, idempotencyKey); }
    const checkout = await service.startSubscription(listingId, publishForm.dataset.planVersion, idempotencyKey);
    if (checkout.error) { showToast(checkout.error, 'error'); button.disabled = false; button.textContent = t('servers.checkout'); return; }
    window.location.assign(checkout.data.url);
  });

  load();
}
