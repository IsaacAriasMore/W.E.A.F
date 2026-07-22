import { destinationFromSearch, pathWithNext } from '../../utils/navigation.js';
import { getLanguage, setLanguage, t } from '../../i18n/index.js';

const navigation = [
  { href: '/', key: 'nav.home' },
  { href: '/inis', key: 'nav.inis' },
  { href: '/maps-bosses', key: 'nav.mapsBosses' },
  { href: '/creatures', key: 'nav.creatures' },
  { href: '/servers', key: 'nav.servers' },
];

export function createPublicHeader() {
  return `
    <header class="site-header" data-header>
      <div class="header-inner container">
        <a class="brand" href="/" data-link aria-label="W.E.A.F, inicio">
          <img src="/assets/weaf-mark.svg" width="38" height="38" alt="" />
          <span><strong>W.E.A.F</strong><small>Evolution Forge</small></span>
        </a>
        <nav class="desktop-nav" aria-label="Navegación principal">
          ${navigation.map((item) => `<a href="${item.href}" data-link data-nav-link data-i18n="${item.key}">${t(item.key)}</a>`).join('')}
        </nav>
        <div class="header-actions">
          <div class="language-switch" role="group" aria-label="Idioma / Language" data-language-switch>
            <button type="button" data-language="es" aria-pressed="${getLanguage() === 'es'}">ES</button>
            <button type="button" data-language="en" aria-pressed="${getLanguage() === 'en'}">EN</button>
          </div>
          <div class="header-auth" data-header-auth>
            <a class="button button-quiet header-login" href="/login" data-link>Ingresar</a>
          </div>
          <button class="menu-button" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-button>
            <span class="sr-only" data-i18n="nav.menuOpen">${t('nav.menuOpen')}</span>
            <span></span><span></span>
          </button>
        </div>
      </div>
      <nav id="mobile-menu" class="mobile-menu" aria-label="Navegación móvil" hidden>
        ${navigation.map((item) => `<a href="${item.href}" data-link data-nav-link data-i18n="${item.key}">${t(item.key)}</a>`).join('')}
        <a class="button button-primary" href="/register" data-link data-mobile-auth data-i18n="common.signUp">${t('common.signUp')}</a>
      </nav>
    </header>
  `;
}

export function updateHeaderAuth(session, pathname = window.location.pathname) {
  const desktop = document.querySelector('[data-header-auth]');
  const mobile = document.querySelector('[data-mobile-auth]');
  if (!desktop || !mobile) return;

  const destination = destinationFromSearch(window.location.search, null);

  if (session?.user) {
    const appHref = destination || '/app';
    desktop.innerHTML = `
      <a class="button button-quiet header-login" href="${appHref}" data-link data-i18n="common.myTribe">${t('common.myTribe')}</a>
      <button class="button button-secondary button-small" type="button" data-sign-out data-i18n="common.signOut">${t('common.signOut')}</button>
    `;
    mobile.textContent = t('common.myTribe');
    mobile.setAttribute('href', appHref);
    return;
  }

  const onLogin = pathname === '/login';
  const href = pathWithNext(onLogin ? '/register' : '/login', destination);
  const key = onLogin ? 'common.signUp' : 'common.signIn';
  const label = t(key);
  desktop.innerHTML = `<a class="button button-quiet header-login" href="${href}" data-link data-i18n="${key}">${label}</a>`;
  mobile.textContent = label;
  mobile.setAttribute('href', href);
}

export function bindPublicHeader(navigate, refresh) {
  const button = document.querySelector('[data-menu-button]');
  const menu = document.querySelector('#mobile-menu');
  document.querySelector('[data-language-switch]')?.addEventListener('click', (event) => {
    const language = event.target.closest('[data-language]')?.dataset.language;
    if (!language || language === getLanguage()) return;
    setLanguage(language);
    document.querySelectorAll('[data-language]').forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.language === language)));
    refresh?.();
  });

  button?.addEventListener('click', () => {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    button.querySelector('.sr-only').textContent = isOpen ? t('nav.menuOpen') : t('nav.menuClose');
    menu.hidden = isOpen;
  });

  menu?.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link) return;
    button.setAttribute('aria-expanded', 'false');
    button.querySelector('.sr-only').textContent = t('nav.menuOpen');
    menu.hidden = true;
    navigate(`${link.pathname}${link.search}`);
  });
}

export function setActiveNavigation(pathname) {
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const isActive = link.getAttribute('href') === pathname;
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
