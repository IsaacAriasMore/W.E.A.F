import { createMarketplaceService } from '../../services/marketplaceService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { getLanguage, t } from '../../i18n/index.js';
import { hasUnsafeMarketplaceText, marketplacePayload, marketplaceTimeLeft } from '../../utils/marketplaceListing.js';
import { showToast } from '../../utils/feedback.js';
import { trustedPayPalSandboxApprovalUrl } from '../../utils/safeUrl.js';
import '../../css/app.css';
import '../../css/marketplace.css';

const date = (value) => value ? new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('marketplace.notAvailable');
const option = (value, label, current) => `<option value="${escapeHtml(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;

function listingForm(categories, listing = {}, settings = {}) {
  const planChoice = settings.featured_enabled && settings.qa_eligible
    ? `<fieldset class="market-plan-options"><legend>${t('marketplace.form.plan')}</legend><label><input type="radio" name="publication_plan" value="free" checked><span><strong>${t('marketplace.form.free')}</strong><small>${t('marketplace.form.sevenDays')}</small></span></label><label><input type="radio" name="publication_plan" value="featured"><span><strong>${t('marketplace.featuredPrice')}</strong><small>${t('marketplace.form.featuredSevenDays')}</small><em>${t('marketplace.qaSandboxOnly')}</em></span></label></fieldset>`
    : `<div class="market-plan-choice"><strong>${t('marketplace.form.free')}</strong><span>${t('marketplace.form.sevenDays')}</span><small>${t('marketplace.form.featuredUnavailable')}</small></div>`;
  return `<form class="market-form" data-market-form data-listing-id="${listing.id || ''}">
    <div class="form-section"><h2>${t('marketplace.form.basics')}</h2><div class="form-grid">
      <label><span>${t('marketplace.type')}</span><select name="listing_type" required>${option('buy', t('marketplace.types.buy'), listing.listing_type)}${option('sell', t('marketplace.types.sell'), listing.listing_type)}${option('trade', t('marketplace.types.trade'), listing.listing_type)}</select></label>
      <label><span>${t('marketplace.form.category')}</span><select name="category_id" required>${categories.map((item) => option(item.id, getLanguage() === 'es' ? item.name_es : item.name_en, listing.category_id)).join('')}</select></label>
      <label class="field-wide"><span>${t('marketplace.form.title')}</span><input name="title" minlength="8" maxlength="100" required value="${escapeHtml(listing.title || '')}" /></label>
      <label class="field-wide"><span>${t('marketplace.form.description')}</span><textarea name="description" minlength="30" maxlength="2000" required>${escapeHtml(listing.description || '')}</textarea></label>
      <div class="market-fixed-game"><span>${t('marketplace.game')}</span><strong>ARK: Survival Ascended (ASA)</strong><small>${t('marketplace.asaOnly')}</small></div>
      <label><span>${t('marketplace.form.resource')}</span><input name="resource_name" minlength="2" maxlength="80" required value="${escapeHtml(listing.resource_name || '')}" /></label>
      <label><span>${t('marketplace.form.quantity')}</span><input name="quantity" type="number" min="1" max="1000000000" value="${listing.quantity || ''}" /></label>
      <label><span>${t('marketplace.form.platform')}</span><select name="platform" required>${['steam', 'epic', 'xbox', 'playstation', 'windows', 'crossplay', 'other'].map((value) => option(value, value, listing.platform)).join('')}</select></label>
      <label class="field-wide"><span>${t('marketplace.form.terms')}</span><textarea name="trade_terms" minlength="5" maxlength="500" required>${escapeHtml(listing.trade_terms || '')}</textarea></label>
    </div></div>
    <div class="form-section"><h2>${t('marketplace.form.contact')}</h2><div class="form-grid"><label><span>${t('marketplace.form.server')}</span><input name="server_name" maxlength="100" value="${escapeHtml(listing.server_name || '')}" /></label><label><span>${t('marketplace.region')}</span><input name="region" minlength="2" maxlength="40" required value="${escapeHtml(listing.region || '')}" /></label><label><span>${t('marketplace.form.language')}</span><input name="language" minlength="2" maxlength="30" required value="${escapeHtml(listing.language || '')}" /></label><label><span>${t('marketplace.form.discord')}</span><input name="discord_invite_url" type="url" pattern="https://(discord\\.gg|discord\\.com/invite)/[A-Za-z0-9_-]+/?" required value="${escapeHtml(listing.discord_invite_url || '')}" /></label><label class="field-wide"><span>${t('marketplace.form.image')}</span><input name="image_url" type="url" pattern="https://[^\\s]+" maxlength="500" value="${escapeHtml(listing.image_url || '')}" /></label></div></div>
    ${listing.id ? '' : `<label class="market-rules"><input name="rules" type="checkbox" required /><span>${t('marketplace.form.rules')}</span></label>${planChoice}`}
    <button class="button button-primary" type="submit">${listing.id ? t('common.saveChanges') : t('marketplace.form.publishFree')}</button>
  </form>`;
}

function recommendationControls(preference = {}) {
  return `<section class="market-preferences" aria-labelledby="market-preferences-title"><div><p>${t('marketplace.recommendations.eyebrow')}</p><h2 id="market-preferences-title">${t('marketplace.recommendations.title')}</h2><span>${t('marketplace.recommendations.body')}</span><a href="/privacy" data-link>${t('marketplace.recommendations.privacy')}</a></div><div class="market-preference-actions"><label class="market-toggle"><input type="checkbox" data-market-personalization ${preference.personalization_enabled ? 'checked' : ''}><span>${t('marketplace.recommendations.toggle')}</span></label><button class="button button-quiet" type="button" data-market-reset>${t('marketplace.recommendations.reset')}</button><p class="form-message" data-market-preference-status role="status" aria-live="polite"></p></div></section>`;
}

function accountListing(item, payments) {
  const payment = payments.find((candidate) => candidate.listing_id === item.id);
  return `<article><div><span>${t(`marketplace.status.${item.status}`)} · ASA</span><h2>${escapeHtml(item.title)}</h2><dl class="market-lifecycle"><div><dt>${t('marketplace.lifecycle.published')}</dt><dd>${date(item.published_at)}</dd></div><div><dt>${t('marketplace.lifecycle.expires')}</dt><dd>${date(item.expires_at)}</dd></div>${item.featured_started_at ? `<div><dt>${t('marketplace.lifecycle.featuredStarted')}</dt><dd>${date(item.featured_started_at)}</dd></div><div><dt>${t('marketplace.lifecycle.featuredExpires')}</dt><dd>${date(item.featured_expires_at)}</dd></div>` : ''}${payment ? `<div><dt>${t('marketplace.lifecycle.payment')}</dt><dd>${escapeHtml(payment.status)} · PayPal Sandbox</dd></div>` : ''}</dl><p>${marketplaceTimeLeft(item.expires_at)} ${t('marketplace.daysRemaining')}</p></div><div>${['active', 'draft'].includes(item.status) ? `<a class="button button-secondary" href="/marketplace/${item.id}/edit" data-link>${t('common.edit')}</a><button class="button button-quiet" type="button" data-hide-market="${item.id}">${t('marketplace.hide')}</button>` : ''}</div></article>`;
}

function communityPanel(data = {}) {
  const language = getLanguage();
  const favorites = data.favorites || [];
  const reports = data.reports || [];
  const blocks = data.blocks || [];
  const notifications = data.notifications || [];
  const empty = `<p class="market-community-empty">${t('marketplace.community.empty')}</p>`;
  return `<section class="market-community" aria-labelledby="market-community-title"><header><div><p>${t('marketplace.community.eyebrow')}</p><h2 id="market-community-title">${t('marketplace.community.title')}</h2></div><span>${t('marketplace.community.unread', { count: data.unread_notifications || 0 })}</span></header><div class="market-community-grid"><section><h3>${t('marketplace.community.favorites')}</h3>${favorites.length ? favorites.map((item) => `<article><div><a href="/marketplace/${escapeHtml(item.slug)}" data-link>${escapeHtml(item.title)}</a><small>${escapeHtml(item.resource_name)} · ${escapeHtml(item.status)}</small></div></article>`).join('') : empty}</section><section><h3>${t('marketplace.community.reports')}</h3>${reports.length ? reports.map((item) => `<article><div><strong>${escapeHtml(item.listing_title)}</strong><small>${escapeHtml(item.reason)} · ${escapeHtml(item.status)}</small></div></article>`).join('') : empty}</section><section><h3>${t('marketplace.community.blocks')}</h3>${blocks.length ? blocks.map((item) => `<article><div><strong>${escapeHtml(item.display_name)}</strong><small>${date(item.created_at)}</small></div><button class="text-button" type="button" data-market-unblock="${item.block_id}">${t('marketplace.community.unblock')}</button></article>`).join('') : empty}</section><section><h3>${t('marketplace.community.notifications')}</h3>${notifications.length ? notifications.map((item) => `<article class="${item.read_at ? '' : 'is-unread'}"><div><strong>${escapeHtml(item[`title_${language}`])}</strong><small>${escapeHtml(item[`body_${language}`])} · ${date(item.created_at)}</small></div>${item.read_at ? '' : `<button class="text-button" type="button" data-market-read="${item.id}">${t('marketplace.community.markRead')}</button>`}</article>`).join('') : empty}</section></div></section>`;
}

export function render({ path }) {
  const editor = path === '/marketplace/new' || path.endsWith('/edit');
  return `<section class="market-account container" data-market-account><header><a href="/marketplace" data-link>← ${t('marketplace.back')}</a><p>${t('marketplace.accountEyebrow')}</p><h1>${editor ? t('marketplace.form.pageTitle') : t('marketplace.accountTitle')}</h1><span>${editor ? t('marketplace.form.pageBody') : t('marketplace.accountBody')}</span></header><div class="route-loading"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-copy"></span></div></section>`;
}

