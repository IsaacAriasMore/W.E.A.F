import { createMarketplaceService } from '../../services/marketplaceService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { getLanguage, t } from '../../i18n/index.js';
import { hasUnsafeMarketplaceText, marketplacePayload, marketplaceTimeLeft } from '../../utils/marketplaceListing.js';
import { showToast } from '../../utils/feedback.js';

function form(categories, listing = {}) {
  const option = (value, label, current) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`;
  return `<form class="market-form" data-market-form data-listing-id="${listing.id || ''}"><div class="form-section"><h2>${t('marketplace.form.basics')}</h2><div class="form-grid"><label><span>${t('marketplace.type')}</span><select name="listing_type" required>${option('buy',t('marketplace.types.buy'),listing.listing_type)}${option('sell',t('marketplace.types.sell'),listing.listing_type)}${option('trade',t('marketplace.types.trade'),listing.listing_type)}</select></label><label><span>${t('marketplace.form.category')}</span><select name="category_id" required>${categories.map((item) => option(item.id,getLanguage()==='es'?item.name_es:item.name_en,listing.category_id)).join('')}</select></label><label class="field-wide"><span>${t('marketplace.form.title')}</span><input name="title" minlength="8" maxlength="100" required value="${escapeHtml(listing.title || '')}" /></label><label class="field-wide"><span>${t('marketplace.form.description')}</span><textarea name="description" minlength="30" maxlength="2000" required>${escapeHtml(listing.description || '')}</textarea></label><label><span>${t('marketplace.game')}</span><select name="game" required>${option('evolved','ASE',listing.game)}${option('ascended','ASA',listing.game)}${option('both','ASE + ASA',listing.game)}</select></label><label><span>${t('marketplace.form.resource')}</span><input name="resource_name" minlength="2" maxlength="80" required value="${escapeHtml(listing.resource_name || '')}" /></label><label><span>${t('marketplace.form.quantity')}</span><input name="quantity" type="number" min="1" max="1000000000" value="${listing.quantity || ''}" /></label><label><span>${t('marketplace.form.platform')}</span><select name="platform" required>${['steam','epic','xbox','playstation','windows','crossplay','other'].map((value) => option(value,value,listing.platform)).join('')}</select></label><label class="field-wide"><span>${t('marketplace.form.terms')}</span><textarea name="trade_terms" minlength="5" maxlength="500" required>${escapeHtml(listing.trade_terms || '')}</textarea></label></div></div><div class="form-section"><h2>${t('marketplace.form.contact')}</h2><div class="form-grid"><label><span>${t('marketplace.form.server')}</span><input name="server_name" maxlength="100" value="${escapeHtml(listing.server_name || '')}" /></label><label><span>${t('marketplace.region')}</span><input name="region" minlength="2" maxlength="40" required value="${escapeHtml(listing.region || '')}" /></label><label><span>${t('marketplace.form.language')}</span><input name="language" minlength="2" maxlength="30" required value="${escapeHtml(listing.language || '')}" /></label><label><span>${t('marketplace.form.discord')}</span><input name="discord_invite_url" type="url" pattern="https://(discord\\.gg|discord\\.com/invite)/[A-Za-z0-9_-]+/?" required value="${escapeHtml(listing.discord_invite_url || '')}" /></label><label class="field-wide"><span>${t('marketplace.form.image')}</span><input name="image_url" type="url" pattern="https://[^\\s]+" maxlength="500" value="${escapeHtml(listing.image_url || '')}" /></label></div></div>${listing.id ? '' : `<label class="market-rules"><input name="rules" type="checkbox" required /><span>${t('marketplace.form.rules')}</span></label><div class="market-plan-choice"><strong>${t('marketplace.form.free')}</strong><span>${t('marketplace.form.sevenDays')}</span><small>${t('marketplace.form.featuredUnavailable')}</small></div>`}<button class="button button-primary" type="submit">${listing.id ? t('common.saveChanges') : t('marketplace.form.publishFree')}</button></form>`;
}

export function render({ path }) {
  const editor = path === '/marketplace/new' || path.endsWith('/edit');
  return `<section class="market-account container" data-market-account><header><a href="/marketplace" data-link>← ${t('marketplace.back')}</a><p>${t('marketplace.accountEyebrow')}</p><h1>${editor ? t('marketplace.form.pageTitle') : t('marketplace.accountTitle')}</h1><span>${editor ? t('marketplace.form.pageBody') : t('marketplace.accountBody')}</span></header><div class="route-loading"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-copy"></span></div></section>`;
}

