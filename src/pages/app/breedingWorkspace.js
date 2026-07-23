import { createAppNavigation } from '../../components/layout/AppNavigation.js';
import { createBreedService } from '../../services/breedService.js';
import { createTribeService } from '../../services/tribeService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { formatDateTime, formatRelativeTime } from '../../utils/dates.js';
import { showToast } from '../../utils/feedback.js';
import { mountLottieMotion } from '../../components/visuals/LottieMotion.js';
import { initCardHoverEffects, initScrollAnimations } from '../../utils/motion.js';
import { setFormStatus, setSubmitting } from '../auth/formUtils.js';
import { resolvePrivateWorkspace, tribePath } from './privateWorkspace.js';
import { calculateMutationCount } from '../../utils/mutationCalculator.js';

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
        <label><span>Línea de breeding</span><select name="breedId" data-mutation-breed required>
          ${breeds.map((breed) => `<option value="${breed.id}">${escapeHtml(breed.species.name)} · ${escapeHtml(breed.title)}</option>`).join('')}
        </select></label>
        <div class="mutation-value-grid">
          <label><span>Stat mejorado</span><select name="statKey" data-mutation-stat required>${Object.entries(statLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
          <label><span>Valor actual</span><input name="previousValue" data-mutation-previous type="number" readonly aria-readonly="true" /></label>
          <label><span>Nuevo valor</span><input name="newValue" data-mutation-new type="number" min="0" max="10000" step="1" required inputmode="numeric" /></label>
        </div>
        <div class="mutation-calculation" data-mutation-calculation><strong>Selecciona una línea y actualiza el stat.</strong><span>El conteo usa Δ ÷ 2, redondeado hacia abajo.</span></div>
        <label class="confirmation-check" data-odd-confirmation hidden><input name="allowOdd" type="checkbox" /><span>La diferencia es impar. Confirmo que el conteo se redondee hacia abajo.</span></label>
        <label><span>Notas <small>Opcional</small></span><textarea name="notes" maxlength="2000" rows="3"></textarea></label>
        <p class="form-status" data-form-status role="alert" hidden></p>
        <button class="button button-primary" type="submit">Guardar mutación</button>
      </form>
    </dialog>
  `;
}

function updateMutationCalculation(form, breeds, resetNewValue = false) {
  if (!form) return null;
  const breed = breeds.find((item) => item.id === form.elements.breedId.value);
  const statKey = form.elements.statKey.value;
  const currentStats = breed?.current_stats || breed?.base_stats || breed?.target_stats || {};
  const previousValue = currentStats[statKey];
  form.elements.previousValue.value = previousValue ?? '';
  if (resetNewValue) form.elements.newValue.value = previousValue ?? '';
  form.elements.newValue.min = previousValue === undefined ? '0' : String(Number(previousValue) + 2);
  const result = calculateMutationCount(previousValue, form.elements.newValue.value);
  const output = form.querySelector('[data-mutation-calculation]');
  const odd = form.querySelector('[data-odd-confirmation]');
  odd.hidden = !result.valid || !result.isOdd;
  odd.querySelector('input').required = Boolean(result.valid && result.isOdd);
  if (!result.valid) {
    const message = result.error === 'not_improved' ? 'El nuevo valor debe superar al actual.'
      : result.error === 'delta_too_small' ? 'La mejora mínima es de 2 puntos.'
        : 'Completa valores enteros para calcular el cambio.';
    output.innerHTML = `<strong>${message}</strong><span>Base/actual: ${escapeHtml(previousValue ?? 'sin definir')}</span>`;
    return result;
  }
  output.innerHTML = `<strong>${result.previous} → ${result.next} = ${result.mutationCount} mutación${result.mutationCount === 1 ? '' : 'es'}</strong><span>Δ ${result.delta}${result.isOdd ? ' · diferencia impar, se redondeará hacia abajo' : ''}</span>`;
  return result;
}

function breedCard(breed, canManage, members) {
  return `
    <article class="breed-row stagger-item interactive-card" data-breed-id="${breed.id}">
      <div class="breed-species-mark" aria-hidden="true">${escapeHtml(breed.species.name).slice(0, 2).toUpperCase()}</div>
      <div class="breed-row-main">
        <div class="breed-row-heading">
          <div><small>${escapeHtml(breed.species.category)}</small><h2>${escapeHtml(breed.species.name)}</h2><p>${escapeHtml(breed.title)}</p>${breed.caretaker_display_name ? `<span class="caretaker-badge">Cuidador · ${escapeHtml(breed.caretaker_display_name)}</span>` : '<span class="caretaker-badge is-empty">Sin cuidador</span>'}</div>
          <span class="breed-status status-${breed.status}">${statusLabels[breed.status]}</span>
        </div>
        <div class="breed-stat-columns">
          <div><strong>Base</strong><div class="compact-stats">${statsObject(breed.base_stats || breed.target_stats)}</div></div>
          <div><strong>Actual</strong><div class="compact-stats">${statsObject(breed.current_stats || breed.target_stats)}</div></div>
          <div><strong>Mutaciones</strong><div class="compact-stats">${statsObject(breed.current_mutations)}</div></div>
        </div>
        ${breed.notes ? `<p class="breed-notes">${escapeHtml(breed.notes)}</p>` : ''}
      </div>
      <div class="breed-row-actions">
        <button class="button button-secondary button-small" type="button" data-open-mutation="${breed.id}">Registrar mutación</button>
        ${canManage ? `
          <label><span class="sr-only">Cuidador de ${escapeHtml(breed.title)}</span><select data-breed-caretaker><option value="">Sin cuidador</option>${members.map((member) => `<option value="${member.user_id}" ${breed.caretaker_user_id === member.user_id ? 'selected' : ''}>${escapeHtml(member.display_name || member.character_name)}</option>`).join('')}</select></label>
          <label><span class="sr-only">Estado de ${escapeHtml(breed.title)}</span><select data-breed-status>
            ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${breed.status === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select></label>
          <button class="text-button danger-action" type="button" data-delete-breed>Eliminar</button>
        ` : ''}
      </div>
    </article>
  `;
}

function breedsView({ activeMembership, species, breeds, members }) {
  const canManage = ['owner', 'admin'].includes(activeMembership.role);
  return `
    <div class="breeding-layout reveal-up">
      <section class="breed-list-section">
        <div class="workspace-heading">
          <div><h2>${breeds.length ? `${breeds.length} líneas coordinadas` : 'Aún no hay líneas'}</h2><p>Los datos pertenecen únicamente a esta tribu.</p></div>
        </div>
        <div class="breed-list stagger-group">
          ${breeds.length
            ? breeds.map((breed) => breedCard(breed, canManage, members)).join('')
            : '<div class="breeding-empty premium-panel"><div data-breeding-empty-lottie aria-hidden="true"></div><h2>Define la primera línea</h2><p>Selecciona una especie, fija los stats objetivo y empieza a registrar mutaciones.</p></div>'}
        </div>
      </section>
      <aside class="breed-create-panel premium-panel">
        ${canManage ? `
          <div><p class="section-kicker">Nueva línea</p><h2>Plan de breeding</h2><p>Owner y admins pueden organizar objetivos.</p></div>
          <form data-create-breed-form novalidate>
            <label><span>Especie</span><select name="speciesId" required ${species.length ? '' : 'disabled'}>
              ${species.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${item.game_availability === 'both' ? 'ASE + ASA' : item.game_availability.toUpperCase()}</option>`).join('')}
            </select></label>
            <label><span>Nombre de la línea</span><input name="title" required minlength="2" maxlength="120" placeholder="Ej. Boss Rex · Vida/Melee" /></label>
            <fieldset class="stat-entry-grid"><legend>Stats base actuales</legend>${statsInputs('base-')}</fieldset>
            <label><span>Cuidador <small>Opcional</small></span><select name="caretakerUserId"><option value="">Sin asignar</option>${members.map((member) => `<option value="${member.user_id}">${escapeHtml(member.display_name || member.character_name)}</option>`).join('')}</select></label>
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
  const totals = mutations.reduce((summary, mutation) => {
    if (mutation.stat_key && mutation.mutation_count) {
      summary.total += Number(mutation.mutation_count);
      summary.byStat[mutation.stat_key] = (summary.byStat[mutation.stat_key] || 0) + Number(mutation.mutation_count);
    } else {
      Object.entries(mutation.stats || {}).forEach(([key, value]) => {
        summary.total += Number(value) || 0;
        summary.byStat[key] = (summary.byStat[key] || 0) + (Number(value) || 0);
      });
    }
    return summary;
  }, { total: 0, byStat: {} });
  return `
    <div class="mutation-layout reveal-up">
      <section class="mutation-log">
        <div class="workspace-heading">
          <div><h2>Actividad genética</h2><p>Cada registro actualiza el acumulado de su línea.</p></div>
          <button class="button button-primary button-small" type="button" data-open-mutation ${breeds.length ? '' : 'disabled'}>Registrar mutación</button>
        </div>
        <div class="mutation-summary"><div><span>Mutaciones totales</span><strong>${totals.total}</strong></div>${Object.entries(totals.byStat).map(([key, value]) => `<div><span>${statLabels[key] || escapeHtml(key)}</span><strong>${value}</strong></div>`).join('')}</div>
        <div class="mutation-timeline stagger-group">
          ${mutations.length ? mutations.map((mutation) => `
            <article class="stagger-item">
              <time datetime="${mutation.created_at}">${formatRelativeTime(mutation.created_at)}</time>
              <div><small>${escapeHtml(mutation.species.name)} · ciclo ${mutation.breeding_cycle || 1}</small><h3>${escapeHtml(mutation.breed.title)}</h3>${mutation.stat_key ? `<p class="mutation-delta"><strong>${statLabels[mutation.stat_key]}</strong> ${mutation.previous_value} → ${mutation.new_value} <span>Δ ${mutation.delta} · ${mutation.mutation_count} mut.</span></p>` : `<div class="compact-stats">${statsObject(mutation.stats)}</div>`}<p class="mutation-actors">Registró: <strong>${escapeHtml(mutation.registered_by_display_name || 'Registro heredado')}</strong>${mutation.line_owner_display_name ? ` · Cuidador: <strong>${escapeHtml(mutation.line_owner_display_name)}</strong>` : ''}</p>${mutation.notes ? `<p>${escapeHtml(mutation.notes)}</p>` : ''}</div>
              ${webhookReady ? `<button class="text-button" type="button" data-notify-discord data-event="mutation_created" data-entity="${mutation.id}">Enviar a Discord</button>` : ''}
            </article>
          `).join('') : '<div class="breeding-empty premium-panel"><div data-breeding-empty-lottie aria-hidden="true"></div><h2>Sin mutaciones todavía</h2><p>El primer registro aparecerá aquí con su cooldown calculado.</p></div>'}
        </div>
      </section>
      <aside class="cooldown-rail">
        <div><p class="section-kicker">Próximas ventanas</p><h2>Cooldowns</h2><p>${settings.uses_propagators ? `Propagator cada ${settings.propagator_cooldown_hours} h.` : `Velocidad de breeding ×${settings.breeding_speed_multiplier}.`}</p></div>
        <div class="cooldown-list stagger-group">
          ${alerts.length ? alerts.map((alert) => {
            const available = new Date(alert.available_at).getTime() <= now;
            return `<article class="stagger-item ${available ? 'is-ready' : ''}">
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
  const tribeService = createTribeService(authService.getClient());
  const mode = path.endsWith('/mutations') ? 'mutations' : 'breeds';
  let workspace;
  let data = { species: [], breeds: [], mutations: [], alerts: [], members: [], settings: {} };
  let cleanupViewMotion = () => {};

  function refreshViewMotion() {
    cleanupViewMotion();
    const cleanupScroll = initScrollAnimations(view);
    const cleanupCards = initCardHoverEffects(view);
    const lottieCleanups = [...view.querySelectorAll('[data-breeding-empty-lottie]')].map((element) => mountLottieMotion(element, {
      src: '/animations/empty-tribe.lottie',
      loop: true,
    }));
    cleanupViewMotion = () => {
      cleanupScroll();
      cleanupCards();
      lottieCleanups.forEach((cleanup) => cleanup());
    };
  }

  async function load() {
    view.innerHTML = loadingView();
    workspace = await resolvePrivateWorkspace({ state, authService });
    if (workspace.error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos abrir breeding.</h1><p>${escapeHtml(workspace.error)}</p><button class="button button-primary" data-retry-breeding>Reintentar</button></section>`;
      return;
    }
    if (workspace.empty) { navigate('/app'); return; }
    const tribeId = workspace.activeMembership.tribe_id;
    const [settings, species, breeds, mutations, alerts, members] = await Promise.all([
      service.getSettings(tribeId),
      service.listSpecies(workspace.activeMembership.tribe.game_mode),
      service.listBreeds(tribeId),
      service.listMutations(tribeId),
      service.listAlerts(tribeId),
      tribeService.getMembers(tribeId),
    ]);
    const error = settings.error || species.error || breeds.error || mutations.error || alerts.error || members.error;
    if (error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos sincronizar breeding.</h1><p>${escapeHtml(error)}</p><button class="button button-primary" data-retry-breeding>Reintentar</button></section>`;
      return;
    }
    data = { settings: settings.data, species: species.data, breeds: breeds.data, mutations: mutations.data, alerts: alerts.data, members: members.data };
    view.innerHTML = `
      <section class="breeding-workspace">
        ${workspaceHeader({ ...workspace, mode })}
        ${mode === 'breeds'
          ? breedsView({ activeMembership: workspace.activeMembership, species: data.species, breeds: data.breeds, members: data.members })
          : mutationsView({ activeMembership: workspace.activeMembership, ...data })}
      </section>
      ${mutationDialog(data.breeds)}
    `;
    refreshViewMotion();
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
      const baseStats = readStats(values, 'base-');
      if (!Object.keys(baseStats).length) { setFormStatus(form, 'Registra al menos un stat base para la línea.'); return; }
      setSubmitting(form, true, 'Crear línea');
      const result = await service.createBreed({
        tribeId, speciesId: values.get('speciesId'), title: values.get('title').trim(),
        baseStats, caretakerUserId: values.get('caretakerUserId'), notes: values.get('notes').trim(),
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Crear línea'); return; }
      showToast('Línea de breeding creada.');
      await load();
    }

    if (form.matches('[data-mutation-form]')) {
      const calculation = updateMutationCalculation(form, data.breeds);
      if (!calculation?.valid) { setFormStatus(form, 'Revisa el valor nuevo antes de guardar.'); return; }
      if (calculation.isOdd && !values.get('allowOdd')) { setFormStatus(form, 'Confirma el redondeo de la diferencia impar.'); return; }
      setSubmitting(form, true, 'Guardar mutación');
      const result = await service.registerStatMutation({
        tribeId, breedId: values.get('breedId'), statKey: values.get('statKey'), newValue: values.get('newValue'),
        notes: values.get('notes').trim(), allowOdd: values.get('allowOdd') === 'on',
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
    if (event.target.matches('[data-mutation-breed], [data-mutation-stat]')) {
      updateMutationCalculation(event.target.form, data.breeds, true);
      return;
    }
    if (event.target.matches('[data-mutation-new]')) {
      updateMutationCalculation(event.target.form, data.breeds);
      return;
    }
    if (event.target.matches('[data-breed-caretaker]')) {
      const row = event.target.closest('[data-breed-id]');
      const result = await service.setCaretaker(row.dataset.breedId, event.target.value);
      if (result.error) { showToast(result.error, 'error'); await load(); return; }
      showToast('Cuidador de la línea actualizado.');
      await load();
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
      updateMutationCalculation(dialog.querySelector('[data-mutation-form]'), data.breeds, true);
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
  view.addEventListener('input', onChange);
  view.addEventListener('click', onClick);
  load();
  return () => {
    cleanupViewMotion();
    view.removeEventListener('submit', onSubmit);
    view.removeEventListener('change', onChange);
    view.removeEventListener('input', onChange);
    view.removeEventListener('click', onClick);
  };
}
