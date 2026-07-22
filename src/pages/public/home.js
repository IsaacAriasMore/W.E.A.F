import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { t } from '../../i18n/index.js';

const tool = (href, code, title, body, link) => `<a class="home-tool cinematic-card reveal-up" href="${href}" data-link><span>${code}</span><h3>${title}</h3><p>${body}</p><strong>${link} →</strong></a>`;

const faq = [
  ['¿Necesito cuenta para usar INIs?', 'No. Las herramientas públicas se pueden consultar sin iniciar sesión.'],
  ['¿Los breeds son públicos?', 'No. Los breeds, mutaciones y actividad pertenecen al espacio privado de cada tribu.'],
  ['¿Puedo usarlo para ASA?', 'Sí. W.E.A.F separa contenido compatible con ASE, ASA o ambos.'],
  ['¿El webhook de Discord es privado?', 'Sí. La URL se guarda para la tribu y no se muestra en páginas públicas.'],
  ['¿Puedo publicar mi servidor?', 'Sí. Puedes elegir un plan mensual Normal o Plus y completar el pago con Stripe.'],
  ['¿W.E.A.F está afiliado a ARK o Wildcard?', 'No. Es una herramienta independiente creada para la comunidad.'],
];

function featuredCard(server) {
  return `<article class="home-server-card cinematic-card reveal-scale">
    <div>${server.banner_url ? `<img src="${escapeHtml(server.banner_url)}" alt="" loading="lazy">` : '<img src="/assets/weaf-hero.webp" alt="Paisaje prehistórico de W.E.A.F" loading="lazy">'}</div>
    <span>${server.game.toUpperCase()} / ${escapeHtml(server.server_type)}</span>
    <h3>${escapeHtml(server.title)}</h3>
    <p>${escapeHtml(server.region)}. ${escapeHtml(server.maps?.slice(0, 2).join(', ') || t('servers.noSpecification'))}</p>
    <a class="text-link" href="/servers" data-link>${t('home.servers.view')} →</a>
  </article>`;
}

