import { createMarketplaceService } from '../../services/marketplaceService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { getLanguage, t } from '../../i18n/index.js';
import { marketplaceTimeLeft } from '../../utils/marketplaceListing.js';
import { applyMarketplaceListingMetadata } from '../../seo/metadata.js';
import { showToast } from '../../utils/feedback.js';
import { safeDiscordInviteUrl, safeImageUrl } from '../../utils/safeUrl.js';
import '../../css/marketplace.css';

const platformOptions = ['steam', 'epic', 'xbox', 'playstation', 'windows', 'crossplay', 'other'];

function reasonLabel(reason) {
  return t(`marketplace.recommendations.reasons.${reason || 'fair_rotation'}`);
}

function card(listing) {
  const days = marketplaceTimeLeft(listing.expires_at);
  const image = safeImageUrl(listing.image_url);
  return `<article class="market-card ${listing.is_featured ? 'is-featured' : ''}" data-listing-card="${listing.id}">
    <a href="/marketplace/${escapeHtml(listing.slug)}" data-link aria-label="${t('marketplace.view', { title: listing.title })}">
      <div class="market-card-media">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" width="640" height="340" />` : '<span aria-hidden="true">W.E.A.F / ASA</span>'}${listing.is_featured ? `<b>${t('marketplace.featured')}</b>` : ''}</div>
      <div class="market-card-body">
        <div><span>${t(`marketplace.types.${listing.listing_type}`)}</span><small>${days} ${t(days === 1 ? 'marketplace.day' : 'marketplace.days')}</small></div>
        <h3>${escapeHtml(listing.title)}</h3><p>${escapeHtml(listing.description)}</p>
        <dl><div><dt>${t('marketplace.resource')}</dt><dd>${escapeHtml(listing.resource_name)}</dd></div><div><dt>${t('marketplace.region')}</dt><dd>${escapeHtml(listing.region)}</dd></div><div><dt>${t('marketplace.platform')}</dt><dd>${escapeHtml(listing.platform)}</dd></div><div><dt>${t('marketplace.game')}</dt><dd>ASA</dd></div></dl>
        <small class="market-reason">${reasonLabel(listing.recommendation_reason)}</small>
      </div>
    </a>
  </article>`;
}

function emptyState(title, body) {
  return `<div class="market-empty"><h3>${title}</h3><p>${body}</p></div>`;
}

function hydrateDetailControls(root, listing) {
  const detail = root.querySelector('[data-listing-id]');
  if (!detail) return;
  detail.dataset.listingSlug = listing.slug;
  const discordLink = detail.querySelector('[data-market-discord]');
  const discordUrl = safeDiscordInviteUrl(listing.discord_invite_url);
  if (discordLink && discordUrl) discordLink.href = discordUrl;
  else discordLink?.remove();

  const actions = detail.querySelector('.market-detail-actions');
  const sellerLink = document.createElement('a');
  sellerLink.className = 'button button-secondary';
  sellerLink.href = `/marketplace/seller/${encodeURIComponent(listing.slug)}`;
  sellerLink.dataset.link = '';
  sellerLink.textContent = t('marketplace.sellerProfile');
  const blockButton = document.createElement('button');
  blockButton.className = 'button button-quiet';
  blockButton.type = 'button';
  blockButton.dataset.marketBlock = '';
  blockButton.textContent = t('marketplace.blockSeller');
  actions?.append(sellerLink, blockButton);
  const saveButton = actions?.querySelector('[data-market-save]');
  if (saveButton) saveButton.textContent = t('marketplace.saveListing');

  const reasons = [
    ['fraud', 'fraud'], ['duplicate', 'duplicate'], ['prohibited_content', 'prohibited'],
    ['false_information', 'falseInformation'], ['dangerous_link', 'dangerous'],
    ['harassment', 'harassment'], ['other', 'other'],
  ];
  const reasonSelect = detail.querySelector('[data-market-report] select[name="reason"]');
  reasonSelect?.replaceChildren(...reasons.map(([value, key]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(`marketplace.reportReasons.${key}`);
    return option;
  }));
}

export function render({ path }) {
  const slug = path === '/marketplace' ? null : path.split('/')[2];
  if (slug) return `<section class="market-shell container" data-market-detail><div class="route-loading"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-copy"></span></div></section>`;
  return `<section class="market-hero"><div class="container"><p>${t('marketplace.eyebrow')}</p><h1>${t('marketplace.title')}</h1><span>${t('marketplace.body')}</span><div><a class="button button-primary" href="/marketplace/new" data-link>${t('marketplace.publish')}</a><a class="button button-secondary" href="/account/marketplace" data-link>${t('marketplace.mine')}</a></div><small class="market-asa-badge">ARK: Survival Ascended · ASA</small></div></section>
    <section class="market-layout container">
      <aside class="market-filters" aria-label="${t('marketplace.filters')}"><h2>${t('marketplace.filters')}</h2>
        <label><span>${t('marketplace.type')}</span><select data-market-filter="type"><option value="">${t('common.all')}</option><option value="buy">${t('marketplace.types.buy')}</option><option value="sell">${t('marketplace.types.sell')}</option><option value="trade">${t('marketplace.types.trade')}</option></select></label>
        <label><span>${t('marketplace.form.category')}</span><select data-market-filter="category"><option value="">${t('common.all')}</option></select></label>
        <label><span>${t('marketplace.region')}</span><input maxlength="40" data-market-filter="region" /></label>
        <label><span>${t('marketplace.platform')}</span><select data-market-filter="platform"><option value="">${t('common.all')}</option>${platformOptions.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label>
        <label class="market-search"><span>${t('marketplace.search')}</span><input type="search" maxlength="80" data-market-filter="search" /></label>
      </aside>
      <div class="market-results" aria-live="polite">
        <section class="market-section" aria-labelledby="market-featured-title"><header><div><span>${t('marketplace.featuredEyebrow')}</span><h2 id="market-featured-title">${t('marketplace.featuredTitle')}</h2></div><p>${t('marketplace.featuredDisclaimer')}</p></header><div class="market-grid market-grid-featured" data-market-featured><div class="market-loading"></div></div></section>
        <section class="market-section" aria-labelledby="market-organic-title"><header><div><span>${t('marketplace.communityBoard')}</span><h2 id="market-organic-title">${t('marketplace.active')}</h2></div></header><div class="market-grid" data-market-grid><div class="market-loading"></div><div class="market-loading"></div></div><button class="button button-secondary market-load-more" type="button" data-market-more hidden>${t('marketplace.loadMore')}</button><p class="form-message" data-market-status role="status"></p></section>
      </div>
    </section>
    <section class="market-safety container"><h2>${t('marketplace.safetyTitle')}</h2><p>${t('marketplace.safetyBody')}</p><a href="/report-content" data-link>${t('marketplace.reportFraud')}</a></section>`;
}

