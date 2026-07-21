import { destinationFromSearch, pathWithNext } from './utils/navigation.js';

const routeLoaders = {
  '/': () => import('./pages/public/home.js'),
  '/inis': () => import('./pages/public/inis.js'),
  '/maps-bosses': () => import('./pages/public/mapsBosses.js'),
  '/creatures': () => import('./pages/public/creatures.js'),
  '/servers': () => import('./pages/public/servers.js'),
  '/servers/owners': () => import('./pages/public/serverOwners.js'),
  '/login': () => import('./pages/auth/login.js'),
  '/register': () => import('./pages/auth/register.js'),
  '/onboarding': () => import('./pages/auth/onboarding.js'),
  '/app': () => import('./pages/app/tribeDashboard.js'),
  '/app/breeds': () => import('./pages/app/breedingWorkspace.js'),
  '/app/mutations': () => import('./pages/app/breedingWorkspace.js'),
  '/app/tribe-settings': () => import('./pages/app/tribeSettings.js'),
  '/admin': () => import('./pages/admin/adminDashboard.js'),
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
  '/servers': 'Servidores ASE y ASA | W.E.A.F',
  '/servers/owners': 'Publica tu servidor | W.E.A.F',
  '/login': 'Ingresar | W.E.A.F',
  '/register': 'Crear cuenta | W.E.A.F',
  '/onboarding': 'Configurar perfil | W.E.A.F',
  '/app': 'Centro de tribu | W.E.A.F',
  '/app/breeds': 'Breeding privado | W.E.A.F',
  '/app/mutations': 'Mutaciones | W.E.A.F',
  '/app/tribe-settings': 'Configuración de tribu | W.E.A.F',
  '/admin': 'Administración global | W.E.A.F',
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

const guestOnlyRoutes = new Set(['/login', '/register']);
const protectedRoutes = new Set([
  '/onboarding', '/app', '/app/breeds', '/app/mutations', '/app/tribe-settings', '/admin',
]);

export function createRouter({ outlet, onRouteChange, getContext }) {
  let cleanup = null;
  let navigationId = 0;

  async function render(pathname) {
    const path = normalizePath(pathname);
    const context = getContext();

    if (protectedRoutes.has(path) && !context.state.session) {
      replace(pathWithNext('/login', `${path}${window.location.search}`));
      return;
    }

    if (guestOnlyRoutes.has(path) && context.state.session) {
      const destination = destinationFromSearch(window.location.search, null);
      replace(context.state.profile?.onboarding_completed
        ? destination || '/app'
        : pathWithNext('/onboarding', destination));
      return;
    }

    if (path.startsWith('/app') && context.state.profile && !context.state.profile.onboarding_completed) {
      replace('/onboarding');
      return;
    }

    if (path === '/admin' && context.state.profile?.global_role !== 'admin') {
      replace('/app');
      return;
    }

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
      outlet.innerHTML = page.render({ path, ...context });
      cleanup = page.bind?.({ path, navigate, ...context }) || null;
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

  function navigate(destination) {
    const url = new URL(destination, window.location.origin);
    const path = normalizePath(url.pathname);
    if (`${path}${url.search}` === `${normalizePath(window.location.pathname)}${window.location.search}`) return;
    window.history.pushState({}, '', `${path}${url.search}`);
    render(path);
  }

  function replace(destination) {
    const url = new URL(destination, window.location.origin);
    window.history.replaceState({}, '', `${normalizePath(url.pathname)}${url.search}`);
    render(url.pathname);
  }

  function start() {
    window.addEventListener('popstate', () => render(window.location.pathname));
    render(window.location.pathname);
  }

  return { navigate, replace, refresh: () => render(window.location.pathname), start };
}