export function render() {
  return `<section class="hero home-hero">
    <div class="hero-atmosphere" aria-hidden="true"></div>
    <div class="hero-inner container">
      <div class="hero-copy reveal-left">
        <p class="hero-kicker">${t('home.hero.eyebrow')}</p>
        <h1>${t('home.hero.title')}</h1>
        <p>${t('home.hero.subtitle')}</p>
        <div class="hero-actions"><a class="button button-primary" href="/register" data-link>${t('home.hero.primary')}</a><a class="button button-secondary" href="/inis" data-link>${t('home.hero.secondary')}</a><a class="button button-quiet" href="/servers" data-link>${t('home.hero.servers')}</a></div>
      </div>
      <figure class="hero-visual reveal-right">
        <img src="/assets/weaf-hero.webp" width="1536" height="1024" alt="Criaturas prehistóricas recorren una meseta volcánica al amanecer" loading="eager" fetchpriority="high">
        <figcaption><span>ASE + ASA</span><strong>Planifica. Cría. Progresa.</strong></figcaption>
      </figure>
    </div>
    <a class="home-scroll-cue" href="#public-tools">Explorar <span aria-hidden="true">↓</span></a>
  </section>

  <section id="public-tools" class="home-section container">
    <div class="home-heading reveal-up"><h2>${t('home.tools.title')}</h2><p>${t('home.tools.body')}</p></div>
    <div class="home-tool-grid">
      ${tool('/inis', 'INI', 'INIs listas para copiar', 'Filtra por objetivo y descarga una configuración limpia.', 'Abrir biblioteca')}
      ${tool('/maps-bosses', 'BOSS', 'Mapas & Bosses', 'Marca tributos por mapa, boss y dificultad.', 'Preparar batalla')}
      ${tool('/creatures', 'DEX', 'Biblioteca de criaturas', 'Encuentra especies por juego, mapa y función.', 'Explorar criaturas')}
      ${tool('/servers', 'LIVE', 'Servidores destacados', 'Compara mapas, rates, plataformas y estilo de juego.', 'Ver servidores')}
    </div>
  </section>

  <section class="home-private home-section">
    <div class="container home-private-grid">
      <div class="home-private-copy reveal-left"><h2>${t('home.private.title')}</h2><p>${t('home.private.body')}</p><a class="button button-primary" href="/register" data-link>${t('common.signUp')}</a></div>
      <div class="home-ledger reveal-right" aria-label="Funciones privadas"><div><strong>Roles claros</strong><span>owner / admin / member</span></div><div><strong>Breeds y mutaciones</strong><span>aislados por tribu</span></div><div><strong>Discord</strong><span>alertas con webhook privado</span></div></div>
    </div>
  </section>

  <section class="home-section container home-game-layout">
    <div class="home-heading reveal-up"><h2>${t('home.games.title')}</h2><p>${t('home.games.body')}</p></div>
    <div class="home-game-board reveal-scale"><article><span>ASE</span><h3>Evolved</h3><p>Catálogo establecido, mapas clásicos y configuraciones maduras.</p></article><div><strong>Ambos</strong><p>Objetivos, coordinación y privacidad con el contexto correcto.</p></div><article><span>ASA</span><h3>Ascended</h3><p>Contenido compatible y un catálogo preparado para crecer.</p></article></div>
  </section>

  <section class="home-breeding home-section container">
    <div class="home-breeding-visual reveal-left"><img src="/assets/weaf-hero.webp" alt="Criaturas prehistóricas en el entorno original de W.E.A.F" loading="lazy"></div>
    <div class="home-breeding-copy reveal-right"><h2>${t('home.breeding.title')}</h2><p>${t('home.breeding.body')}</p><div><span>Con propagadores</span><strong>Cooldown configurable</strong></div><div><span>Breeding vanilla</span><strong>Multiplicador y tiempos reales</strong></div></div>
  </section>

  <section class="home-featured home-section">
    <div class="container"><div class="home-heading reveal-up"><h2>${t('home.servers.title')}</h2><p>${t('home.servers.body')}</p></div><div class="home-server-rail" data-home-featured><div class="server-loading"></div><div class="server-loading"></div></div><div class="home-server-actions reveal-up"><a class="button button-primary" href="/servers" data-link>${t('home.servers.view')}</a><a class="button button-secondary" href="/servers/owners" data-link>${t('home.servers.publish')}</a></div></div>
  </section>
  <div class="container sponsored-break reveal">${createSponsoredServerSlot('home_hero_secondary', 'Comunidad Plus')}</div>

  <section class="home-section container home-process"><div class="home-heading reveal-up"><h2>${t('home.steps.title')}</h2></div><ol>${['account', 'tribe', 'config', 'breeds', 'alerts'].map((key) => `<li class="reveal-up"><strong>${t(`home.steps.${key}`)}</strong></li>`).join('')}</ol></section>

  <section class="home-community home-section container reveal-scale"><div><h2>${t('home.community.title')}</h2><p>${t('home.community.body')}</p></div><div><strong>No es una app oficial.</strong><p>La independencia está documentada y visible en cada página.</p></div></section>

  <section class="home-section container home-faq"><div class="home-heading reveal-up"><h2>${t('home.faq.title')}</h2></div><div class="home-faq-list">${faq.map(([question, answer]) => `<details class="reveal-up"><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div></section>

  <section class="home-final container reveal-scale"><h2>${t('home.final.title')}</h2><div><a class="button button-primary" href="/register" data-link>${t('home.hero.primary')}</a><a class="button button-secondary" href="/servers" data-link>${t('home.final.servers')}</a></div></section>`;
}

export function bind({ authService }) {
  const rail = document.querySelector('[data-home-featured]');
  const service = createServerService(authService.getClient());
  service.listPublic().then((result) => {
    const featured = result.data.filter((server) => server.is_featured).slice(0, 3);
    rail.innerHTML = featured.length ? featured.map(featuredCard).join('') : `<div class="home-server-empty"><strong>El escaparate está listo.</strong><p>Los servidores Plus aparecerán aquí cuando Stripe confirme su suscripción.</p><a class="text-link" href="/servers/owners" data-link>${t('home.servers.publish')} →</a></div>`;
  });
}
