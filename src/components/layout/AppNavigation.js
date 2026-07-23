import { escapeHtml } from '../../utils/sanitize.js';

export function createAppNavigation(profile) {
  const displayName = escapeHtml(profile?.display_name || 'Survivor');
  const currentPath = window.location.pathname;
  const current = (path) => currentPath === path ? ' aria-current="page"' : '';

  return `
    <aside class="app-sidebar" aria-label="Navegación privada">
      <div class="app-user">
        <span>${displayName.slice(0, 1).toUpperCase()}</span>
        <div><strong>${displayName}</strong><small>Perfil W.E.A.F</small></div>
      </div>
      <nav>
        <a href="/app" data-link${current('/app')}><span aria-hidden="true">◆</span>Centro de tribu</a>
        <a href="/app/breeds" data-link${current('/app/breeds')}><span aria-hidden="true">◇</span>Breeding</a>
        <a href="/app/mutations" data-link${current('/app/mutations')}><span aria-hidden="true">＋</span>Mutaciones</a>
        <a href="/app/tribe-settings" data-link${current('/app/tribe-settings')}><span aria-hidden="true">○</span>Configuración</a>
      </nav>
      ${profile?.global_role === 'admin'
        ? '<a class="app-admin-link" href="/admin" data-link>Administración global</a>'
        : ''}
    </aside>
    <nav class="app-mobile-nav" aria-label="Navegación privada móvil">
      <a href="/app" data-link${current('/app')}><span aria-hidden="true">◆</span>Tribu</a>
      <a href="/app/breeds" data-link${current('/app/breeds')}><span aria-hidden="true">◇</span>Breeds</a>
      <a href="/app/mutations" data-link${current('/app/mutations')}><span aria-hidden="true">＋</span>Mutaciones</a>
      <a href="/app/tribe-settings" data-link${current('/app/tribe-settings')}><span aria-hidden="true">○</span>Ajustes</a>
    </nav>
  `;
}
