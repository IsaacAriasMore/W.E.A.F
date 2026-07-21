import { createAppNavigation } from '../../components/layout/AppNavigation.js';
import { createBreedService } from '../../services/breedService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { formatDateTime, formatRelativeTime } from '../../utils/dates.js';
import { showToast } from '../../utils/feedback.js';
import { setFormStatus, setSubmitting } from '../auth/formUtils.js';
import { resolvePrivateWorkspace, tribePath } from './privateWorkspace.js';

const statLabels = {
  health: 'Vida',
  stamina: 'Estamina',
  oxygen: 'Oxígeno',
  food: 'Comida',
  weight: 'Peso',
  melee: 'Melee',
  speed: 'Velocidad',
};
const statusLabels = { active: 'Activo', paused: 'Pausado', completed: 'Terminado' };

function loadingView() {
  return '<div class="app-view-loading"><span class="skeleton skeleton-copy"></span><span class="skeleton skeleton-title"></span><div><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div></div>';
}

function statsInputs(prefix, values = {}) {
  return Object.entries(statLabels).map(([key, label]) => `
    <label><span>${label}</span><input name="${prefix}${key}" type="number" min="0" max="10000" step="1" value="${escapeHtml(values[key] ?? '')}" inputmode="numeric" placeholder="0" /></label>
  `).join('');
}

function statsObject(values) {
  return Object.entries(values || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `<span><small>${statLabels[key] || escapeHtml(key)}</small><strong>${escapeHtml(value)}</strong></span>`)
    .join('') || '<span class="stats-empty">Sin stats registrados</span>';
}

function readStats(values, prefix) {
  return Object.keys(statLabels).reduce((stats, key) => {
    const raw = values.get(`${prefix}${key}`);
    if (raw !== null && raw !== '') stats[key] = Number(raw);
    return stats;
  }, {});
}

function workspaceHeader({ activeMembership, memberships, mode }) {
  const tribe = activeMembership.tribe;
  return `
    <header class="app-toolbar breeding-toolbar">
      <div>
        <p class="section-kicker">${mode === 'mutations' ? 'Registro genético' : 'Breeding privado'}</p>
        <h1>${mode === 'mutations' ? 'Mutaciones' : 'Líneas de breeding'}</h1>
        <p>${escapeHtml(tribe.name)} · ${tribe.game_mode === 'both' ? 'ASE + ASA' : tribe.game_mode.toUpperCase()}</p>
      </div>
      <label class="tribe-switcher"><span>Cambiar de tribu</span><select data-workspace-tribe>
        ${memberships.map((item) => `<option value="${item.tribe_id}" ${item.tribe_id === tribe.id ? 'selected' : ''}>${escapeHtml(item.tribe.name)}</option>`).join('')}
      </select></label>
    </header>
    <nav class="workspace-tabs" aria-label="Vistas de breeding">
      <a href="${tribePath('/app/breeds', tribe.id)}" data-link ${mode === 'breeds' ? 'aria-current="page"' : ''}>Líneas</a>
      <a href="${tribePath('/app/mutations', tribe.id)}" data-link ${mode === 'mutations' ? 'aria-current="page"' : ''}>Mutaciones y cooldowns</a>
    </nav>
  `;
}

function mutationDialog(breeds) {
  return `
    <dialog class="breed-dialog" data-mutation-dialog>
      <form method="dialog" class="dialog-close-form"><button type="submit" aria-label="Cerrar">×</button></form>
      <form class="breed-dialog-form" data-mutation-form novalidate>
        <div><p class="section-kicker">Nuevo registro</p><h2>Registrar mutación</h2><p>El cooldown se calcula al guardar.</p></div>
        <label><span>Línea de breeding</span><select name="breedId" required>
          ${breeds.map((breed) => `<option value="${breed.id}">${escapeHtml(breed.species.name)} · ${escapeHtml(breed.title)}</option>`).join('')}
        </select></label>
        <fieldset class="stat-entry-grid"><legend>Incrementos observados</legend>${statsInputs('mutation-')}</fieldset>
        <label><span>Notas <small>Opcional</small></span><textarea name="notes" maxlength="2000" rows="3"></textarea></label>
        <p class="form-status" data-form-status role="alert" hidden></p>
        <button class="button button-primary" type="submit">Guardar mutación</button>
      </form>
    </dialog>
  `;
}

