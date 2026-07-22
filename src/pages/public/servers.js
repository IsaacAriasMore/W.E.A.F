import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { hasMeasurementConsent } from '../../services/consentService.js';
import { isPromotableServer } from '../../utils/serverPromotion.js';
import { t } from '../../i18n/index.js';

const options = (label, values) => `<label><span>${label}</span><select data-server-filter><option value="">${t('common.all')}</option>${values.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;

function arrayLabel(values, fallback = t('servers.noSpecification')) {
  return values?.length ? values.map(escapeHtml).join(' · ') : fallback;
}

function rateLabel(rates = {}) {
  if (rates.preset === 'not_specified') return t('servers.noSpecification');
  const entries = Object.entries(rates).filter(([key]) => key !== 'preset').slice(0, 4);
  return entries.length ? entries.map(([key, value]) => `${escapeHtml(key)} ${escapeHtml(String(value))}x`).join(' · ') : t('servers.noSpecification');
}

function card(server) {
  const isNew = Date.now() - new Date(server.created_at).getTime() < 14 * 86400000;
  const isPlus = isPromotableServer(server);
  return `<article class="server-card interactive-card reveal-up reveal-visible ${isPlus ? 'is-plus' : ''}" data-server-card data-server-id="${server.id}" data-game="${escapeHtml(server.game)}" data-type="${escapeHtml(server.server_type)}" data-region="${escapeHtml(server.region)}" data-language="${escapeHtml(server.language)}" data-mods="${server.has_mods}" data-propagators="${server.uses_propagators}" data-platforms="${escapeHtml(server.platforms?.join('|').toLowerCase() || '')}" data-cluster="${server.cluster_name ? 'true' : 'false'}">
    <div class="server-card-media">${server.banner_url ? `<img src="${escapeHtml(server.banner_url)}" alt="" loading="lazy">` : '<span>W.E.A.F / SERVER</span>'}<div class="server-badges">${isPlus ? `<b class="server-plus-badge">${t('servers.directory.plus')}</b>` : ''}${server.is_featured ? `<b>${t('servers.featured')}</b>` : ''}${server.is_verified ? `<b>${t('servers.directory.verified')}</b>` : ''}${isNew ? `<b>${t('servers.directory.new')}</b>` : ''}</div></div>
    <div class="server-card-body">
      <div class="server-card-title"><div><span>${escapeHtml(server.game.toUpperCase())} · ${escapeHtml(server.server_type)}</span><h2>${escapeHtml(server.title)}</h2></div><small>${escapeHtml(server.region)} / ${escapeHtml(server.language)}</small></div>
      <p>${escapeHtml(server.description)}</p>
      <dl><div><dt>${t('servers.maps')}</dt><dd>${arrayLabel(server.maps)}</dd></div><div><dt>${t('servers.platforms')}</dt><dd>${arrayLabel(server.platforms)}</dd></div><div><dt>${t('servers.rates')}</dt><dd>${rateLabel(server.rates)}</dd></div><div><dt>${t('servers.mods')}</dt><dd>${server.has_mods ? t('common.yes') : t('common.no')}</dd></div></dl>
      ${server.cluster_name || server.wipe_date || server.uses_propagators ? `<div class="server-notes">${server.cluster_name ? `<span>${t('servers.directory.cluster')}: ${escapeHtml(server.cluster_name)}</span>` : ''}${server.wipe_date ? `<span>${t('servers.directory.wipe')}: ${escapeHtml(server.wipe_date)}</span>` : ''}${server.uses_propagators ? `<span>${t('servers.directory.propagators')}</span>` : ''}</div>` : ''}
      <div class="server-card-actions"><a class="button button-primary" href="${escapeHtml(server.discord_invite_url)}" target="_blank" rel="noopener noreferrer" data-discord-click="${server.id}">${t('servers.directory.discord')}</a>${server.website_url ? `<a class="button button-quiet" href="${escapeHtml(server.website_url)}" target="_blank" rel="noopener noreferrer" data-website-click="${server.id}">${t('servers.directory.website')}</a>` : ''}</div>
    </div>
  </article>`;
}

export function render() {
  return `<section class="servers-hero" data-gsap-hero><div class="container" data-gsap-hero-item><p>${t('servers.directory.eyebrow')}</p><h1>${t('servers.directory.title')}</h1><div><span>${t('servers.directory.gameCoverage')}</span><span>${t('servers.directory.directInfo')}</span><span>${t('servers.directory.noRankings')}</span></div></div></section>
    <section class="servers-directory container reveal-up">
      <aside class="server-filters" aria-label="${t('servers.directory.filters')}"><div><h2>${t('servers.directory.filter')}</h2><button type="button" data-clear-server-filters>${t('common.clear')}</button></div>
        ${options(t('servers.directory.game'), [['evolved','ASE'],['ascended','ASA']])}${options(t('servers.directory.mode'), [['pvp','PvP'],['pve','PvE'],['pvpve','PvPvE']])}${options(t('servers.mods'), [['true',t('servers.directory.withMods')],['false',t('servers.directory.withoutMods')]])}${options(t('servers.directory.platform'), [['steam','Steam'],['epic','Epic'],['console',t('servers.directory.console')],['crossplay','Crossplay']])}
        <label><span>${t('servers.directory.region')}</span><input type="search" data-server-search="region" placeholder="${t('servers.directory.regionExample')}"></label><label><span>${t('servers.directory.language')}</span><input type="search" data-server-search="language" placeholder="${t('servers.directory.languageExample')}"></label>
        ${options(t('servers.directory.cluster'), [['true',t('common.yes')],['false',t('common.no')]])}${options(t('servers.directory.propagators'), [['true',t('common.yes')],['false',t('common.no')]])}
      </aside>
      <div class="server-results"><header><div><span data-server-count>${t('servers.directory.searching')}</span><h2>${t('servers.available')}</h2></div><div class="server-owner-actions"><a class="button button-primary" href="/servers/publish" data-link>${t('servers.publish')}</a><a class="text-link" href="/servers/owners#owner-plans" data-link>${t('servers.directory.howItWorks')}</a></div></header>${createSponsoredServerSlot('servers_featured', { label: t('ads.featuredServer'), variant: 'featured' })}<div data-server-list class="server-list"><div class="server-loading"></div><div class="server-loading"></div></div><div class="server-empty" data-server-empty><strong>${t('servers.empty')}</strong><p>${t('servers.directory.emptyHelp')}</p><p>${t('servers.directory.emptyPublish')}</p><div><button class="button button-secondary" type="button" data-clear-server-filters>${t('common.clear')}</button><a class="button button-quiet" href="/servers/publish" data-link>${t('ads.listServer')}</a></div>${createSponsoredServerSlot('empty_state_server_recommendation', { label: t('ads.communityPick'), variant: 'compact' })}</div></div>
    </section>`;
}

export function bind({ authService }) {
  const controller = new AbortController();
  const { signal } = controller;
  const service = createServerService(authService.getClient());
  const list = document.querySelector('[data-server-list]');
  const count = document.querySelector('[data-server-count]');
  const empty = document.querySelector('[data-server-empty]');
  let servers = [];
  let impressionObserver = null;

  function observeVisibleCards() {
    impressionObserver?.disconnect();
    impressionObserver = null;
    if (!hasMeasurementConsent() || !('IntersectionObserver' in window)) return;
    impressionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!hasMeasurementConsent() || !entry.isIntersecting || entry.intersectionRatio < 0.55) return;
        impressionObserver.unobserve(entry.target);
        service.track(entry.target.dataset.serverId, 'impression');
      });
    }, { threshold: 0.55 });
    list.querySelectorAll('[data-server-card]').forEach((element) => impressionObserver.observe(element));
  }

  function filter() {
    const selects = [...document.querySelectorAll('[data-server-filter]')].map((field) => field.value);
    const [game, type, mods, platform, cluster, propagators] = selects;
    const region = document.querySelector('[data-server-search="region"]').value.trim().toLowerCase();
    const language = document.querySelector('[data-server-search="language"]').value.trim().toLowerCase();
    const visible = servers.filter((server) => (!game || server.game === game) && (!type || server.server_type === type) && (!mods || String(server.has_mods) === mods) && (!platform || server.platforms?.some((item) => item.toLowerCase().includes(platform))) && (!cluster || String(Boolean(server.cluster_name)) === cluster) && (!propagators || String(server.uses_propagators) === propagators) && (!region || server.region.toLowerCase().includes(region)) && (!language || server.language.toLowerCase().includes(language)));
    list.innerHTML = visible.map(card).join('');
    empty.hidden = visible.length > 0;
    count.textContent = t(visible.length === 1 ? 'servers.directory.one' : 'servers.directory.many', { count: visible.length });
    observeVisibleCards();
  }

  function clear() {
    document.querySelectorAll('[data-server-filter], [data-server-search]').forEach((field) => { field.value = ''; });
    filter();
  }

  document.querySelector('.servers-directory').addEventListener('input', (event) => { if (event.target.matches('[data-server-filter], [data-server-search]')) filter(); }, { signal });
  document.querySelector('.servers-directory').addEventListener('click', (event) => {
    if (event.target.closest('[data-clear-server-filters]')) clear();
    const discord = event.target.closest('[data-discord-click]');
    if (discord && hasMeasurementConsent()) service.track(discord.dataset.discordClick, 'discord_click');
    const website = event.target.closest('[data-website-click]');
    if (website && hasMeasurementConsent()) service.track(website.dataset.websiteClick, 'website_click');
  }, { signal });
  window.addEventListener('weaf:consent-changed', observeVisibleCards, { signal });

  service.listPublic().then((result) => {
    servers = result.data;
    filter();
  });
  return () => {
    controller.abort();
    impressionObserver?.disconnect();
  };
}
