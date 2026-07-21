import {
  bindPublicHeader,
  createPublicHeader,
  setActiveNavigation,
  updateHeaderAuth,
} from './components/layout/PublicHeader.js';
import { createFooter } from './components/layout/Footer.js';
import { createRouter } from './router.js';
import { createAuthService } from './services/authService.js';
import { createProfileService } from './services/profileService.js';
import { createAppStore } from './stores/appStore.js';
import { createInactivityLogout } from './utils/inactivityLogout.js';
import { showToast } from './utils/feedback.js';

function createSessionExpiredDialog() {
  return `
    <dialog class="content-dialog session-dialog" data-session-dialog>
      <div class="dialog-header">
        <div>
          <span>Sesión protegida</span>
          <h2>Tu sesión expiró</h2>
        </div>
      </div>
      <p>Cerramos tu sesión después de 4 horas sin actividad. Tus datos guardados permanecen intactos.</p>
      <div class="dialog-actions">
        <button class="button button-primary" type="button" data-session-dialog-close>Volver a ingresar</button>
      </div>
    </dialog>
  `;
}

export async function startApp(root) {
  root.innerHTML = `
    ${createPublicHeader()}
    <main id="main-content" tabindex="-1">
      <section class="route-loading container" aria-label="Preparando W.E.A.F">
        <span class="skeleton skeleton-title"></span>
        <span class="skeleton skeleton-copy"></span>
      </section>
    </main>
    ${createFooter()}
    ${createSessionExpiredDialog()}
    <div class="toast-region" aria-live="polite" aria-atomic="true"></div>
  `;

  const authService = createAuthService();
  const profileService = createProfileService(authService.getClient());
  const store = createAppStore({ configured: authService.isConfigured() });
  let router;
  let inactivity;

  const hydrateProfile = async (session) => {
    if (!session?.user || !authService.isConfigured()) return null;
    const { profile } = await profileService.getProfile(session.user.id);
    return profile;
  };

  const initialSession = await authService.getSession();
  store.setState({
    session: initialSession,
    profile: await hydrateProfile(initialSession),
    ready: true,
  });

  router = createRouter({
    outlet: root.querySelector('#main-content'),
    getContext: () => ({ authService, profileService, store, state: store.getState() }),
    onRouteChange(pathname) {
      setActiveNavigation(pathname);
      updateHeaderAuth(store.getState().session, pathname);
      document.body.dataset.routeKind = pathname === '/app'
        ? 'app'
        : ['/login', '/register', '/onboarding'].includes(pathname) ? 'auth' : 'public';
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
  });

  const syncSession = async (session, { refresh = true, preserveActivity = false } = {}) => {
    const previousUserId = store.getState().session?.user?.id;
    store.setState({ session, profile: session ? store.getState().profile : null });
    updateHeaderAuth(session, window.location.pathname);

    inactivity?.stop();
    inactivity = null;
    if (session) {
      inactivity = createInactivityLogout({
        storageKey: `weaf:last-activity:${session.user.id}`,
        resetOnStart: !preserveActivity,
        onExpire: async () => {
          await authService.signOut({ localOnly: true });
          store.setState({ session: null, profile: null });
          updateHeaderAuth(null, '/login');
          router.replace('/login');
          root.querySelector('[data-session-dialog]')?.showModal();
        },
      });
      inactivity.start();
    }

    if (session?.user?.id && session.user.id !== previousUserId) {
      store.setState({ profile: await hydrateProfile(session) });
    }
    if (refresh) router.refresh();
  };

  updateHeaderAuth(initialSession);
  await syncSession(initialSession, { refresh: false, preserveActivity: true });
  bindPublicHeader(router.navigate);

  authService.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    window.setTimeout(() => syncSession(session), 0);
  });

  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a[data-link]');
    if (link && link.origin === window.location.origin) {
      event.preventDefault();
      router.navigate(`${link.pathname}${link.search}`);
      return;
    }

    const signOut = event.target.closest('[data-sign-out]');
    if (signOut) {
      signOut.disabled = true;
      const result = await authService.signOut();
      if (result.error) {
        showToast(result.error, 'error');
        signOut.disabled = false;
      } else {
        await syncSession(null);
        router.navigate('/');
      }
      return;
    }

    const pending = event.target.closest('[data-coming-soon]');
    if (pending) showToast(pending.dataset.comingSoon || 'Esta función llega en una fase posterior.');
  });

  root.querySelector('[data-session-dialog-close]')?.addEventListener('click', () => {
    root.querySelector('[data-session-dialog]')?.close();
    root.querySelector('[name="email"]')?.focus();
  });

  router.start();
}
