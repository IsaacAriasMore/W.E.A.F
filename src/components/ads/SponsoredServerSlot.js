import { createServerService } from '../../services/serverService.js';
import { hasMeasurementConsent } from '../../services/consentService.js';
import { dismissAd, isAdDismissed } from '../../utils/adDismissal.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { t } from '../../i18n/index.js';

function placementOffset(placement, length) {
  if (!length) return 0;
  return [...placement].reduce((total, character) => total + character.charCodeAt(0), 0) % length;
}

function compactList(values) {
  if (!Array.isArray(values) || !values.length) return t('ads.notSpecified');
  const visible = values.slice(0, 3).map(escapeHtml).join(' · ');
  return values.length > 3 ? `${visible} +${values.length - 3}` : visible;
}

export function createSponsoredServerSlot(placement, {
  label = t('ads.internalPromotion'),
  variant = 'standard',
  dismissible = false,
  maxItems = 1,
  emptyMarkup = '',
  preview = false,
} = {}) {
  return `<aside class="sponsored-slot sponsored-slot-${escapeHtml(variant)}" data-sponsored-placement="${escapeHtml(placement)}" data-sponsored-label="${escapeHtml(label)}" data-sponsored-variant="${escapeHtml(variant)}" data-sponsored-dismissible="${dismissible}" data-sponsored-preview="${preview}" data-sponsored-max="${Math.max(1, Math.min(3, Number(maxItems) || 1))}" aria-label="${t('ads.internalAds')}"><div class="sponsored-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>${emptyMarkup ? `<template data-sponsored-empty>${emptyMarkup}</template>` : ''}</aside>`;
}

function promotionPreview() {
  return `<div class="plus-placement-preview premium-panel"><span>${t('ads.previewBadge')}</span><div><strong>Plus</strong><h2>${t('ads.previewTitle')}</h2><p>${t('ads.previewBody')}</p></div><div class="plus-placement-map" aria-hidden="true"><i>HOME</i><i>TOOLS</i><i>SERVER</i></div></div>`;
}

function sponsoredCard(server, label) {
  const game = server.game === 'both' ? 'ASE + ASA' : server.game?.toUpperCase();
  return `
    <article class="sponsored-server cinematic-card glow-card" data-sponsored-server="${server.id}">
      <header class="sponsored-server-mark">
        <span>${t('ads.internalPromotion')}</span>
        <strong>${escapeHtml(label)}</strong>
        <b>${t('ads.plusServer')}</b>
      </header>
      <div class="sponsored-server-copy">
        <span>${escapeHtml(game)} · ${escapeHtml(server.server_type?.toUpperCase())}</span>
        <h2>${escapeHtml(server.title)}</h2>
        <p>${escapeHtml(server.description)}</p>
      </div>
      <dl class="sponsored-server-facts">
        <div><dt>${t('ads.regionLanguage')}</dt><dd>${escapeHtml(server.region)} · ${escapeHtml(server.language)}</dd></div>
        <div><dt>${t('servers.maps')}</dt><dd>${compactList(server.maps)}</dd></div>
        <div><dt>${t('servers.platforms')}</dt><dd>${compactList(server.platforms)}</dd></div>
      </dl>
      <div class="sponsored-server-actions">
        <a class="button button-primary button-small" href="${escapeHtml(server.discord_invite_url)}" target="_blank" rel="noopener noreferrer" data-sponsored-event="discord_click">${t('ads.joinDiscord')}</a>
        ${server.website_url ? `<a class="button button-quiet button-small" href="${escapeHtml(server.website_url)}" target="_blank" rel="noopener noreferrer" data-sponsored-event="website_click">${t('ads.learnServer')}</a>` : ''}
        <a class="text-link" href="/servers" data-link>${t('ads.viewServers')}</a>
      </div>
    </article>`;
}

function renderEmpty(slot) {
  const template = slot.querySelector('[data-sponsored-empty]');
  if (!template) {
    slot.hidden = true;
    return;
  }
  slot.innerHTML = template.innerHTML;
  slot.dataset.sponsoredState = 'empty';
  slot.hidden = false;
}

