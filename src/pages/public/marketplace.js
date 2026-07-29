import { createMarketplaceService } from '../../services/marketplaceService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { getLanguage, t } from '../../i18n/index.js';
import { marketplaceTimeLeft } from '../../utils/marketplaceListing.js';
import { applyMarketplaceListingMetadata } from '../../seo/metadata.js';

const label = (category) => getLanguage() === 'es' ? category.name_es : category.name_en;

function card(listing) {
  const days = marketplaceTimeLeft(listing.expires_at);
  return `<article class="market-card ${listing.is_featured ? 'is-featured' : ''}">
    <a href="/marketplace/${escapeHtml(listing.slug)}" data-link aria-label="${t('marketplace.view', { title: listing.title })}">
      <div class="market-card-media">${listing.image_url ? `<img src="${escapeHtml(listing.image_url)}" alt="" loading="lazy" />` : '<span aria-hidden="true">W.E.A.F</span>'}${listing.is_featured ? `<b>${t('marketplace.featured')}</b>` : ''}</div>
      <div class="market-card-body"><div><span>${t(`marketplace.types.${listing.listing_type}`)}</span><small>${days} ${t(days === 1 ? 'marketplace.day' : 'marketplace.days')}</small></div><h2>${escapeHtml(listing.title)}</h2><p>${escapeHtml(listing.description)}</p><dl><div><dt>${t('marketplace.resource')}</dt><dd>${escapeHtml(listing.resource_name)}</dd></div><div><dt>${t('marketplace.region')}</dt><dd>${escapeHtml(listing.region)}</dd></div><div><dt>${t('marketplace.platform')}</dt><dd>${escapeHtml(listing.platform)}</dd></div><div><dt>${t('marketplace.game')}</dt><dd>${escapeHtml(listing.game)}</dd></div></dl></div>
    </a>
  </article>`;
}

export function render({ path }) {
  const slug = path === '/marketplace' ? null : path.split('/')[2];
  if (slug) return `<section class="market-shell container" data-market-detail><div class="route-loading"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-copy"></span></div></section>`;
  return `<section class="market-hero"><div class="container"><p>${t('marketplace.eyebrow')}</p><h1>${t('marketplace.title')}</h1><span>${t('marketplace.body')}</span><div><a class="button button-primary" href="/marketplace/new" data-link>${t('marketplace.publish')}</a><a class="button button-secondary" href="/account/marketplace" data-link>${t('marketplace.mine')}</a></div></div></section>
    <section class="market-layout container"><aside class="market-filters"><h2>${t('marketplace.filters')}</h2><label><span>${t('marketplace.type')}</span><select data-market-type><option value="">${t('common.all')}</option><option value="buy">${t('marketplace.types.buy')}</option><option value="sell">${t('marketplace.types.sell')}</option><option value="trade">${t('marketplace.types.trade')}</option></select></label><label><span>${t('marketplace.game')}</span><select data-market-game><option value="">${t('common.all')}</option><option value="evolved">ASE</option><option value="ascended">ASA</option><option value="both">ASE + ASA</option></select></label><label><span>${t('marketplace.search')}</span><input type="search" maxlength="80" data-market-search /></label></aside><div class="market-results"><header><div><span>${t('marketplace.communityBoard')}</span><h2>${t('marketplace.active')}</h2></div></header><div class="market-grid" data-market-grid><div class="market-loading"></div><div class="market-loading"></div></div></div></section>
    <section class="market-safety container"><h2>${t('marketplace.safetyTitle')}</h2><p>${t('marketplace.safetyBody')}</p><a href="/report-content" data-link>${t('marketplace.reportFraud')}</a></section>`;
}