async function bindDetail(service, root, path) {
  const slug = path.split('/')[2];
  const { data, error } = await service.getCatalog({ slug, limit: 1 });
  const listing = data?.listings?.[0] || data?.featured?.[0];
  if (!root?.isConnected) return;
  if (error || !listing) {
    root.innerHTML = `<div class="market-empty"><h1>${t('marketplace.notFound')}</h1><p>${t('marketplace.notFoundBody')}</p><a class="button button-primary" href="/marketplace" data-link>${t('marketplace.back')}</a></div>`;
    return;
  }
  applyMarketplaceListingMetadata(path, listing.title, listing.description);
  root.innerHTML = `<a class="text-link" href="/marketplace" data-link>← ${t('marketplace.back')}</a><article class="market-detail" data-listing-id="${listing.id}"><div class="market-detail-copy"><span>${listing.is_featured ? t('marketplace.featured') : t(`marketplace.types.${listing.listing_type}`)} · ASA</span><h1>${escapeHtml(listing.title)}</h1><p>${escapeHtml(listing.description)}</p><small class="market-reason">${reasonLabel(listing.recommendation_reason)}</small><dl><div><dt>${t('marketplace.resource')}</dt><dd>${escapeHtml(listing.resource_name)}${listing.quantity ? ` · ${listing.quantity}` : ''}</dd></div><div><dt>${t('marketplace.terms')}</dt><dd>${escapeHtml(listing.trade_terms)}</dd></div><div><dt>${t('marketplace.server')}</dt><dd>${escapeHtml(listing.server_name || t('marketplace.unspecified'))}</dd></div><div><dt>${t('marketplace.region')}</dt><dd>${escapeHtml(listing.region)} · ${escapeHtml(listing.platform)}</dd></div></dl><div class="market-detail-actions"><a class="button button-primary" href="${escapeHtml(listing.discord_invite_url)}" target="_blank" rel="noopener noreferrer" data-market-discord>${t('marketplace.contactDiscord')}</a><button class="button button-secondary" type="button" data-market-save>${t('marketplace.recommendations.save')}</button><button class="button button-quiet" type="button" data-market-dismiss>${t('marketplace.recommendations.hide')}</button></div><details class="market-report"><summary>${t('marketplace.reportFraud')}</summary><form data-market-report data-listing-id="${listing.id}"><label><span>${t('marketplace.reportReason')}</span><select name="reason"><option value="fraud">${t('marketplace.reportReasons.fraud')}</option><option value="prohibited">${t('marketplace.reportReasons.prohibited')}</option><option value="malicious_link">${t('marketplace.reportReasons.malicious')}</option><option value="personal_data">${t('marketplace.reportReasons.personal')}</option><option value="spam">Spam</option><option value="other">${t('marketplace.reportReasons.other')}</option></select></label><label><span>${t('marketplace.reportDetails')}</span><textarea name="details" minlength="10" maxlength="1000" required></textarea></label><button class="button button-secondary" type="submit">${t('marketplace.sendReport')}</button><p class="form-message" data-report-result role="status" aria-live="polite"></p></form></details></div><aside><strong>${marketplaceTimeLeft(listing.expires_at)}</strong><span>${t('marketplace.daysRemaining')}</span><p>${t('marketplace.transactionNotice')}</p></aside></article>`;
  hydrateDetailControls(root, listing);
  if (data.personalization_enabled) service.recordRecommendation('detail', { listingId: listing.id });
}