function breedCard(breed, canManage) {
  return `
    <article class="breed-row" data-breed-id="${breed.id}">
      <div class="breed-species-mark" aria-hidden="true">${escapeHtml(breed.species.name).slice(0, 2).toUpperCase()}</div>
      <div class="breed-row-main">
        <div class="breed-row-heading">
          <div><small>${escapeHtml(breed.species.category)}</small><h2>${escapeHtml(breed.title)}</h2><p>${escapeHtml(breed.species.name)}</p></div>
          <span class="breed-status status-${breed.status}">${statusLabels[breed.status]}</span>
        </div>
        <div class="breed-stat-columns">
          <div><strong>Objetivo</strong><div class="compact-stats">${statsObject(breed.target_stats)}</div></div>
          <div><strong>Mutaciones</strong><div class="compact-stats">${statsObject(breed.current_mutations)}</div></div>
        </div>
        ${breed.notes ? `<p class="breed-notes">${escapeHtml(breed.notes)}</p>` : ''}
      </div>
      <div class="breed-row-actions">
        <button class="button button-secondary button-small" type="button" data-open-mutation="${breed.id}">Registrar mutación</button>
        ${canManage ? `
          <label><span class="sr-only">Estado de ${escapeHtml(breed.title)}</span><select data-breed-status>
            ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${breed.status === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select></label>
          <button class="text-button danger-action" type="button" data-delete-breed>Eliminar</button>
        ` : ''}
      </div>
    </article>
  `;
}

function breedsView({ activeMembership, species, breeds }) {
  const canManage = ['owner', 'admin'].includes(activeMembership.role);
  return `
    <div class="breeding-layout">
      <section class="breed-list-section">
        <div class="workspace-heading">
          <div><h2>${breeds.length ? `${breeds.length} líneas coordinadas` : 'Aún no hay líneas'}</h2><p>Los datos pertenecen únicamente a esta tribu.</p></div>
        </div>
        <div class="breed-list">
          ${breeds.length
            ? breeds.map((breed) => breedCard(breed, canManage)).join('')
            : '<div class="breeding-empty"><span>◇</span><h2>Define la primera línea</h2><p>Selecciona una especie, fija los stats objetivo y empieza a registrar mutaciones.</p></div>'}
        </div>
      </section>
      <aside class="breed-create-panel">
        ${canManage ? `
          <div><p class="section-kicker">Nueva línea</p><h2>Plan de breeding</h2><p>Owner y admins pueden organizar objetivos.</p></div>
          <form data-create-breed-form novalidate>
            <label><span>Especie</span><select name="speciesId" required ${species.length ? '' : 'disabled'}>
              ${species.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${item.game_availability === 'both' ? 'ASE + ASA' : item.game_availability.toUpperCase()}</option>`).join('')}
            </select></label>
            <label><span>Nombre de la línea</span><input name="title" required minlength="2" maxlength="120" placeholder="Ej. Boss Rex · Vida/Melee" /></label>
            <fieldset class="stat-entry-grid"><legend>Stats objetivo</legend>${statsInputs('target-')}</fieldset>
            <label><span>Notas <small>Opcional</small></span><textarea name="notes" maxlength="5000" rows="4"></textarea></label>
            <p class="form-status" data-form-status role="alert" hidden></p>
            <button class="button button-primary" type="submit" ${species.length ? '' : 'disabled'}>Crear línea</button>
          </form>
          ${species.length ? '' : '<p class="panel-note">Un admin global debe activar al menos una especie compatible.</p>'}
        ` : '<div class="member-permission-note"><span>Vista de miembro</span><h2>Puedes registrar mutaciones.</h2><p>La creación y edición de líneas corresponde a owner y admins.</p></div>'}
      </aside>
    </div>
  `;
}

function mutationsView({ activeMembership, breeds, mutations, alerts, settings }) {
  const canManage = ['owner', 'admin'].includes(activeMembership.role);
  const webhookReady = settings.webhook?.configured && settings.webhook?.enabled;
  const now = Date.now();
  return `
    <div class="mutation-layout">
      <section class="mutation-log">
        <div class="workspace-heading">
          <div><h2>Actividad genética</h2><p>Cada registro actualiza el acumulado de su línea.</p></div>
          <button class="button button-primary button-small" type="button" data-open-mutation ${breeds.length ? '' : 'disabled'}>Registrar mutación</button>
        </div>
        <div class="mutation-timeline">
          ${mutations.length ? mutations.map((mutation) => `
            <article>
              <time datetime="${mutation.created_at}">${formatRelativeTime(mutation.created_at)}</time>
              <div><small>${escapeHtml(mutation.species.name)}</small><h3>${escapeHtml(mutation.breed.title)}</h3><div class="compact-stats">${statsObject(mutation.stats)}</div>${mutation.notes ? `<p>${escapeHtml(mutation.notes)}</p>` : ''}</div>
              ${webhookReady ? `<button class="text-button" type="button" data-notify-discord data-event="mutation_created" data-entity="${mutation.id}">Enviar a Discord</button>` : ''}
            </article>
          `).join('') : '<div class="breeding-empty"><span>＋</span><h2>Sin mutaciones todavía</h2><p>El primer registro aparecerá aquí con su cooldown calculado.</p></div>'}
        </div>
      </section>
      <aside class="cooldown-rail">
        <div><p class="section-kicker">Próximas ventanas</p><h2>Cooldowns</h2><p>${settings.uses_propagators ? `Propagator cada ${settings.propagator_cooldown_hours} h.` : `Velocidad de breeding ×${settings.breeding_speed_multiplier}.`}</p></div>
        <div class="cooldown-list">
          ${alerts.length ? alerts.map((alert) => {
            const available = new Date(alert.available_at).getTime() <= now;
            return `<article class="${available ? 'is-ready' : ''}">
              <span></span><div><strong>${escapeHtml(alert.breed.species.name)}</strong><small>${escapeHtml(alert.breed.title)}</small><time datetime="${alert.available_at}">${available ? 'Disponible ahora' : formatRelativeTime(alert.available_at)}</time></div>
              ${available && webhookReady ? `<button class="text-button" type="button" data-notify-discord data-event="propagator_available" data-entity="${alert.id}">Avisar</button>` : ''}
              ${canManage ? `<button class="text-button danger-action" type="button" data-cancel-alert="${alert.id}">Cancelar</button>` : ''}
            </article>`;
          }).join('') : '<p class="panel-note">No hay cooldowns programados.</p>'}
        </div>
        ${webhookReady ? '<p class="webhook-ready-note">Discord conectado para esta tribu.</p>' : '<a class="text-link" href="/app/tribe-settings" data-link>Configurar avisos de Discord</a>'}
      </aside>
    </div>
  `;
}

export function render({ state }) {
  return `<div class="private-app-shell">${createAppNavigation(state.profile)}<section class="private-app-main" data-breeding-view>${loadingView()}</section></div>`;
}

export function bind({ path, state, authService, navigate }) {
  const view = document.querySelector('[data-breeding-view]');
  const service = createBreedService(authService.getClient());
  const mode = path.endsWith('/mutations') ? 'mutations' : 'breeds';
  let workspace;
  let data = { species: [], breeds: [], mutations: [], alerts: [], settings: {} };

  async function load() {
    view.innerHTML = loadingView();
    workspace = await resolvePrivateWorkspace({ state, authService });
    if (workspace.error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos abrir breeding.</h1><p>${escapeHtml(workspace.error)}</p><button class="button button-primary" data-retry-breeding>Reintentar</button></section>`;
      return;
    }
    if (workspace.empty) { navigate('/app'); return; }
    const tribeId = workspace.activeMembership.tribe_id;
    const [settings, species, breeds, mutations, alerts] = await Promise.all([
      service.getSettings(tribeId),
      service.listSpecies(workspace.activeMembership.tribe.game_mode),
      service.listBreeds(tribeId),
      service.listMutations(tribeId),
      service.listAlerts(tribeId),
    ]);
    const error = settings.error || species.error || breeds.error || mutations.error || alerts.error;
    if (error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos sincronizar breeding.</h1><p>${escapeHtml(error)}</p><button class="button button-primary" data-retry-breeding>Reintentar</button></section>`;
      return;
    }
    data = { settings: settings.data, species: species.data, breeds: breeds.data, mutations: mutations.data, alerts: alerts.data };
    view.innerHTML = `
      <section class="breeding-workspace">
        ${workspaceHeader({ ...workspace, mode })}
        ${mode === 'breeds'
          ? breedsView({ activeMembership: workspace.activeMembership, species: data.species, breeds: data.breeds })
          : mutationsView({ activeMembership: workspace.activeMembership, ...data })}
      </section>
      ${mutationDialog(data.breeds)}
    `;
  }

  const onSubmit = async (event) => {
    const form = event.target.closest('form');
    if (!form || form.method === 'dialog') return;
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const tribeId = workspace.activeMembership.tribe_id;

    if (form.matches('[data-create-breed-form]')) {
      setSubmitting(form, true, 'Crear línea');
      const result = await service.createBreed({
        tribeId, speciesId: values.get('speciesId'), title: values.get('title').trim(),
        targetStats: readStats(values, 'target-'), notes: values.get('notes').trim(),
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Crear línea'); return; }
      showToast('Línea de breeding creada.');
      await load();
    }

    if (form.matches('[data-mutation-form]')) {
      setSubmitting(form, true, 'Guardar mutación');
      const result = await service.registerMutation({
        tribeId, breedId: values.get('breedId'), stats: readStats(values, 'mutation-'),
        notes: values.get('notes').trim(),
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Guardar mutación'); return; }
      form.closest('dialog').close();
      showToast('Mutación registrada y cooldown calculado.');
      if (data.settings.webhook?.configured && data.settings.webhook?.enabled) {
        const delivery = await service.notifyDiscord({ tribeId, eventType: 'mutation_created', entityId: result.data.mutation_id });
        if (delivery.error) showToast(delivery.error, 'error');
        else showToast('Aviso enviado a Discord.');
      }
      await load();
    }
  };

  const onChange = async (event) => {
    if (event.target.matches('[data-workspace-tribe]')) {
      navigate(tribePath(path, event.target.value));
      return;
    }
    if (event.target.matches('[data-breed-status]')) {
      const row = event.target.closest('[data-breed-id]');
      const breed = data.breeds.find((item) => item.id === row.dataset.breedId);
      const result = await service.updateBreed({
        breedId: breed.id, title: breed.title, status: event.target.value,
        targetStats: breed.target_stats, notes: breed.notes,
      });
      if (result.error) { showToast(result.error, 'error'); event.target.value = breed.status; return; }
      showToast('Estado de la línea actualizado.');
      if (event.target.value === 'completed' && data.settings.webhook?.enabled) {
        const delivery = await service.notifyDiscord({ tribeId: workspace.activeMembership.tribe_id, eventType: 'breed_completed', entityId: breed.id });
        if (delivery.error) showToast(delivery.error, 'error');
      }
      await load();
    }
  };

  const onClick = async (event) => {
    if (event.target.closest('[data-retry-breeding]')) { await load(); return; }
    const open = event.target.closest('[data-open-mutation]');
    if (open) {
      const dialog = document.querySelector('[data-mutation-dialog]');
      if (open.dataset.openMutation) dialog.querySelector('[name="breedId"]').value = open.dataset.openMutation;
      dialog.showModal();
      return;
    }
    const remove = event.target.closest('[data-delete-breed]');
    if (remove) {
      if (remove.dataset.confirmed !== 'true') {
        remove.dataset.confirmed = 'true'; remove.textContent = 'Confirmar eliminación';
        window.setTimeout(() => { if (remove.isConnected) { remove.dataset.confirmed = 'false'; remove.textContent = 'Eliminar'; } }, 4000);
        return;
      }
      const result = await service.deleteBreed(remove.closest('[data-breed-id]').dataset.breedId);
      if (result.error) showToast(result.error, 'error'); else { showToast('Línea eliminada.'); await load(); }
      return;
    }
    const cancel = event.target.closest('[data-cancel-alert]');
    if (cancel) {
      const result = await service.cancelAlert(cancel.dataset.cancelAlert);
      if (result.error) showToast(result.error, 'error'); else { showToast('Cooldown cancelado.'); await load(); }
      return;
    }
    const notify = event.target.closest('[data-notify-discord]');
    if (notify) {
      notify.disabled = true;
      const result = await service.notifyDiscord({
        tribeId: workspace.activeMembership.tribe_id,
        eventType: notify.dataset.event,
        entityId: notify.dataset.entity,
      });
      if (result.error) { showToast(result.error, 'error'); notify.disabled = false; }
      else { showToast('Aviso enviado a Discord.'); await load(); }
    }
  };

  view.addEventListener('submit', onSubmit);
  view.addEventListener('change', onChange);
  view.addEventListener('click', onClick);
  load();
  return () => {
    view.removeEventListener('submit', onSubmit);
    view.removeEventListener('change', onChange);
    view.removeEventListener('click', onClick);
  };
}
