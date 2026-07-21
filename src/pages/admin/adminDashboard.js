import { createAdminNavigation, adminSectionOptions } from '../../components/layout/AdminNavigation.js';
import { createAdminService } from '../../services/adminService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { formatRelativeTime } from '../../utils/dates.js';
import { showToast } from '../../utils/feedback.js';

const sectionNames = {
  overview: ['Pulso de plataforma', 'Señales operativas para decidir qué necesita atención.'],
  users: ['Usuarios', 'Identidad, acceso y estado de cada superviviente.'],
  tribes: ['Tribus', 'Tenants, propietarios y actividad de comunidad.'],
  content: ['Contenido público', 'Catálogo editorial compartido por ASA y ASE.'],
  operations: ['Operaciones', 'Servidores, planes y trazabilidad de pagos.'],
  governance: ['Gobernanza', 'Moderación, flags, anuncios y documentos legales.'],
  audit: ['Auditoría', 'Registro inmutable de decisiones sensibles.'],
};

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
    <aside class="admin-editor"><div><span>Nueva entrada</span><h2>Editor editorial</h2><p>Crea especies, presets INI, mapas y bosses desde un único flujo controlado.</p></div>
      <form data-content-form>
        <label><span>Tipo</span><select name="entity" data-content-entity><option value="species">Especie</option><option value="ini">Preset INI</option><option value="map">Mapa</option><option value="boss">Boss</option></select></label>
        <div data-content-fields="species"><label><span>Nombre</span><input name="species_name" minlength="2"></label><label><span>Categoría</span><input name="species_category"></label><label><span>Cooldown vanilla</span><input name="cooldown" type="number" min="0.1" step="0.1"></label><label><span>Stats, separados por coma</span><input name="stats" placeholder="health, stamina, melee"></label></div>
        <div data-content-fields="ini" hidden><label><span>Título</span><input name="ini_title"></label><label><span>Categoría</span><select name="ini_category"><option value="general">General</option><option value="farming">Farming</option><option value="pvp">PVP</option><option value="hard">Hard</option><option value="fps">FPS</option><option value="visibility">Visibilidad</option><option value="clean">Clean</option></select></label><label><span>Descripción</span><textarea name="ini_description" rows="3"></textarea></label><label><span>Contenido INI</span><textarea name="ini_content" rows="5"></textarea></label></div>
        <div data-content-fields="map" hidden><label><span>Nombre del mapa</span><input name="map_name"></label><label><span>Descripción</span><textarea name="map_description" rows="4"></textarea></label></div>
        <div data-content-fields="boss" hidden><label><span>Nombre del boss</span><input name="boss_name"></label><label><span>Mapa</span><select name="map_id">${data.maps.map((map) => `<option value="${map.id}">${escapeHtml(map.name)}</option>`).join('')}</select></label><label><span>Notas</span><textarea name="boss_notes" rows="4"></textarea></label></div>
        <label><span>Slug</span><input name="slug" required pattern="[a-z0-9-]+"></label>
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
  return `<div class="admin-stack">
    <section><div class="admin-block-heading"><span>Marketplace</span><h2>Servidores</h2></div>${table(['Servidor', 'Región', 'Plan', 'Estado'], data.servers.map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.game)} · ${escapeHtml(item.server_type)}</small></td><td>${escapeHtml(item.region)}</td><td>${escapeHtml(item.plan)}</td><td><select data-server-status="${item.id}" data-featured="${item.is_featured}" data-verified="${item.is_verified}">${['pending_payment','active','paused','expired','canceled','rejected'].map((option) => `<option value="${option}" ${item.status === option ? 'selected' : ''}>${option}</option>`).join('')}</select></td></tr>`), 'Los listings se activarán en la Fase 6.')}</section>
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
    const result = await service.getWorkspace();
    if (result.error) {
      main.innerHTML = `<section class="admin-failure"><span>403</span><h1>Centro de comando bloqueado</h1><p>${escapeHtml(result.error)}</p><a class="button button-primary" href="/app" data-link>Volver a la tribu</a></section>`;
      return;
    }
    data = result.data;
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
      main.querySelectorAll('[data-content-fields]').forEach((fields) => { fields.hidden = fields.dataset.contentFields !== entity; });
      main.querySelector('[data-game-field]').hidden = entity === 'boss';
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
  });

  main.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(event.target);
    if (event.target.matches('[data-content-form]')) {
      const entity = values.get('entity');
      const common = { slug: values.get('slug').trim(), game_availability: values.get('game'), is_public: values.has('public'), is_active: true, sort_order: 0 };
      const payloads = {
        species: { ...common, name: values.get('species_name').trim(), category: values.get('species_category').trim(), cooldown_hours: Number(values.get('cooldown')), stats: values.get('stats').split(',').map((item) => item.trim()).filter(Boolean) },
        ini: { ...common, title: values.get('ini_title').trim(), category: values.get('ini_category'), description: values.get('ini_description').trim(), content: values.get('ini_content') },
        map: { ...common, name: values.get('map_name').trim(), description: values.get('map_description').trim() },
        boss: { ...common, name: values.get('boss_name').trim(), map_id: values.get('map_id'), notes: values.get('boss_notes').trim() },
      };
      await action(await service.upsertContent(entity, null, payloads[entity]), 'Contenido creado.');
    }
    if (event.target.matches('[data-flag-form]')) await action(await service.setFeatureFlag({ key: values.get('key').trim(), description: values.get('description').trim(), enabled: false }), 'Flag creado.');
    if (event.target.matches('[data-legal-form]')) await action(await service.publishLegal({ documentType: values.get('type').trim(), version: values.get('version').trim(), title: values.get('title').trim(), content: values.get('content'), publish: values.has('publish') }), 'Documento legal guardado.');
  });

  document.querySelector('.admin-sidebar')?.addEventListener('click', (event) => {
    const link = event.target.closest('[data-admin-section]');
    if (link) { event.preventDefault(); navigate(link.href); }
  });

  load();
}