export function bindSponsoredServerSlots(container, client) {
  if (!container) return () => {};
  const service = createServerService(client);
  const activeSlots = new Map();
  const trackedCards = new WeakSet();
  let cache = null;
  let cacheTime = 0;
  let dataPromise = null;

  async function loadData() {
    if (!client) return { settings: [], servers: [] };
    if (cache && Date.now() - cacheTime < 30000) return cache;
    if (!dataPromise) {
      dataPromise = Promise.all([
        client.from('ads_settings').select('placement,provider,configuration').eq('enabled', true),
        service.listPromotable(),
      ]).then(([settingsResult, serversResult]) => ({
        settings: settingsResult.error ? [] : settingsResult.data || [],
        servers: serversResult.error ? [] : serversResult.data || [],
      })).catch(() => ({ settings: [], servers: [] })).then((result) => {
        cache = result;
        cacheTime = Date.now();
        return result;
      }).finally(() => { dataPromise = null; });
    }
    return dataPromise;
  }

  function attachImpressions(slot, state) {
    if (!hasMeasurementConsent() || !('IntersectionObserver' in window)) {
      state.impressionObserver?.disconnect();
      state.impressionObserver = null;
      return;
    }
    if (!state.impressionObserver) {
      state.impressionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!hasMeasurementConsent() || !entry.isIntersecting || entry.intersectionRatio < 0.55 || trackedCards.has(entry.target)) return;
          trackedCards.add(entry.target);
          state.impressionObserver.unobserve(entry.target);
          service.track(entry.target.dataset.sponsoredServer, 'impression');
        });
      }, { threshold: 0.55 });
    }
    slot.querySelectorAll('[data-sponsored-server]').forEach((card) => {
      if (trackedCards.has(card)) return;
      state.impressionObserver.observe(card);
    });
  }

  function cleanupSlot(slot) {
    const state = activeSlots.get(slot);
    if (!state) return;
    state.impressionObserver?.disconnect();
    state.controller.abort();
    activeSlots.delete(slot);
  }

  async function hydrate(slot) {
    slot.dataset.sponsoredHydrated = 'true';
    const placement = slot.dataset.sponsoredPlacement;
    if (slot.dataset.sponsoredDismissible === 'true' && isAdDismissed(placement)) {
      slot.hidden = true;
      return;
    }

    const { settings, servers } = await loadData();
    if (!slot.isConnected) return;
    const setting = settings.find((item) => item.placement === placement);
    if (!setting || setting.provider !== 'internal') {
      slot.hidden = true;
      return;
    }
    if (slot.dataset.sponsoredPreview === 'true') {
      slot.innerHTML = promotionPreview();
      slot.dataset.sponsoredState = 'preview';
      slot.hidden = false;
      return;
    }
    if (!servers.length) {
      renderEmpty(slot);
      return;
    }

    const configuredMax = Number(setting.configuration?.max_items);
    const requestedMax = Number(slot.dataset.sponsoredMax);
    const maxItems = Math.max(1, Math.min(3, configuredMax || requestedMax || 1));
    const offset = placementOffset(placement, servers.length);
    const selected = [...servers.slice(offset), ...servers.slice(0, offset)].slice(0, maxItems);
    const dismissible = slot.dataset.sponsoredDismissible === 'true' || setting.configuration?.dismissible === true;
    const controller = new AbortController();
    const state = { controller, impressionObserver: null };
    activeSlots.set(slot, state);

    slot.innerHTML = `${dismissible ? `<button class="sponsored-dismiss" type="button" data-sponsored-dismiss aria-label="${t('ads.hideRecommendation')}">×</button>` : ''}<div class="sponsored-server-list">${selected.map((server) => sponsoredCard(server, slot.dataset.sponsoredLabel)).join('')}</div>`;
    slot.dataset.sponsoredState = 'ready';
    slot.hidden = false;

    slot.addEventListener('click', (event) => {
      if (event.target.closest('[data-sponsored-dismiss]')) {
        dismissAd(placement);
        slot.hidden = true;
        cleanupSlot(slot);
        return;
      }
      const action = event.target.closest('[data-sponsored-event]');
      const card = action?.closest('[data-sponsored-server]');
      if (action && card && hasMeasurementConsent()) {
        service.track(card.dataset.sponsoredServer, action.dataset.sponsoredEvent);
      }
    }, { signal: controller.signal });
    attachImpressions(slot, state);
  }

  function scan() {
    activeSlots.forEach((_, slot) => { if (!slot.isConnected) cleanupSlot(slot); });
    container.querySelectorAll('[data-sponsored-placement]:not([data-sponsored-hydrated])').forEach(hydrate);
  }

  const mutationObserver = new MutationObserver(scan);
  const onConsentChanged = () => activeSlots.forEach((state, slot) => attachImpressions(slot, state));
  mutationObserver.observe(container, { childList: true, subtree: true });
  window.addEventListener('weaf:consent-changed', onConsentChanged);
  scan();
  return () => {
    mutationObserver.disconnect();
    window.removeEventListener('weaf:consent-changed', onConsentChanged);
    activeSlots.forEach((_, slot) => cleanupSlot(slot));
  };
}
