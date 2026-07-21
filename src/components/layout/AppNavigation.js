import { escapeHtml } from '../../utils/sanitize.js';

export function createAppNavigation(profile) {
  const displayName = escapeHtml(profile?.display_name || 'Survivor');
  return `
    <aside class="app-sidebar" aria-label="Navegación privada">
      <div class="app-user">
        <span>${displayName.slice(0, 1).toUpperCase()}</span>
        <div><strong>${displayName}</strong><small>Perfil W.E.A.F</small></div>
      </div>
      <nav>
        <a href="/app" data-link aria-current="page"><span>◆</span>Centro de tribu</a>
        <button type="button" data-coming-soon="Breeding privado llega en la Fase 4."><span>◇</span>Breeding</button>
        <button type="button" data-coming-soon="Mutaciones llegan en la Fase 4."><span>＋</span>Mutaciones</button>
        <button type="button" data-coming-soon="Discord por tribu llega en la Fase 4."><span>◌</span>Discord</button>
      </nav>
      <a class="app-profile-link" href="/onboarding" data-link>Editar perfil</a>
    </aside>
    <nav class="app-mobile-nav" aria-label="Navegación privada móvil">
      <a href="/app" data-link aria-current="page"><span>◆</span>Tribu</a>
      <button type="button" data-coming-soon="Breeding privado llega en la Fase 4."><span>◇</span>Breeding</button>
      <a href="/onboarding" data-link><span>●</span>Perfil</a>
    </nav>
  `;
}
