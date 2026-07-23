import { escapeHtml } from '../../utils/sanitize.js';

const sections = [
  ['overview', 'Pulso', '01'],
  ['users', 'Usuarios', '02'],
  ['tribes', 'Tribus', '03'],
  ['content', 'Contenido', '04'],
  ['operations', 'Operaciones', '05'],
  ['billing', 'Planes y ofertas', '06'],
  ['governance', 'Gobernanza', '07'],
  ['audit', 'Auditoría', '08'],
];

export function createAdminNavigation(profile, activeSection) {
  const name = escapeHtml(profile?.display_name || 'Administrador');
  return `
    <aside class="admin-sidebar" aria-label="Navegación administrativa">
      <a class="admin-wordmark" href="/admin" data-link><span>W.</span><strong>Command</strong></a>
      <div class="admin-identity"><span>${name.slice(0, 1).toUpperCase()}</span><div><strong>${name}</strong><small>Autoridad global</small></div></div>
      <nav>${sections.map(([key, label, index]) => `
        <a href="/admin?section=${key}" data-admin-section="${key}" ${activeSection === key ? 'aria-current="page"' : ''}><small>${index}</small>${label}
          ${key === 'overview' ? '<i aria-hidden="true"></i>' : ''}
        </a>`).join('')}</nav>
      <a class="admin-exit" href="/app" data-link>Volver a mi tribu <span aria-hidden="true">↗</span></a>
    </aside>
  `;
}

export function adminSectionOptions(activeSection) {
  return sections.map(([key, label]) => `<option value="${key}" ${key === activeSection ? 'selected' : ''}>${label}</option>`).join('');
}
