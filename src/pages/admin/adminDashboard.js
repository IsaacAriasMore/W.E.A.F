import { createAdminNavigation, adminSectionOptions } from '../../components/layout/AdminNavigation.js';
import { createAdminService } from '../../services/adminService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { formatRelativeTime } from '../../utils/dates.js';
import { showToast } from '../../utils/feedback.js';
import {
  RATE_FIELDS,
  SERVER_MAPS,
  SERVER_PLATFORMS,
  availableForGame,
  normalizeRates,
} from '../../config/serverListing.js';

const sectionNames = {
  overview: ['Pulso de plataforma', 'Señales operativas para decidir qué necesita atención.'],
  users: ['Usuarios', 'Identidad, acceso y estado de cada superviviente.'],
  tribes: ['Tribus', 'Tenants, propietarios y actividad de comunidad.'],
  content: ['Contenido público', 'Catálogo editorial compartido por ASA y ASE.'],
  operations: ['Operaciones', 'Servidores, planes y trazabilidad de pagos.'],
  governance: ['Gobernanza', 'Moderación, flags, anuncios y documentos legales.'],
  audit: ['Auditoría', 'Registro inmutable de decisiones sensibles.'],
};

const SPECIES_STATS = [
  ['health', 'Vida'], ['stamina', 'Estamina'], ['oxygen', 'Oxígeno'], ['food', 'Comida'],
  ['weight', 'Peso'], ['melee', 'Daño cuerpo a cuerpo'], ['speed', 'Velocidad'],
];

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function choiceInputs(name, items, { type = 'checkbox', selected = [] } = {}) {
  const active = new Set(selected.map(String));
  return items.map((item) => {
    const value = String(item.value ?? item.name ?? item.label);
    return `<label><input type="${type}" name="${name}" value="${escapeHtml(value)}" ${active.has(value) ? 'checked' : ''}><span>${escapeHtml(item.label ?? item.name)}</span></label>`;
  }).join('');
}

function adminChoiceGroup({ legend, help, name, items, type = 'checkbox', selected = [], serverOptions = false }) {
  return `<fieldset class="admin-choice-group" ${serverOptions ? `data-admin-server-options="${name}"` : ''}><legend>${legend}</legend>${help ? `<p>${help}</p>` : ''}<div class="admin-choices">${choiceInputs(name, items, { type, selected })}</div></fieldset>`;
}

function adminRates() {
  return `<fieldset class="admin-choice-group"><legend>Rates del servidor</legend><p>Usa un preset o detalla multiplicadores. 1x equivale a vanilla/oficial.</p><label><span>Configuración</span><select name="rate_preset" data-admin-rate-preset><option value="not_specified">No especificar</option><option value="vanilla">Vanilla / Oficial</option><option value="low">Bajos</option><option value="medium">Medios</option><option value="high">Altos</option><option value="custom">Personalizados</option></select></label><div class="admin-rate-grid" data-admin-custom-rates hidden>${RATE_FIELDS.map(([key, label, help]) => `<label><span>${label}</span><input name="rate_${key}" type="number" min="0.01" max="1000" step="0.01" value="1"><small>${help}</small></label>`).join('')}</div></fieldset>`;
}

function currentSection() {
  const section = new URLSearchParams(window.location.search).get('section');
  return sectionNames[section] ? section : 'overview';
}

function empty(label) {
  return `<div class="admin-empty"><span>0</span><p>${label}</p></div>`;
}

function status(value, positive = ['active', 'paid', 'resolved', 'completed']) {
  return `<span class="admin-status ${positive.includes(value) ? 'is-positive' : ''}">${escapeHtml(value)}</span>`;
}

