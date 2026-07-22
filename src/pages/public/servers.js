import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { t } from '../../i18n/index.js';

const options = (label, values) => `<label><span>${label}</span><select data-server-filter><option value="">${t('common.all')}</option>${values.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;

function arrayLabel(values, fallback = 'Sin especificar') {
  return values?.length ? values.map(escapeHtml).join(' · ') : fallback;
}

function rateLabel(rates = {}) {
  if (rates.preset === 'not_specified') return t('servers.noSpecification');
  const entries = Object.entries(rates).filter(([key]) => key !== 'preset').slice(0, 4);
  return entries.length ? entries.map(([key, value]) => `${escapeHtml(key)} ${escapeHtml(String(value))}x`).join(' · ') : t('servers.noSpecification');
}

function card(server) {
  const isNew = Date.now() - new Date(server.created_at).getTime() < 14 * 86400000;
  return `<article class="server-card cinematic-card reveal-up reveal-visible" data-server-card data-game="${escapeHtml(server.game)}" data-type="${escapeHtml(server.server_type)}" data-region="${escapeHtml(server.region)}" data-language="${escapeHtml(server.language)}" data-mods="${server.has_mods}" data-propagators="${server.uses_propagators}" data-platforms="${escapeHtml(server.platforms?.join('|').toLowerCase() || '')}" data-cluster="${server.cluster_name ? 'true' : 'false'}">
    <div class="server-card-media">${server.banner_url ? `<img src="${escapeHtml(server.banner_url)}" alt="" loading="lazy">` : '<span>W.E.A.F / SERVER</span>'}<div class="server-badges">${server.is_featured ? `<b>${t('servers.featured')}</b>` : ''}${server.is_verified ? '<b>Verificado</b>' : ''}${isNew ? '<b>Nuevo</b>' : ''}</div></div>
    <div class="server-card-body">
      <div class="server-card-title"><div><span>${escapeHtml(server.game.toUpperCase())} · ${escapeHtml(server.server_type)}</span><h2>${escapeHtml(server.title)}</h2></div><small>${escapeHtml(server.region)} / ${escapeHtml(server.language)}</small></div>
      <p>${escapeHtml(server.description)}</p>
      <dl><div><dt>${t('servers.maps')}</dt><dd>${arrayLabel(server.maps)}</dd></div><div><dt>${t('servers.platforms')}</dt><dd>${arrayLabel(server.platforms)}</dd></div><div><dt>${t('servers.rates')}</dt><dd>${rateLabel(server.rates)}</dd></div><div><dt>${t('servers.mods')}</dt><dd>${server.has_mods ? t('common.yes') : t('common.no')}</dd></div></dl>
      ${server.cluster_name || server.wipe_date || server.uses_propagators ? `<div class="server-notes">${server.cluster_name ? `<span>Cluster: ${escapeHtml(server.cluster_name)}</span>` : ''}${server.wipe_date ? `<span>Wipe: ${escapeHtml(server.wipe_date)}</span>` : ''}${server.uses_propagators ? '<span>Propagadores</span>' : ''}</div>` : ''}
      <div class="server-card-actions"><a class="button button-primary" href="${escapeHtml(server.discord_invite_url)}" target="_blank" rel="noopener noreferrer" data-discord-click="${server.id}">Entrar a Discord</a>${server.website_url ? `<a class="button button-quiet" href="${escapeHtml(server.website_url)}" target="_blank" rel="noopener noreferrer">Sitio web</a>` : ''}</div>
    </div>
  </article>`;
}

export function render() {
  return `<section class="servers-hero reveal-up"><div class="container"><p>Directorio comunitario</p><h1>Encuentra un servidor con tus reglas.</h1><div><span>ASE + ASA</span><span>Información directa</span><span>Sin rankings artificiales</span></div></div></section>
    <section class="servers-directory container">
      <aside class="server-filters" aria-label="Filtros de servidores"><div><h2>Filtrar</h2><button type="button" data-clear-server-filters>Limpiar</button></div>
        ${options('Juego', [['evolved','ASE'],['ascended','ASA']])}${options('Modo', [['pvp','PvP'],['pve','PvE'],['pvpve','PvPvE']])}${options('Mods', [['true','Con mods'],['false','Sin mods']])}${options('Plataforma', [['steam','Steam'],['epic','Epic'],['console','Consola'],['crossplay','Crossplay']])}
        <label><span>Región</span><input type="search" data-server-search="region" placeholder="Ej. LATAM"></label><label><span>Idioma</span><input type="search" data-server-search="language" placeholder="Ej. Español"></label>
        ${options('Cluster', [['true','Sí'],['false','No']])}${options('Propagadores', [['true','Sí'],['false','No']])}
      </aside>
      <div class="server-results"><header><div><span data-server-count>Buscando servidores…</span><h2>${t('servers.available')}</h2></div><div class="server-owner-actions"><a class="button button-primary" href="/servers/publish" data-link>${t('servers.publish')}</a><a class="text-link" href="/servers/owners#owner-plans" data-link>Ver cómo funciona</a></div></header>${createSponsoredServerSlot('servers_featured', 'Servidor Plus')}<div data-server-list class="server-list"><div class="server-loading"></div><div class="server-loading"></div></div><div class="server-empty" data-server-empty><strong>${t('servers.empty')}</strong><p>Prueba una región más amplia o limpia los filtros.</p><button class="button button-secondary" type="button" data-clear-server-filters>${t('common.clear')}</button></div></div>
    </section>`;
}

export function bind({ authService }) {
  const service = createServerService(authService.getClient());
  const list = document.querySelector('[data-server-list]');
  const count = document.querySelector('[data-server-count]');
  const empty = document.querySelector('[data-server-empty]');
  let servers = [];

  function filter() {
    const selects = [...document.querySelectorAll('[data-server-filter]')].map((field) => field.value);
    const [game, type, mods, platform, cluster, propagators] = selects;
    const region = document.querySelector('[data-server-search="region"]').value.trim().toLowerCase();
    const language = document.querySelector('[data-server-search="language"]').value.trim().toLowerCase();
    const visible = servers.filter((server) => (!game || server.game === game) && (!type || server.server_type === type) && (!mods || String(server.has_mods) === mods) && (!platform || server.platforms?.some((item) => item.toLowerCase().includes(platform))) && (!cluster || String(Boolean(server.cluster_name)) === cluster) && (!propagators || String(server.uses_propagators) === propagators) && (!region || server.region.toLowerCase().includes(region)) && (!language || server.language.toLowerCase().includes(language)));
    list.innerHTML = visible.map(card).join('');
    empty.hidden = visible.length > 0;
    count.textContent = `${visible.length} ${visible.length === 1 ? 'servidor' : 'servidores'}`;
  }

  function clear() {
    document.querySelectorAll('[data-server-filter], [data-server-search]').forEach((field) => { field.value = ''; });
    filter();
  }

  document.querySelector('.servers-directory').addEventListener('input', (event) => { if (event.target.matches('[data-server-filter], [data-server-search]')) filter(); });
  document.querySelector('.servers-directory').addEventListener('click', (event) => {
    if (event.target.closest('[data-clear-server-filters]')) clear();
    const discord = event.target.closest('[data-discord-click]');
    if (discord) service.track(discord.dataset.discordClick, 'discord_click');
  });

  service.listPublic().then((result) => {
    servers = result.data;
    filter();
    servers.forEach((server) => service.track(server.id, 'impression'));
  });
}