export function bind({ path, authService, navigate }) {
  const service = createMarketplaceService(authService.getClient());
  const root = document.querySelector('[data-market-account]');
  const editId = path.endsWith('/edit') ? path.split('/')[2] : null;
  Promise.all([service.getCatalog(), service.getMyWorkspace(), service.getSettings(), service.getRecommendationSettings(), service.getCommunity()]).then(([catalog, workspace, settings, preferences, community]) => {
    if (!root?.isConnected) return;
    if (workspace.error) { root.querySelector('.route-loading').outerHTML = `<div class="market-empty" role="status"><p>${escapeHtml(workspace.error)}</p></div>`; return; }
    const listings = workspace.data?.listings || [];
    const payments = workspace.data?.payments || [];
    if (path === '/account/marketplace') {
      root.querySelector('.route-loading').outerHTML = `${recommendationControls(preferences.data)}${communityPanel(community.data)}<div class="market-account-actions"><a class="button button-primary" href="/marketplace/new" data-link>${t('marketplace.publish')}</a></div><div class="market-account-list">${listings.length ? listings.map((item) => accountListing(item, payments)).join('') : `<div class="market-empty"><h2>${t('marketplace.accountEmpty')}</h2><p>${t('marketplace.accountEmptyBody')}</p></div>`}</div>`;
      return;
    }
    if (catalog.error || !(catalog.data?.categories?.length)) { root.querySelector('.route-loading').outerHTML = `<div class="market-empty" role="status"><p>${t('marketplace.errors.load')}</p></div>`; return; }
    const listing = editId ? listings.find((item) => item.id === editId) : null;
    if (editId && !listing) { root.querySelector('.route-loading').outerHTML = `<div class="market-empty"><p>${t('marketplace.errors.notOwned')}</p></div>`; return; }
    if (!settings.data?.marketplace_enabled && !listing) { root.querySelector('.route-loading').outerHTML = `<div class="market-empty"><p>${t('marketplace.errors.disabled')}</p></div>`; return; }
    root.querySelector('.route-loading').outerHTML = listingForm(catalog.data.categories, listing || {}, settings.data || {});
  }).catch(() => {
    if (root?.isConnected) root.querySelector('.route-loading').outerHTML = `<div class="market-empty" role="status"><p>${t('marketplace.errors.loadAccount')}</p></div>`;
  });

  root.addEventListener('change', async (event) => {
    if (event.target.name === 'publication_plan') {
      const button = root.querySelector('[data-market-form] [type="submit"]');
      if (button) button.textContent = event.target.value === 'featured' ? t('marketplace.form.continuePayPal') : t('marketplace.form.publishFree');
      return;
    }
    if (!event.target.matches('[data-market-personalization]')) return;
    const status = root.querySelector('[data-market-preference-status]');
    event.target.disabled = true;
    const result = await service.setPersonalization(event.target.checked);
    status.textContent = result.error || t('marketplace.recommendations.savedPreference');
    if (result.error) event.target.checked = !event.target.checked;
    event.target.disabled = false;
  });

  root.addEventListener('submit', async (event) => {
    const target = event.target.closest('[data-market-form]');
    if (!target) return;
    event.preventDefault();
    const button = target.querySelector('[type="submit"]');
    if (button.disabled || !target.reportValidity()) return;
    const values = new FormData(target);
    const payload = marketplacePayload(values);
    if (hasUnsafeMarketplaceText(payload)) { showToast(t('marketplace.errors.prohibited'), 'error'); return; }
    button.disabled = true;
    const original = button.textContent;
    button.textContent = t('common.loading');
    try {
      const result = target.dataset.listingId ? await service.update(target.dataset.listingId, payload) : await service.publishFree(payload, values.has('rules'));
      if (result.error) showToast(result.error, 'error');
      else if (!target.dataset.listingId && values.get('publication_plan') === 'featured') {
        const order = await service.startFeaturedOrder(result.data, crypto.randomUUID());
        const approval = trustedPayPalSandboxApprovalUrl(order.data?.url);
        if (order.error || !approval) { showToast(order.error || t('marketplace.errors.paymentStart'), 'error'); navigate('/account/marketplace'); }
        else window.location.assign(approval);
      } else { showToast(target.dataset.listingId ? t('marketplace.saved') : t('marketplace.published')); navigate('/account/marketplace'); }
    } finally { if (button.isConnected) { button.disabled = false; button.textContent = original; } }
  });

  root.addEventListener('click', async (event) => {
    const read = event.target.closest('[data-market-read]');
    if (read) {
      read.disabled = true;
      const result = await service.markNotificationRead(read.dataset.marketRead);
      if (result.error) { showToast(result.error, 'error'); read.disabled = false; }
      else read.closest('article')?.classList.remove('is-unread');
      if (!result.error) read.remove();
      return;
    }
    const unblock = event.target.closest('[data-market-unblock]');
    if (unblock) {
      unblock.disabled = true;
      const result = await service.unblockSeller(unblock.dataset.marketUnblock);
      if (result.error) { showToast(result.error, 'error'); unblock.disabled = false; }
      else unblock.closest('article')?.remove();
      return;
    }
    const reset = event.target.closest('[data-market-reset]');
    if (reset) {
      if (!window.confirm(t('marketplace.recommendations.resetConfirm'))) return;
      reset.disabled = true;
      const result = await service.resetRecommendations();
      const status = root.querySelector('[data-market-preference-status]');
      status.textContent = result.error || t('marketplace.recommendations.resetDone');
      const toggle = root.querySelector('[data-market-personalization]');
      if (!result.error && toggle) toggle.checked = false;
      reset.disabled = false;
      return;
    }
    const button = event.target.closest('[data-hide-market]');
    if (!button || !window.confirm(t('marketplace.hideConfirm'))) return;
    button.disabled = true;
    const result = await service.hide(button.dataset.hideMarket);
    if (result.error) { showToast(result.error, 'error'); button.disabled = false; }
    else { showToast(t('marketplace.hidden')); navigate('/account/marketplace'); }
  });
}
