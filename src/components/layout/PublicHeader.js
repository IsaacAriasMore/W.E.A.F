import { destinationFromSearch, pathWithNext } from '../../utils/navigation.js';

const navigation = [
  { href: '/', label: 'Inicio' },
  { href: '/inis', label: 'INIs' },
  { href: '/maps-bosses', label: 'Mapas & Bosses' },
  { href: '/creatures', label: 'Criaturas' },
  { href: '/servers', label: 'Servidores' },
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
          ${navigation.map((item) => `<a href="${item.href}" data-link data-nav-link>${item.label}</a>`).join('')}
        </nav>
        <div class="header-actions">
          <div class="header-auth" data-header-auth>
            <a class="button button-quiet header-login" href="/login" data-link>Ingresar</a>
          </div>
          <button class="menu-button" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-button>
            <span class="sr-only">Abrir menú</span>
            <span></span><span></span>
          </button>
        </div>
      </div>
      <nav id="mobile-menu" class="mobile-menu" aria-label="Navegación móvil" hidden>
        ${navigation.map((item) => `<a href="${item.href}" data-link data-nav-link>${item.label}</a>`).join('')}
        <a class="button button-primary" href="/register" data-link data-mobile-auth>Crear cuenta</a>
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
      <a class="button button-quiet header-login" href="${appHref}" data-link>Mi tribu</a>
      <button class="button button-secondary button-small" type="button" data-sign-out>Salir</button>
    `;
    mobile.textContent = 'Mi tribu';
    mobile.setAttribute('href', appHref);
    return;
  }

  const onLogin = pathname === '/login';
  const href = pathWithNext(onLogin ? '/register' : '/login', destination);
  const label = onLogin ? 'Crear cuenta' : 'Ingresar';
  desktop.innerHTML = `<a class="button button-quiet header-login" href="${href}" data-link>${label}</a>`;
  mobile.textContent = label;
  mobile.setAttribute('href', href);
}

export function bindPublicHeader(navigate) {
  const button = document.querySelector('[data-menu-button]');
  const menu = document.querySelector('#mobile-menu');

  button?.addEventListener('click', () => {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    button.querySelector('.sr-only').textContent = isOpen ? 'Abrir menú' : 'Cerrar menú';
    menu.hidden = isOpen;
  });

  menu?.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link) return;
    button.setAttribute('aria-expanded', 'false');
    button.querySelector('.sr-only').textContent = 'Abrir menú';
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
