import { createMarketplaceService } from '../../services/marketplaceService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { safeImageUrl } from '../../utils/safeUrl.js';
import { getLanguage, t } from '../../i18n/index.js';
import '../../css/marketplace.css';

function approximateDate(value) {
  if (!value) return t('marketplace.notAvailable');
  return new Intl.DateTimeFormat(getLanguage(), { month: 'long', year: 'numeric' }).format(new Date(value));
}

function listingCard(item) {
  const image = safeImageUrl(item.image_url);
  return `<article class="market-seller-listing">${image ? `<img src="${escapeHtml(image)}" alt="" width="480" height="260" loading="lazy">` : ''}<div><span>${t(`marketplace.types.${item.listing_type}`)}</span><h2><a href="/marketplace/${escapeHtml(item.slug)}" data-link>${escapeHtml(item.title)}</a></h2><p>${escapeHtml(item.resource_name)} · ${escapeHtml(item.region)} · ${escapeHtml(item.platform)}</p></div></article>`;
}

export function render() {
  return `<section class="market-shell container" data-market-seller><div class="route-loading" aria-label="${t('common.loading')}"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-copy"></span></div></section>`;
}

export function bind({ path, authService }) {
  const root = document.querySelector('[data-market-seller]');
  const listingSlug = decodeURIComponent(path.split('/')[3] || '');
  const service = createMarketplaceService(authService.getClient());
  let offset = 0;
  const load = async (append = false) => {
    const result = await service.getSellerProfile(listingSlug, 12, offset);
    if (!root?.isConnected) return;
    if (result.error || !result.data) {
      root.innerHTML = `<div class="market-empty"><h1>${t('marketplace.seller.notFound')}</h1><p>${escapeHtml(result.error || t('marketplace.seller.notFoundBody'))}</p><a class="button button-primary" href="/marketplace" data-link>${t('marketplace.back')}</a></div>`;
      return;
    }
    const seller = result.data;
    const avatar = safeImageUrl(seller.avatar_url);
    const cards = (seller.listings || []).map(listingCard).join('');
    if (!append) {
      document.title = `${seller.display_name} · ${t('marketplace.seller.title')} | W.E.A.F`;
      root.innerHTML = `<a class="text-link" href="/marketplace" data-link>← ${t('marketplace.back')}</a><header class="market-seller-header">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" width="96" height="96">` : '<span aria-hidden="true">W</span>'}<div><p>${t('marketplace.seller.eyebrow')}</p><h1>${escapeHtml(seller.display_name)}</h1><dl><div><dt>${t('marketplace.seller.memberSince')}</dt><dd>${approximateDate(seller.member_since)}</dd></div><div><dt>${t('marketplace.seller.active')}</dt><dd>${seller.active_count}</dd></div></dl></div></header><section class="market-seller-results" aria-labelledby="seller-listings-title"><h2 id="seller-listings-title">${t('marketplace.seller.listings')}</h2><div data-seller-listings>${cards || `<p>${t('marketplace.seller.empty')}</p>`}</div><button class="button button-secondary" type="button" data-seller-more ${seller.next_offset === null ? 'hidden' : ''}>${t('marketplace.loadMore')}</button></section>`;
    } else {
      root.querySelector('[data-seller-listings]')?.insertAdjacentHTML('beforeend', cards);
      const more = root.querySelector('[data-seller-more]');
      if (more) more.hidden = seller.next_offset === null;
    }
    offset = seller.next_offset ?? offset;
  };
  root?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-seller-more]');
    if (!button) return;
    button.disabled = true;
    load(true).finally(() => { if (button.isConnected) button.disabled = false; });
  });
  load();
}