export function bind({ path, authService, navigate }) {
  const service = createMarketplaceService(authService.getClient());
  const root = document.querySelector('[data-market-account]');
  const editId = path.endsWith('/edit') ? path.split('/')[2] : null;
  Promise.all([service.getCatalog(), service.getMyWorkspace(), service.getSettings()]).then(([catalog, workspace, settings]) => {
    if (!root?.isConnected) return;
    if (workspace.error) { root.insertAdjacentHTML('beforeend', `<div class="market-empty"><p>${escapeHtml(workspace.error)}</p></div>`); root.querySelector('.route-loading')?.remove(); return; }
    const listings = workspace.data?.listings || [];
    if (path === '/account/marketplace') {
      root.querySelector('.route-loading').outerHTML = `<div class="market-account-actions"><a class="button button-primary" href="/marketplace/new" data-link>${t('marketplace.publish')}</a></div><div class="market-account-list">${listings.length ? listings.map((item) => `<article><div><span>${t(`marketplace.status.${item.status}`)}</span><h2>${escapeHtml(item.title)}</h2><p>${marketplaceTimeLeft(item.expires_at)} ${t('marketplace.daysRemaining')}</p></div><div>${['active','draft'].includes(item.status) ? `<a class="button button-secondary" href="/marketplace/${item.id}/edit" data-link>${t('common.edit')}</a><button class="button button-quiet" type="button" data-hide-market="${item.id}">${t('marketplace.hide')}</button>` : ''}</div></article>`).join('') : `<div class="market-empty"><h2>${t('marketplace.accountEmpty')}</h2><p>${t('marketplace.accountEmptyBody')}</p></div>`}</div>`;
      return;
    }
    const listing = editId ? listings.find((item) => item.id === editId) : null;
    if (editId && !listing) { root.querySelector('.route-loading').outerHTML = `<div class="market-empty"><p>${t('marketplace.errors.notOwned')}</p></div>`; return; }
    if (!settings.data?.marketplace_enabled && !listing) { root.querySelector('.route-loading').outerHTML = `<div class="market-empty"><p>${t('marketplace.errors.disabled')}</p></div>`; return; }
    root.querySelector('.route-loading').outerHTML = form(catalog.data?.categories || [], listing || {});
  });

  root.addEventListener('submit', async (event) => {
    const target = event.target.closest('[data-market-form]');
    if (!target) return;
    event.preventDefault();
    const button = target.querySelector('[type="submit"]');
    if (button.disabled) return;
    const values = new FormData(target); const payload = marketplacePayload(values);
    if (hasUnsafeMarketplaceText(payload)) { showToast(t('marketplace.errors.prohibited'), 'error'); return; }
    button.disabled = true; const original = button.textContent; button.textContent = t('common.loading');
    try {
      const result = target.dataset.listingId ? await service.update(target.dataset.listingId, payload) : await service.publishFree(payload, values.has('rules'));
      if (result.error) showToast(result.error, 'error');
      else { showToast(target.dataset.listingId ? t('marketplace.saved') : t('marketplace.published')); navigate('/account/marketplace'); }
    } finally { if (button.isConnected) { button.disabled = false; button.textContent = original; } }
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-hide-market]');
    if (!button || !window.confirm(t('marketplace.hideConfirm'))) return;
    button.disabled = true;
    const result = await service.hide(button.dataset.hideMarket);
    if (result.error) { showToast(result.error, 'error'); button.disabled = false; }
    else { showToast(t('marketplace.hidden')); navigate('/account/marketplace'); }
  });
}
