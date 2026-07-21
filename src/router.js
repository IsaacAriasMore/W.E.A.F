const routeLoaders = {
  '/': () => import('./pages/public/home.js'),
  '/inis': () => import('./pages/public/inis.js'),
  '/maps-bosses': () => import('./pages/public/mapsBosses.js'),
  '/creatures': () => import('./pages/public/creatures.js'),
  '/terms': () => import('./pages/public/legal.js'),
  '/privacy': () => import('./pages/public/legal.js'),
  '/cookies': () => import('./pages/public/legal.js'),
  '/disclaimer': () => import('./pages/public/legal.js'),
  '/refund-policy': () => import('./pages/public/legal.js'),
  '/server-listing-policy': () => import('./pages/public/legal.js'),
  '/report-content': () => import('./pages/public/legal.js'),
  '/contact': () => import('./pages/public/legal.js'),
};

const titles = {
  '/': 'W.E.A.F | Wild Evolution & Ascension Forge',
  '/inis': 'INIs públicas | W.E.A.F',
  '/maps-bosses': 'Mapas & Bosses | W.E.A.F',
  '/creatures': 'Biblioteca de criaturas | W.E.A.F',
  '/terms': 'Términos | W.E.A.F',
  '/privacy': 'Privacidad | W.E.A.F',
  '/cookies': 'Cookies | W.E.A.F',
  '/disclaimer': 'Disclaimer | W.E.A.F',
  '/refund-policy': 'Política de reembolsos | W.E.A.F',
  '/server-listing-policy': 'Política de servidores | W.E.A.F',
  '/report-content': 'Reportar contenido | W.E.A.F',
  '/contact': 'Contacto | W.E.A.F',
};

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function createRouter({ outlet, onRouteChange }) {
  let cleanup = null;
  let navigationId = 0;

  async function render(pathname) {
    const path = normalizePath(pathname);
    const currentNavigation = ++navigationId;
    cleanup?.();
    cleanup = null;

    outlet.innerHTML = `
      <section class="route-loading container" aria-label="Cargando contenido">
        <span class="skeleton skeleton-title"></span>
        <span class="skeleton skeleton-copy"></span>
      </section>
    `;

    const loader = routeLoaders[path];
    if (!loader) {
      outlet.innerHTML = `
        <section class="empty-page container">
          <p class="section-kicker">Ruta no encontrada</p>
          <h1>Esta coordenada no existe.</h1>
          <p>Regresa a las herramientas públicas de W.E.A.F.</p>
          <a class="button button-primary" href="/" data-link>Volver al inicio</a>
        </section>
      `;
      document.title = 'Página no encontrada | W.E.A.F';
      onRouteChange(path);
      outlet.focus({ preventScroll: true });
      return;
    }

    try {
      const page = await loader();
      if (currentNavigation !== navigationId) return;
      outlet.innerHTML = page.render({ path });
      cleanup = page.bind?.({ path, navigate }) || null;
      document.title = titles[path];
      onRouteChange(path);
      outlet.focus({ preventScroll: true });
    } catch (error) {
      outlet.innerHTML = `
        <section class="empty-page container">
          <p class="section-kicker">No pudimos cargar esta página</p>
          <h1>La ruta necesita otro intento.</h1>
          <p>Tu información local permanece intacta.</p>
          <button class="button button-primary" type="button" data-retry>Intentar de nuevo</button>
        </section>
      `;
      outlet.querySelector('[data-retry]')?.addEventListener('click', () => render(path));
    }
  }

  function navigate(pathname) {
    const path = normalizePath(pathname);
    if (path === normalizePath(window.location.pathname)) return;
    window.history.pushState({}, '', path);
    render(path);
  }

  function start() {
    window.addEventListener('popstate', () => render(window.location.pathname));
    render(window.location.pathname);
  }

  return { navigate, start };
}
