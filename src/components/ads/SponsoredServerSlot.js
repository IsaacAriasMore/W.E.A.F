import { createServerService } from '../../services/serverService.js';
import { hasMeasurementConsent } from '../../services/consentService.js';
import { escapeHtml } from '../../utils/sanitize.js';

export function createSponsoredServerSlot(placement, label = 'Servidor recomendado') {
  return `<aside class="sponsored-slot" data-sponsored-placement="${placement}" data-sponsored-label="${escapeHtml(label)}" hidden></aside>`;
}

function sponsoredCard(server, label) {
  return `
    <article class="sponsored-server" data-sponsored-server="${server.id}">
      <div class="sponsored-server-mark"><span>Promoción interna</span><strong>${escapeHtml(label)}</strong></div>
      <div class="sponsored-server-copy">
        <span>${escapeHtml(server.game.toUpperCase())} / ${escapeHtml(server.region)}</span>
        <h2>${escapeHtml(server.title)}</h2>
        <p>${escapeHtml(server.description)}</p>
      </div>
      <div class="sponsored-server-meta"><span>${escapeHtml(server.server_type.toUpperCase())}</span><span>${escapeHtml(server.language)}</span></div>
      <a class="button button-secondary button-small" href="${escapeHtml(server.discord_invite_url)}" target="_blank" rel="noopener noreferrer" data-sponsored-click>Conocer servidor</a>
    </article>`;
}

export function bindSponsoredServerSlots(container, client) {
  const service = createServerService(client);
  let dataPromise;

  async function loadData() {
    if (!client) return { settings: [], servers: [] };
    if (!dataPromise) dataPromise = Promise.all([
      client.from('ads_settings').select('placement,provider,configuration').eq('enabled', true),
      service.listPublic(),
    ]).then(([settingsResult, serversResult]) => ({
      settings: settingsResult.data || [],
      servers: (serversResult.data || []).filter((server) => server.is_featured || server.plan === 'plus').slice(0, 6),
    }));
    return dataPromise;
  }

  async function hydrate(slot) {
    slot.dataset.sponsoredHydrated = 'true';
    const { settings, servers } = await loadData();
    const setting = settings.find((item) => item.placement === slot.dataset.sponsoredPlacement);
    if (!setting || setting.provider !== 'internal' || !servers.length) return;
    const index = [...container.querySelectorAll('[data-sponsored-placement]')].indexOf(slot);
    const server = servers[Math.max(0, index) % servers.length];
    slot.innerHTML = sponsoredCard(server, slot.dataset.sponsoredLabel);
    slot.hidden = false;

    if (hasMeasurementConsent()) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          service.track(server.id, 'impression');
          observer.disconnect();
        }
      }, { threshold: 0.55 });
      observer.observe(slot);
    }

    slot.querySelector('[data-sponsored-click]')?.addEventListener('click', () => {
      if (hasMeasurementConsent()) service.track(server.id, 'discord_click');
    });
  }

  function scan() {
    container.querySelectorAll('[data-sponsored-placement]:not([data-sponsored-hydrated])').forEach(hydrate);
  }

  const observer = new MutationObserver(scan);
  observer.observe(container, { childList: true, subtree: true });
  scan();
  return () => observer.disconnect();
}
