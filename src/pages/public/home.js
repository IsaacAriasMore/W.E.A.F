import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { t } from '../../i18n/index.js';
import { mountWeafThreeHero } from '../../components/visuals/WeafThreeHero.js';

const tool = (href, code, title, body, link) => `<a class="home-tool cinematic-card reveal-up" href="${href}" data-link><span>${code}</span><h3>${title}</h3><p>${body}</p><strong>${link} →</strong></a>`;

const faqKeys = ['1', '2', '3', '4', '5', '6'];

function featuredCard(server) {
  return `<article class="home-server-card cinematic-card reveal-scale">
    <div>${server.banner_url ? `<img src="${escapeHtml(server.banner_url)}" alt="" loading="lazy">` : `<img src="/assets/weaf-hero.webp" alt="${t('home.heroAlt')}" loading="lazy">`}</div>
    <span>${server.game.toUpperCase()} / ${escapeHtml(server.server_type)}</span>
    <h3>${escapeHtml(server.title)}</h3>
    <p>${escapeHtml(server.region)}. ${escapeHtml(server.maps?.slice(0, 2).join(', ') || t('servers.noSpecification'))}</p>
    <a class="text-link" href="/servers" data-link>${t('home.servers.view')} →</a>
  </article>`;
}

export function render() {
  return `<section class="hero home-hero">
    <div class="hero-atmosphere" aria-hidden="true"></div>
    <div class="three-hero-layer" data-three-hero aria-hidden="true"><span class="three-hero-fallback-orb"></span></div>
    <div class="hero-inner container">
      <div class="hero-copy reveal-left">
        <p class="hero-kicker">${t('home.hero.eyebrow')}</p>
        <h1>${t('home.hero.title')}</h1>
        <p>${t('home.hero.subtitle')}</p>
        <div class="hero-actions"><a class="button button-primary" href="/register" data-link>${t('home.hero.primary')}</a><a class="button button-secondary" href="/inis" data-link>${t('home.hero.secondary')}</a><a class="button button-quiet" href="/servers" data-link>${t('home.hero.servers')}</a></div>
      </div>
      <figure class="hero-visual reveal-right">
        <img src="/assets/weaf-hero.webp" width="1536" height="1024" alt="${t('home.heroAlt')}" loading="eager" fetchpriority="high">
        <figcaption><span>ASE + ASA</span><strong>${t('home.heroCaption')}</strong></figcaption>
      </figure>
    </div>
    <a class="home-scroll-cue" href="#public-tools">${t('home.scroll')} <span aria-hidden="true">↓</span></a>
  </section>

  <section id="public-tools" class="home-section container">
    <div class="home-heading reveal-up"><h2>${t('home.tools.title')}</h2><p>${t('home.tools.body')}</p></div>
    <div class="home-tool-grid">
      ${tool('/inis', 'INI', t('home.tools.inisTitle'), t('home.tools.inisBody'), t('home.tools.inisLink'))}
      ${tool('/maps-bosses', 'BOSS', t('home.tools.bossesTitle'), t('home.tools.bossesBody'), t('home.tools.bossesLink'))}
      ${tool('/creatures', 'DEX', t('home.tools.creaturesTitle'), t('home.tools.creaturesBody'), t('home.tools.creaturesLink'))}
      ${tool('/servers', 'LIVE', t('home.tools.serversTitle'), t('home.tools.serversBody'), t('home.tools.serversLink'))}
    </div>
  </section>

  <section class="home-private home-section">
    <div class="container home-private-grid">
      <div class="home-private-copy reveal-left"><h2>${t('home.private.title')}</h2><p>${t('home.private.body')}</p><a class="button button-primary" href="/register" data-link>${t('common.signUp')}</a></div>
      <div class="home-ledger reveal-right" aria-label="${t('home.private.title')}"><div><strong>${t('home.private.roles')}</strong><span>${t('home.private.rolesValue')}</span></div><div><strong>${t('home.private.breeds')}</strong><span>${t('home.private.breedsValue')}</span></div><div><strong>${t('home.private.discord')}</strong><span>${t('home.private.discordValue')}</span></div></div>
    </div>
  </section>

  <section class="home-section container home-game-layout">
    <div class="home-heading reveal-up"><h2>${t('home.games.title')}</h2><p>${t('home.games.body')}</p></div>
    <div class="home-game-board reveal-scale"><article><span>ASE</span><h3>${t('home.games.evolved')}</h3><p>${t('home.games.evolvedBody')}</p></article><div><strong>${t('home.games.both')}</strong><p>${t('home.games.bothBody')}</p></div><article><span>ASA</span><h3>${t('home.games.ascended')}</h3><p>${t('home.games.ascendedBody')}</p></article></div>
  </section>

  <section class="home-breeding home-section container">
    <div class="home-breeding-visual reveal-left"><img src="/assets/weaf-hero.webp" alt="${t('home.breeding.imageAlt')}" loading="lazy"></div>
    <div class="home-breeding-copy reveal-right"><h2>${t('home.breeding.title')}</h2><p>${t('home.breeding.body')}</p><div><span>${t('home.breeding.propagators')}</span><strong>${t('home.breeding.cooldown')}</strong></div><div><span>${t('home.breeding.vanilla')}</span><strong>${t('home.breeding.multipliers')}</strong></div></div>
  </section>

  <section class="home-featured home-section">
    <div class="container"><div class="home-heading reveal-up"><h2>${t('home.servers.title')}</h2><p>${t('home.servers.body')}</p></div><div class="home-server-rail" data-home-featured><div class="server-loading"></div><div class="server-loading"></div></div><div class="home-server-actions reveal-up"><a class="button button-primary" href="/servers" data-link>${t('home.servers.view')}</a><a class="button button-secondary" href="/servers/owners" data-link>${t('home.servers.publish')}</a></div></div>
  </section>
  <div class="container sponsored-break reveal">${createSponsoredServerSlot('home_hero_secondary', 'Comunidad Plus')}</div>

  <section class="home-section container home-process"><div class="home-heading reveal-up"><h2>${t('home.steps.title')}</h2></div><ol>${['account', 'tribe', 'config', 'breeds', 'alerts'].map((key) => `<li class="reveal-up"><strong>${t(`home.steps.${key}`)}</strong></li>`).join('')}</ol></section>

  <section class="home-community home-section container reveal-scale"><div><h2>${t('home.community.title')}</h2><p>${t('home.community.body')}</p></div><div><strong>${t('home.community.independent')}</strong><p>${t('home.community.independentBody')}</p></div></section>

  <section class="home-section container home-faq"><div class="home-heading reveal-up"><h2>${t('home.faq.title')}</h2></div><div class="home-faq-list">${faqKeys.map((key) => `<details class="reveal-up"><summary>${t(`home.faq.q${key}`)}</summary><p>${t(`home.faq.a${key}`)}</p></details>`).join('')}</div></section>

  <section class="home-final container reveal-scale"><h2>${t('home.final.title')}</h2><div><a class="button button-primary" href="/register" data-link>${t('home.hero.primary')}</a><a class="button button-secondary" href="/servers" data-link>${t('home.final.servers')}</a></div></section>`;
}

export function bind({ authService }) {
  const rail = document.querySelector('[data-home-featured]');
  const service = createServerService(authService.getClient());
  const cleanupThree = mountWeafThreeHero(document.querySelector('[data-three-hero]'));
  let disposed = false;
  service.listPublic().then((result) => {
    if (disposed || !rail) return;
    const featured = result.data.filter((server) => server.is_featured).slice(0, 3);
    rail.innerHTML = featured.length ? featured.map(featuredCard).join('') : `<div class="home-server-empty"><strong>${t('home.featuredEmpty.title')}</strong><p>${t('home.featuredEmpty.body')}</p><a class="text-link" href="/servers/owners" data-link>${t('home.servers.publish')} →</a></div>`;
  });
  return () => {
    disposed = true;
    cleanupThree();
  };
}