function table(headers, rows, emptyLabel) {
  if (!rows.length) return empty(emptyLabel);
  return `<div class="admin-table-wrap"><table><thead><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function overview(data) {
  const m = data.metrics;
  const metric = (label, value, note) => `<article><p>${label}</p><strong>${value}</strong><small>${note}</small></article>`;
  return `
    <section class="admin-metrics" aria-label="Métricas globales">
      ${metric('Usuarios', m.users_total, `+${m.users_30d} en 30 días`)}
      ${metric('Activos 30d', m.active_30d, 'Sesiones recientes')}
      ${metric('Tribus', m.tribes_total, 'Tenants registrados')}
      ${metric('Breeds activos', m.active_breeds, `${m.mutations_30d} mutaciones / 30d`)}
      ${metric('Ingresos', `$${(m.revenue_cents / 100).toFixed(2)}`, 'Pagos confirmados')}
      ${metric('Reportes', m.pending_reports, `${m.webhook_failures_24h} fallos Discord / 24h`)}
    </section>
    <div class="admin-overview-grid">
      <section><div class="admin-block-heading"><span>Atención</span><h2>Cola operativa</h2></div>
        <div class="admin-signal"><strong>${m.pending_reports}</strong><div><h3>Reportes por resolver</h3><p>Revisión humana y trazabilidad obligatoria.</p></div><a href="/admin?section=governance" data-link>Abrir</a></div>
        <div class="admin-signal"><strong>${m.webhook_failures_24h}</strong><div><h3>Fallos de Discord</h3><p>Entregas fallidas durante las últimas 24 horas.</p></div><a href="/admin?section=audit" data-link>Rastrear</a></div>
      </section>
      <section><div class="admin-block-heading"><span>Actividad</span><h2>Últimas decisiones</h2></div>
        <div class="admin-mini-log">${data.audit.slice(0, 6).map((item) => `<div><span></span><p><strong>${escapeHtml(item.action)}</strong><small>${escapeHtml(item.actor_name || 'Sistema')} · ${formatRelativeTime(item.created_at)}</small></p></div>`).join('') || '<p class="admin-muted">Todavía no hay acciones administrativas.</p>'}</div>
      </section>
    </div>`;
}

function users(data) {
  return table(['Usuario', 'Alta', 'Último acceso', 'Estado', 'Acción'], data.users.map((user) => `<tr>
    <td><strong>${escapeHtml(user.display_name)}</strong><small>${escapeHtml(user.email)} · ${escapeHtml(user.global_role)}</small></td>
    <td>${formatRelativeTime(user.created_at)}</td><td>${user.last_sign_in_at ? formatRelativeTime(user.last_sign_in_at) : 'Sin acceso'}</td>
    <td>${status(user.is_suspended ? 'suspended' : 'active')}</td>
    <td><button class="admin-action" data-user-suspension="${user.id}" data-next="${!user.is_suspended}">${user.is_suspended ? 'Restaurar' : 'Suspender'}</button></td>
  </tr>`), 'No hay usuarios registrados.');
}

function tribes(data) {
  return table(['Tribu', 'Juego', 'Escala', 'Estado', 'Acción'], data.tribes.map((tribe) => `<tr>
    <td><strong>${escapeHtml(tribe.name)}</strong><small>${escapeHtml(tribe.owner_name)} · ${escapeHtml(tribe.slug)}</small></td>
    <td>${escapeHtml(tribe.game_mode)}</td><td>${tribe.member_count} miembros · ${tribe.breed_count} breeds</td>
    <td>${status(tribe.is_active ? 'active' : 'paused')}</td>
    <td><button class="admin-action" data-tribe-active="${tribe.id}" data-next="${!tribe.is_active}">${tribe.is_active ? 'Pausar' : 'Restaurar'}</button></td>
  </tr>`), 'No hay tribus registradas.');
}

function content(data) {
  return `<div class="admin-content-grid">
    <section class="admin-primary-list"><div class="admin-block-heading"><span>Especies</span><h2>Catálogo de breeding</h2></div>
      ${table(['Nombre', 'Juego', 'Cooldown', 'Visibilidad', ''], data.species.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></td><td>${escapeHtml(item.game_availability)}</td><td>${item.vanilla_mating_cooldown_hours}h</td><td>${status(item.is_public && item.is_active ? 'active' : 'draft')}</td><td><button class="admin-action" data-archive-content="species" data-id="${item.id}">Archivar</button></td></tr>`), 'Sin especies.')}
    </section>
    <aside class="admin-editor"><div><span>Nueva entrada</span><h2>Editor editorial</h2><p>Crea especies, presets INI, mapas y bosses. La URL se genera automáticamente a partir del nombre.</p></div>
      <form data-content-form>
        <label><span>Tipo</span><select name="entity" data-content-entity><option value="species">Especie</option><option value="ini">Preset INI</option><option value="map">Mapa</option><option value="boss">Boss</option></select></label>
        <div data-content-fields="species"><label><span>Nombre de la especie</span><input name="species_name" minlength="2" data-content-required required></label><label><span>Categoría</span><select name="species_category" data-content-required required><option value="Terrestre">Terrestre</option><option value="Volador">Volador</option><option value="Acuático">Acuático</option><option value="Especial">Especial</option></select></label><label><span>Cooldown vanilla mínimo (horas)</span><input name="cooldown" type="number" min="0.1" max="1000" step="0.1" data-content-required required></label>${adminChoiceGroup({ legend: 'Stats disponibles', help: 'Marca los stats que la tribu podrá registrar.', name: 'species_stats', items: SPECIES_STATS.map(([value, label]) => ({ value, label })), selected: SPECIES_STATS.map(([value]) => value) })}<label><span>Notas de uso (opcional)</span><textarea name="species_notes" rows="3"></textarea></label><label><span>URL de imagen original/licenciada (opcional)</span><input name="species_image" type="url"></label></div>
        <div data-content-fields="ini" hidden><label><span>Título público</span><input name="ini_title" minlength="2" data-content-required></label><label><span>Categoría</span><select name="ini_category" data-content-required><option value="general">General</option><option value="farming">Farming</option><option value="pvp">PvP</option><option value="hard">Hard</option><option value="fps">FPS</option><option value="visibility">Visibilidad</option><option value="clean">Clean</option></select></label><label><span>Qué cambia y para quién sirve</span><textarea name="ini_description" minlength="20" rows="3" data-content-required></textarea></label><label><span>Contenido INI revisado</span><textarea name="ini_content" minlength="4" rows="7" spellcheck="false" data-content-required></textarea></label><label><span>URL de imagen original/licenciada (opcional)</span><input name="ini_image" type="url"></label></div>
        <div data-content-fields="map" hidden><label><span>Nombre oficial del mapa</span><input name="map_name" minlength="2" data-content-required></label><label><span>Resumen de progresión</span><textarea name="map_description" minlength="20" rows="4" data-content-required></textarea></label><label><span>URL de imagen original/licenciada (opcional)</span><input name="map_image" type="url"></label></div>
        <div data-content-fields="boss" hidden><label><span>Nombre del boss</span><input name="boss_name" minlength="2" data-content-required></label><label><span>Mapa</span><select name="map_id" data-content-required ${data.maps.length ? '' : 'disabled'}>${data.maps.map((map) => `<option value="${map.id}">${escapeHtml(map.name)}</option>`).join('') || '<option value="">Crea un mapa primero</option>'}</select></label><label><span>Estrategia y requisitos resumidos</span><textarea name="boss_notes" minlength="20" rows="5" data-content-required></textarea></label><label><span>URL de imagen original/licenciada (opcional)</span><input name="boss_image" type="url"></label><p class="admin-field-note">Los tributos por dificultad se completan en el roadmap de datos estructurados. No publiques un boss sin una fuente verificada.</p></div>
        <label data-game-field><span>Juego</span><select name="game"><option value="both">Ambos</option><option value="ascended">ASA</option><option value="evolved">ASE</option></select></label>
        <label class="admin-check"><input name="public" type="checkbox"><span>Publicar inmediatamente</span></label><p class="form-status" data-form-status hidden></p><button class="button button-primary" type="submit">Crear entrada</button>
      </form>
    </aside>
    <section class="admin-secondary-lists">
      <details><summary><span>Presets INI</span><strong>${data.inis.length}</strong><small>${data.inis.filter((x) => x.is_public).length} publicados</small></summary>${data.inis.map((item) => `<div><p>${escapeHtml(item.title)}</p><button class="admin-action" data-archive-content="ini" data-id="${item.id}">Archivar</button></div>`).join('') || '<p>Sin presets.</p>'}</details>
      <details><summary><span>Mapas</span><strong>${data.maps.length}</strong><small>${data.maps.filter((x) => x.is_public).length} públicos</small></summary>${data.maps.map((item) => `<div><p>${escapeHtml(item.name)}</p><button class="admin-action" data-archive-content="map" data-id="${item.id}">Archivar</button></div>`).join('') || '<p>Sin mapas.</p>'}</details>
      <details><summary><span>Bosses</span><strong>${data.bosses.length}</strong><small>${data.bosses.filter((x) => x.is_public).length} públicos</small></summary>${data.bosses.map((item) => `<div><p>${escapeHtml(item.name)}</p><button class="admin-action" data-archive-content="boss" data-id="${item.id}">Archivar</button></div>`).join('') || '<p>Sin bosses.</p>'}</details>
    </section>
  </div>`;
}

function operations(data) {
  const workspace = data.serverOps || { listings: [], totals: {} };
  const totals = workspace.totals || {};
  return `<div class="admin-stack">
    <section class="admin-server-metrics"><div><span>Activos</span><strong>${totals.active || 0}</strong></div><div><span>Impresiones</span><strong>${totals.impressions || 0}</strong></div><div><span>Clics</span><strong>${totals.clicks || 0}</strong></div><div><span>Conversión</span><strong>${totals.conversion_rate || 0}%</strong></div></section>
    <div class="admin-content-grid"><section class="admin-primary-list"><div class="admin-block-heading"><span>Marketplace</span><h2>Servidores</h2></div>${table(['Servidor', 'Plan', 'Alcance', 'Estado', 'Gestión'], workspace.listings.map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.game)} · ${escapeHtml(item.server_type)} · ${escapeHtml(item.region)}</small></td><td>${escapeHtml(item.plan)}<small>${item.expires_at ? `vence ${formatRelativeTime(item.expires_at)}` : 'sin vencimiento'}</small></td><td>${item.impression_count} vistas<small>${item.click_count} clics</small></td><td><select data-server-status="${item.id}" data-featured="${item.is_featured}" data-verified="${item.is_verified}">${['active','paused','expired','canceled','rejected'].map((option) => `<option value="${option}" ${item.status === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td><td><select data-renew-duration="${item.id}"><option value="1">+1 mes</option><option value="3">+3 meses</option><option value="9">+9 meses</option><option value="12">+12 meses</option></select><button class="admin-action" data-renew-server="${item.id}">Renovar</button><button class="admin-action is-danger" data-delete-server="${item.id}">Eliminar</button></td></tr>`), 'No hay servidores publicados.')}</section>
      <aside class="admin-editor"><div><span>Alta manual</span><h2>Publicar servidor</h2><p>Otorga una publicación sin pago. El slug se genera de forma segura y no se solicitan listas por comas.</p></div><form data-server-form>
        <label><span>Nombre del servidor</span><input name="title" minlength="2" maxlength="100" required></label>
        <div class="admin-field-pair"><label><span>Juego</span><select name="game" data-admin-server-game><option value="ascended">ASA</option><option value="evolved">ASE</option><option value="both">ASE + ASA</option></select></label><label><span>Modo</span><select name="server_type"><option value="pve">PvE</option><option value="pvp">PvP</option><option value="pvpve">PvPvE</option></select></label></div>
        <div class="admin-field-pair"><label><span>Alcance manual</span><select name="plan"><option value="manual">Normal manual</option><option value="plus">Destacado manual</option></select></label><label><span>Duración concedida</span><select name="duration"><option value="1">1 mes</option><option value="3">3 meses</option><option value="9">9 meses</option><option value="12">12 meses</option><option value="">Indefinida</option></select><small>Indefinida no crea renovación ni cobro automático.</small></label></div>
        <div class="admin-field-pair"><label><span>Región</span><input name="region" minlength="2" required></label><label><span>Idioma</span><input name="language" minlength="2" required></label></div>
        ${adminChoiceGroup({ legend: 'Mapas disponibles', help: 'Selecciona al menos un mapa.', name: 'maps', items: availableForGame(SERVER_MAPS, 'ascended'), serverOptions: true })}
        ${adminChoiceGroup({ legend: 'Plataformas disponibles', help: 'Selecciona al menos una plataforma compatible.', name: 'platforms', items: availableForGame(SERVER_PLATFORMS, 'ascended').map((item) => ({ ...item, value: item.label })), serverOptions: true })}
        ${adminChoiceGroup({ legend: '¿Tiene mods?', help: 'Solo se registra si usa mods; no se solicitan nombres.', name: 'has_mods', type: 'radio', items: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }], selected: ['false'] })}
        ${adminRates()}
        <div class="admin-field-pair"><label><span>Cluster</span><input name="cluster_name"></label><label><span>Último wipe</span><input name="wipe_date" type="date"></label></div>
        <label><span>Discord</span><input name="discord" type="url" placeholder="https://discord.gg/..." required></label><label><span>Sitio web (opcional)</span><input name="website" type="url"></label><label><span>Banner original/licenciado (opcional)</span><input name="banner" type="url"></label><label><span>Descripción pública</span><textarea name="description" minlength="20" maxlength="4000" rows="5" required></textarea></label>
        <label class="admin-check"><input name="verified" type="checkbox"><span>Servidor verificado</span></label><label class="admin-check"><input name="propagators" type="checkbox"><span>Usa propagadores</span></label><button class="button button-primary" type="submit">Publicar servidor</button>
      </form></aside></div>
    <div class="admin-split"><section><div class="admin-block-heading"><span>Oferta</span><h2>Planes</h2></div>${data.plans.map((plan) => `<div class="admin-line"><p><strong>${escapeHtml(plan.name)}</strong><small>${escapeHtml(plan.code)}</small></p><span>$${(plan.price_usd_cents / 100).toFixed(2)}</span></div>`).join('') || empty('Los planes se configurarán antes de Stripe.')}</section>
    <section><div class="admin-block-heading"><span>Finanzas</span><h2>Pagos recientes</h2></div>${data.payments.map((payment) => `<div class="admin-line"><p><strong>${escapeHtml(payment.email)}</strong><small>${escapeHtml(payment.plan_name)}</small></p><span>$${(payment.amount_usd_cents / 100).toFixed(2)} · ${escapeHtml(payment.status)}</span></div>`).join('') || empty('Sin pagos; Stripe se activa en la Fase 7.')}</section></div>
  </div>`;
}

function governance(data) {
  return `<div class="admin-governance">
    <section><div class="admin-block-heading"><span>Moderación</span><h2>Reportes</h2></div>${table(['Entidad', 'Motivo', 'Estado', 'Resolver'], data.reports.map((report) => `<tr><td>${escapeHtml(report.entity_type)}<small>${escapeHtml(report.reporter_name || 'Anónimo')}</small></td><td>${escapeHtml(report.reason)}</td><td>${status(report.status)}</td><td><select data-report-status="${report.id}"><option value="open" ${report.status === 'open' ? 'selected' : ''}>Abierto</option><option value="reviewing" ${report.status === 'reviewing' ? 'selected' : ''}>Revisando</option><option value="resolved" ${report.status === 'resolved' ? 'selected' : ''}>Resuelto</option><option value="dismissed" ${report.status === 'dismissed' ? 'selected' : ''}>Descartado</option></select></td></tr>`), 'No hay reportes pendientes.')}</section>
    <div class="admin-split"><section><div class="admin-block-heading"><span>Lanzamientos</span><h2>Feature flags</h2></div>${data.flags.map((flag) => `<label class="admin-toggle"><span><strong>${escapeHtml(flag.key)}</strong><small>${escapeHtml(flag.description || 'Sin descripción')}</small></span><input type="checkbox" data-flag="${escapeHtml(flag.key)}" data-description="${escapeHtml(flag.description || '')}" ${flag.enabled ? 'checked' : ''}></label>`).join('') || empty('Sin flags configurados.')}<form class="admin-inline-form" data-flag-form><input name="key" placeholder="nuevo_flag" required><input name="description" placeholder="Descripción"><button class="admin-action">Crear</button></form></section>
    <section><div class="admin-block-heading"><span>Monetización</span><h2>Publicidad</h2></div>${data.ads.map((ad) => `<label class="admin-toggle"><span><strong>${escapeHtml(ad.placement)}</strong><small>${escapeHtml(ad.provider)}</small></span><input type="checkbox" data-ad="${escapeHtml(ad.placement)}" data-provider="${escapeHtml(ad.provider)}" ${ad.enabled ? 'checked' : ''}></label>`).join('') || empty('Sin placements configurados.')}</section></div>
    <section><div class="admin-block-heading"><span>Legal</span><h2>Documentos</h2></div>${table(['Documento', 'Versión', 'Estado', 'Actualización'], data.legal.map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.document_type)}</small></td><td>${escapeHtml(item.version)}</td><td>${status(item.is_published ? 'published' : 'draft')}</td><td>${formatRelativeTime(item.updated_at)}</td></tr>`), 'No hay documentos legales.')}
      <details class="admin-legal-editor"><summary>Redactar nueva versión</summary><form data-legal-form><div><input name="type" placeholder="privacy" required><input name="version" placeholder="2026-08" required><input name="title" placeholder="Título público" required></div><textarea name="content" rows="7" minlength="20" placeholder="Contenido completo del documento" required></textarea><label><input name="publish" type="checkbox"> Publicar al guardar</label><button class="admin-action" type="submit">Guardar versión</button></form></details>
    </section>
  </div>`;
}

function audit(data) {
  return table(['Momento', 'Actor', 'Acción', 'Entidad'], data.audit.map((item) => `<tr><td>${formatRelativeTime(item.created_at)}</td><td>${escapeHtml(item.actor_name || 'Sistema')}</td><td><strong>${escapeHtml(item.action)}</strong></td><td>${escapeHtml(item.entity_type)}<small>${escapeHtml(item.entity_id || 'sin ID')}</small></td></tr>`), 'Todavía no hay eventos de auditoría.');
}

const renderers = { overview, users, tribes, content, operations, governance, audit };

export function render({ state }) {
  const section = currentSection();
  return `<div class="admin-shell">${createAdminNavigation(state.profile, section)}<main class="admin-main" data-admin-main>
    <div class="admin-mobile-selector"><label><span>Área administrativa</span><select data-admin-mobile>${adminSectionOptions(section)}</select></label></div>
    <section class="admin-loading" aria-label="Cargando centro de comando"><span></span><span></span><span></span></section>
  </main></div>`;
}

export function bind({ state, authService, navigate }) {
  const service = createAdminService(authService.getClient());
  const main = document.querySelector('[data-admin-main]');
  let data;

  async function load(section = currentSection()) {
    main.setAttribute('aria-busy', 'true');
    const [result, serverResult] = await Promise.all([service.getWorkspace(), service.getServerWorkspace()]);
    if (result.error) {
      main.innerHTML = `<section class="admin-failure"><span>403</span><h1>Centro de comando bloqueado</h1><p>${escapeHtml(result.error)}</p><a class="button button-primary" href="/app" data-link>Volver a la tribu</a></section>`;
      return;
    }
    data = result.data;
    data.serverOps = serverResult.data || { listings: [], totals: {} };
    const [title, description] = sectionNames[section];
    main.innerHTML = `<div class="admin-mobile-selector"><label><span>Área administrativa</span><select data-admin-mobile>${adminSectionOptions(section)}</select></label></div>
      <header class="admin-header"><div><p>W.E.A.F / Global</p><h1>${title}</h1><span>${description}</span></div><div class="admin-live"><i></i>Supabase conectado</div></header>
      <div class="admin-view" data-admin-view>${renderers[section](data)}</div>`;
    main.removeAttribute('aria-busy');
    document.querySelectorAll('[data-admin-section]').forEach((link) => link.toggleAttribute('aria-current', link.dataset.adminSection === section));
  }

  async function action(result, success = 'Cambio aplicado.') {
    if (result.error) showToast(result.error, 'error');
    else { showToast(success); await load(); }
  }

  main.addEventListener('change', async (event) => {
    if (event.target.matches('[data-admin-mobile]')) navigate(`/admin?section=${event.target.value}`);
    if (event.target.matches('[data-report-status]')) await action(await service.setReportStatus(event.target.dataset.reportStatus, event.target.value), 'Reporte actualizado.');
    if (event.target.matches('[data-flag]')) await action(await service.setFeatureFlag({ key: event.target.dataset.flag, description: event.target.dataset.description, enabled: event.target.checked }), 'Flag actualizado.');
    if (event.target.matches('[data-ad]')) await action(await service.setAdsPlacement({ placement: event.target.dataset.ad, provider: event.target.dataset.provider, enabled: event.target.checked }), 'Placement actualizado.');
    if (event.target.matches('[data-content-entity]')) {
      const entity = event.target.value;
      main.querySelectorAll('[data-content-fields]').forEach((fields) => {
        const active = fields.dataset.contentFields === entity;
        fields.hidden = !active;
        fields.querySelectorAll('[data-content-required]').forEach((input) => { input.required = active && !input.disabled; });
      });
      main.querySelector('[data-game-field]').hidden = entity === 'boss';
    }
    if (event.target.matches('[data-admin-rate-preset]')) main.querySelector('[data-admin-custom-rates]').hidden = event.target.value !== 'custom';
    if (event.target.matches('[data-admin-server-game]')) {
      const form = event.target.closest('form');
      const game = event.target.value;
      const replace = (name, items) => {
        const group = form.querySelector(`[data-admin-server-options="${name}"] .admin-choices`);
        const selected = [...new FormData(form).getAll(name)];
        group.innerHTML = choiceInputs(name, items, { selected });
      };
      replace('maps', availableForGame(SERVER_MAPS, game));
      replace('platforms', availableForGame(SERVER_PLATFORMS, game).map((item) => ({ ...item, value: item.label })));
    }
    if (event.target.matches('[data-server-status]')) await action(await service.setServerStatus({ listingId: event.target.dataset.serverStatus, status: event.target.value, featured: event.target.dataset.featured === 'true', verified: event.target.dataset.verified === 'true' }), 'Servidor actualizado.');
  });

  main.addEventListener('click', async (event) => {
    const user = event.target.closest('[data-user-suspension]');
    if (user) await action(await service.setUserSuspension(user.dataset.userSuspension, user.dataset.next === 'true', 'Acción desde centro de comando'), 'Estado del usuario actualizado.');
    const tribe = event.target.closest('[data-tribe-active]');
    if (tribe) await action(await service.setTribeActive(tribe.dataset.tribeActive, tribe.dataset.next === 'true', 'Acción desde centro de comando'), 'Estado de la tribu actualizado.');
    const archive = event.target.closest('[data-archive-content]');
    if (archive && window.confirm('¿Archivar esta entrada del catálogo público?')) await action(await service.archiveContent(archive.dataset.archiveContent, archive.dataset.id), 'Contenido archivado.');
    const renew = event.target.closest('[data-renew-server]');
    if (renew) { const duration = Number(main.querySelector(`[data-renew-duration="${renew.dataset.renewServer}"]`).value); await action(await service.renewServerListing(renew.dataset.renewServer, duration), 'Publicación renovada.'); }
    const remove = event.target.closest('[data-delete-server]');
    if (remove && window.confirm('¿Eliminar definitivamente esta publicación y su analítica?')) await action(await service.deleteServerListing(remove.dataset.deleteServer), 'Publicación eliminada.');
  });

  main.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(event.target);
    if (event.target.matches('[data-content-form]')) {
      const entity = values.get('entity');
      const contentName = { species: values.get('species_name'), ini: values.get('ini_title'), map: values.get('map_name'), boss: values.get('boss_name') }[entity]?.trim() || '';
      const generatedSlug = slugify(contentName);
      const stats = values.getAll('species_stats');
      if (!generatedSlug) { showToast('Escribe un nombre válido para generar la URL.', 'error'); return; }
      if (entity === 'species' && (!stats.length || Number(values.get('cooldown')) <= 0)) { showToast('Selecciona al menos un stat y revisa el cooldown.', 'error'); return; }
      if (entity === 'boss' && !values.get('map_id')) { showToast('Crea o selecciona un mapa antes de guardar el boss.', 'error'); return; }
      const common = { slug: generatedSlug, game_availability: values.get('game'), is_public: values.has('public'), is_active: true, sort_order: 0 };
      const payloads = {
        species: { ...common, name: contentName, category: values.get('species_category'), cooldown_hours: Number(values.get('cooldown')), stats, notes: values.get('species_notes').trim(), image_url: values.get('species_image').trim() },
        ini: { ...common, title: contentName, category: values.get('ini_category'), description: values.get('ini_description').trim(), content: values.get('ini_content').trim(), image_url: values.get('ini_image').trim() },
        map: { ...common, name: contentName, description: values.get('map_description').trim(), image_url: values.get('map_image').trim() },
        boss: { ...common, name: contentName, map_id: values.get('map_id'), notes: values.get('boss_notes').trim(), image_url: values.get('boss_image').trim() },
      };
      await action(await service.upsertContent(entity, null, payloads[entity]), 'Contenido creado.');
    }
    if (event.target.matches('[data-flag-form]')) await action(await service.setFeatureFlag({ key: values.get('key').trim(), description: values.get('description').trim(), enabled: false }), 'Flag creado.');
    if (event.target.matches('[data-legal-form]')) await action(await service.publishLegal({ documentType: values.get('type').trim(), version: values.get('version').trim(), title: values.get('title').trim(), content: values.get('content'), publish: values.has('publish') }), 'Documento legal guardado.');
    if (event.target.matches('[data-server-form]')) {
      const maps = values.getAll('maps');
      const platforms = values.getAll('platforms');
      if (!maps.length || !platforms.length) { showToast('Selecciona al menos un mapa y una plataforma.', 'error'); return; }
      const customRates = Object.fromEntries(RATE_FIELDS.map(([key]) => [key, values.get(`rate_${key}`)]));
      const payload = { title: values.get('title').trim(), game: values.get('game'), server_type: values.get('server_type'), plan: values.get('plan'), region: values.get('region').trim(), language: values.get('language').trim(), platforms, maps, has_mods: values.get('has_mods') === 'true', mods: [], gallery_urls: [], rates: normalizeRates(values.get('rate_preset'), customRates), discord_invite_url: values.get('discord').trim(), website_url: values.get('website').trim(), banner_url: values.get('banner').trim(), description: values.get('description').trim(), cluster_name: values.get('cluster_name').trim(), wipe_date: values.get('wipe_date'), uses_propagators: values.has('propagators'), is_featured: values.get('plan') === 'plus', is_verified: values.has('verified') };
      await action(await service.upsertServerListing({ payload, durationMonths: values.get('duration') ? Number(values.get('duration')) : null }), 'Servidor publicado.');
    }
  });

  document.querySelector('.admin-sidebar')?.addEventListener('click', (event) => {
    const link = event.target.closest('[data-admin-section]');
    if (link) { event.preventDefault(); navigate(link.href); }
  });

  load();
}