export function bind({ path, authService }) {
  const service = createMarketplaceService(authService.getClient());
  const slug = path === '/marketplace' ? null : path.split('/')[2];
  if (slug) {
    const root = document.querySelector('[data-market-detail]');
    service.getCatalog(slug).then(({ data, error }) => {
      const listing = data?.listings?.[0];
      if (!root?.isConnected) return;
      if (error || !listing) {
        root.innerHTML = `<div class="market-empty"><h1>${t('marketplace.notFound')}</h1><p>${t('marketplace.notFoundBody')}</p><a class="button button-primary" href="/marketplace" data-link>${t('marketplace.back')}</a></div>`;
        return;
      }
      applyMarketplaceListingMetadata(path, listing.title, listing.description);
      root.innerHTML = `<a class="text-link" href="/marketplace" data-link>← ${t('marketplace.back')}</a><article class="market-detail"><div class="market-detail-copy"><span>${listing.is_featured ? t('marketplace.featured') : t(`marketplace.types.${listing.listing_type}`)}</span><h1>${escapeHtml(listing.title)}</h1><p>${escapeHtml(listing.description)}</p><dl><div><dt>${t('marketplace.resource')}</dt><dd>${escapeHtml(listing.resource_name)}${listing.quantity ? ` · ${listing.quantity}` : ''}</dd></div><div><dt>${t('marketplace.terms')}</dt><dd>${escapeHtml(listing.trade_terms)}</dd></div><div><dt>${t('marketplace.server')}</dt><dd>${escapeHtml(listing.server_name || t('marketplace.unspecified'))}</dd></div><div><dt>${t('marketplace.region')}</dt><dd>${escapeHtml(listing.region)} · ${escapeHtml(listing.platform)}</dd></div></dl><a class="button button-primary" href="${escapeHtml(listing.discord_invite_url)}" target="_blank" rel="noopener noreferrer">${t('marketplace.contactDiscord')}</a><details class="market-report"><summary>${t('marketplace.reportFraud')}</summary><form data-market-report data-listing-id="${listing.id}"><label><span>${t('marketplace.reportReason')}</span><select name="reason"><option value="fraud">${t('marketplace.reportReasons.fraud')}</option><option value="prohibited">${t('marketplace.reportReasons.prohibited')}</option><option value="malicious_link">${t('marketplace.reportReasons.malicious')}</option><option value="personal_data">${t('marketplace.reportReasons.personal')}</option><option value="spam">Spam</option><option value="other">${t('marketplace.reportReasons.other')}</option></select></label><label><span>${t('marketplace.reportDetails')}</span><textarea name="details" minlength="10" maxlength="1000" required></textarea></label><button class="button button-secondary" type="submit">${t('marketplace.sendReport')}</button></form></details></div><aside><strong>${marketplaceTimeLeft(listing.expires_at)}</strong><span>${t('marketplace.daysRemaining')}</span><p>${t('marketplace.transactionNotice')}</p></aside></article>`;
    });
    root?.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-market-report]');
      if (!form) return;
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      const values = new FormData(form);
      const result = await service.report(form.dataset.listingId, String(values.get('reason')), String(values.get('details') || '').trim());
      button.disabled = false;
      const message = form.querySelector('[data-report-result]') || document.createElement('p');
      message.dataset.reportResult = '';
      message.textContent = result.error || t('marketplace.reportSent');
      form.append(message);
    });
    return;
  }

  let listings = [];
  const grid = document.querySelector('[data-market-grid]');
  const draw = () => {
    const type = document.querySelector('[data-market-type]')?.value;
    const game = document.querySelector('[data-market-game]')?.value;
    const query = document.querySelector('[data-market-search]')?.value.trim().toLowerCase();
    const filtered = listings.filter((item) => (!type || item.listing_type === type) && (!game || item.game === game || item.game === 'both') && (!query || `${item.title} ${item.resource_name} ${item.region}`.toLowerCase().includes(query)));
    grid.innerHTML = filtered.length ? filtered.map(card).join('') : `<div class="market-empty"><h3>${t('marketplace.empty')}</h3><p>${t('marketplace.emptyBody')}</p></div>`;
  };
  service.getCatalog().then(({ data, error }) => {
    if (!grid?.isConnected) return;
    listings = data?.listings || [];
    if (error) grid.innerHTML = `<div class="market-empty"><p>${escapeHtml(error)}</p></div>`;
    else draw();
  });
  document.querySelector('.market-filters')?.addEventListener('input', draw);
}