export function bind({ path, authService, navigate }) {
  const service = createMarketplaceService(authService.getClient());
  const slug = path === '/marketplace' ? null : path.split('/')[2];
  if (slug) {
    const root = document.querySelector('[data-market-detail]');
    bindDetail(service, root, path).catch(() => {
      if (root?.isConnected) root.innerHTML = emptyState(t('marketplace.notFound'), t('marketplace.errors.load'));
    });
    root?.addEventListener('click', async (event) => {
      const detail = root.querySelector('[data-listing-id]');
      const listingId = detail?.dataset.listingId;
      const listingSlug = detail?.dataset.listingSlug;
      if (!listingId) return;
      if (event.target.closest('[data-market-discord]')) service.recordRecommendation('discord', { listingId });
      if (event.target.closest('[data-market-save]')) {
        const button = event.target.closest('[data-market-save]');
        button.disabled = true;
        const result = await service.setFavorite(listingId, true);
        if (result.error) showToast(result.error, 'error');
        else {
          service.recordRecommendation('save', { listingId });
          showToast(t('marketplace.listingSaved'));
        }
        button.disabled = false;
      }
      if (event.target.closest('[data-market-dismiss]')) {
        service.recordRecommendation('hide', { listingId });
        navigate('/marketplace');
      }
      if (event.target.closest('[data-market-block]') && listingSlug
        && window.confirm(t('marketplace.blockConfirm'))) {
        const button = event.target.closest('[data-market-block]');
        button.disabled = true;
        const result = await service.blockSeller(listingSlug);
        if (result.error) {
          showToast(result.error, 'error');
          button.disabled = false;
        } else {
          showToast(t('marketplace.sellerBlocked'));
          navigate('/marketplace');
        }
      }
    });
    root?.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-market-report]');
      if (!form) return;
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      const message = form.querySelector('[data-report-result]');
      try {
        const values = new FormData(form);
        const result = await service.report(form.dataset.listingId, String(values.get('reason')), String(values.get('details') || '').trim());
        message.textContent = result.error || t('marketplace.reportSent');
      } catch { message.textContent = t('marketplace.errors.report'); }
      finally { button.disabled = false; }
    });
    return;
  }

  const featured = document.querySelector('[data-market-featured]');
  const grid = document.querySelector('[data-market-grid]');
  const more = document.querySelector('[data-market-more]');
  const status = document.querySelector('[data-market-status]');
  const filters = document.querySelector('.market-filters');
  let cursor = null;
  let loading = false;
  let personalized = false;
  let debounce;

  const values = () => Object.fromEntries([...filters.querySelectorAll('[data-market-filter]')].map((input) => [input.dataset.marketFilter, input.value.trim()]));
  const load = async ({ append = false } = {}) => {
    if (loading) return;
    loading = true;
    more.disabled = true;
    status.textContent = t('common.loading');
    const query = values();
    const { data, error } = await service.getCatalog({ ...query, cursor: append ? cursor : null, limit: 12 });
    if (!grid?.isConnected) return;
    if (error) {
      status.textContent = error;
      if (!append) grid.innerHTML = emptyState(t('marketplace.empty'), t('marketplace.errors.load'));
    } else {
      personalized = Boolean(data.personalization_enabled);
      const organic = data.listings || [];
      if (!append) {
        featured.innerHTML = data.featured?.length ? data.featured.map(card).join('') : emptyState(t('marketplace.noFeatured'), t('marketplace.noFeaturedBody'));
        grid.innerHTML = organic.length ? organic.map(card).join('') : emptyState(t('marketplace.empty'), t('marketplace.emptyBody'));
        const category = filters.querySelector('[data-market-filter="category"]');
        if (category.options.length === 1) category.insertAdjacentHTML('beforeend', (data.categories || []).map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(getLanguage() === 'es' ? item.name_es : item.name_en)}</option>`).join(''));
      } else if (organic.length) grid.insertAdjacentHTML('beforeend', organic.map(card).join(''));
      cursor = data.next_cursor || null;
      more.hidden = !cursor;
      status.textContent = organic.length ? '' : append ? t('marketplace.end') : '';
    }
    loading = false;
    more.disabled = false;
  };

  filters?.addEventListener('input', (event) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const query = values();
      load();
      if (personalized) {
        const eventType = event.target.dataset.marketFilter === 'search' ? 'search' : 'filter';
        const context = { category: query.category, region: query.region, platform: query.platform, type: query.type, search: query.search };
        if (eventType === 'search' ? query.search : Object.values(context).some(Boolean)) service.recordRecommendation(eventType, { context });
      }
    }, 350);
  });
  more?.addEventListener('click', () => load({ append: true }));
  load();
  return () => clearTimeout(debounce);
}
