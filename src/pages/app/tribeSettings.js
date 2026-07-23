import { createAppNavigation } from '../../components/layout/AppNavigation.js';
import { createBreedService } from '../../services/breedService.js';
import { createTribeService } from '../../services/tribeService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { formatDateTime } from '../../utils/dates.js';
import { showToast } from '../../utils/feedback.js';
import { setFormStatus, setSubmitting } from '../auth/formUtils.js';
import { resolvePrivateWorkspace, tribePath } from './privateWorkspace.js';
import { initCardHoverEffects, initScrollAnimations } from '../../utils/motion.js';

function loadingView() {
  return '<div class="app-view-loading"><span class="skeleton skeleton-copy"></span><span class="skeleton skeleton-title"></span><div><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div></div>';
}

function settingsView({ workspace, settings }) {
  const membership = workspace.activeMembership;
  const tribe = membership.tribe;
  const owner = membership.role === 'owner';
  const canReset = ['owner', 'admin'].includes(membership.role);
  const webhook = settings.webhook || {};
  return `
    <section class="tribe-settings-workspace">
      <header class="app-toolbar reveal-up">
        <div><p class="section-kicker">Configuración de tribu</p><h1>Reglas del servidor</h1><p>${escapeHtml(tribe.name)} · los cambios críticos corresponden al propietario.</p></div>
        <label class="tribe-switcher"><span>Cambiar de tribu</span><select data-settings-tribe>
          ${workspace.memberships.map((item) => `<option value="${item.tribe_id}" ${item.tribe_id === tribe.id ? 'selected' : ''}>${escapeHtml(item.tribe.name)}</option>`).join('')}
        </select></label>
      </header>
      <div class="settings-ledger stagger-group">
        <section class="settings-section stagger-item">
          <div class="settings-section-copy">
            <span>01</span><h2>Ritmo de breeding</h2>
            <p>Define la fórmula usada para cada cooldown nuevo. Los registros existentes conservan su fecha.</p>
          </div>
          ${owner ? `
            <form class="settings-form" data-breeding-settings-form novalidate>
              <label><span>Modo del servidor</span><select name="mode" data-breeding-mode>
                <option value="propagators" ${settings.uses_propagators ? 'selected' : ''}>Usa propagators</option>
                <option value="multiplier" ${!settings.uses_propagators ? 'selected' : ''}>Usa multiplicador de breeding</option>
              </select></label>
              <label data-propagator-field ${settings.uses_propagators ? '' : 'hidden'}><span>Cooldown del propagator <small>Horas</small></span><input name="cooldownHours" type="number" min="0.25" max="720" step="0.25" value="${settings.propagator_cooldown_hours || 12}" /></label>
              <label data-multiplier-field ${settings.uses_propagators ? 'hidden' : ''}><span>Multiplicador del servidor</span><input name="breedingMultiplier" type="number" min="0.001" max="1000" step="0.001" value="${settings.breeding_speed_multiplier || 1}" /></label>
              <p class="settings-formula" data-settings-formula>${settings.uses_propagators ? `Cooldown fijo: ${settings.propagator_cooldown_hours} horas` : `Cooldown = tiempo vanilla ÷ ${settings.breeding_speed_multiplier}`}</p>
              <p class="form-status" data-form-status role="alert" hidden></p>
              <button class="button button-primary" type="submit">Guardar ritmo</button>
            </form>
          ` : `<div class="settings-readonly"><span>Configuración activa</span><strong>${settings.uses_propagators ? `Propagator · ${settings.propagator_cooldown_hours} h` : `Breeding ×${settings.breeding_speed_multiplier}`}</strong><p>Solo el propietario puede modificarla.</p></div>`}
        </section>
        <section class="settings-section stagger-item">
          <div class="settings-section-copy">
            <span>02</span><h2>Canal de Discord</h2>
            <p>El webhook se cifra con Supabase Vault. Después de guardarlo, el navegador solo ve sus últimos cuatro caracteres.</p>
          </div>
          <div class="discord-settings-panel">
            <div class="webhook-status ${webhook.configured ? 'is-configured' : ''}">
              <span aria-hidden="true">${webhook.configured ? '●' : '○'}</span>
              <div><strong>${webhook.configured ? 'Webhook configurado' : 'Sin webhook'}</strong>
                <small>${webhook.configured ? `Terminación ····${escapeHtml(webhook.last4)} · ${webhook.enabled ? 'Activo' : 'Pausado'}` : 'Ningún secreto almacenado'}</small>
              </div>
            </div>
            ${webhook.last_success_at ? `<p class="delivery-state">Último envío correcto: ${formatDateTime(webhook.last_success_at)}</p>` : ''}
            ${webhook.last_error ? `<p class="delivery-error">Último error: ${escapeHtml(webhook.last_error)}</p>` : ''}
            ${owner ? `
              <form class="settings-form" data-webhook-form novalidate>
                <label><span>${webhook.configured ? 'Reemplazar webhook' : 'URL del webhook'}</span><input name="webhookUrl" type="url" required maxlength="300" autocomplete="off" placeholder="https://discord.com/api/webhooks/…" /></label>
                <p class="field-help">Se envía una vez a Vault y nunca vuelve a mostrarse completo.</p>
                <p class="form-status" data-form-status role="alert" hidden></p>
                <button class="button button-primary" type="submit">${webhook.configured ? 'Cambiar webhook' : 'Conectar Discord'}</button>
              </form>
              ${webhook.configured ? `<button class="button button-secondary button-small" type="button" data-toggle-webhook data-enabled="${String(!webhook.enabled)}">${webhook.enabled ? 'Pausar avisos' : 'Reactivar avisos'}</button>` : ''}
            ` : '<p class="panel-note">Solo el propietario puede guardar o reemplazar este secreto.</p>'}
          </div>
        </section>
        <section class="settings-section settings-policy stagger-item">
          <div class="settings-section-copy"><span>03</span><h2>Límite de confianza</h2><p>Qué ocurre con cada dato sensible.</p></div>
          <dl>
            <div><dt>Webhook</dt><dd>Cifrado en Vault, nunca en una tabla pública.</dd></div>
            <div><dt>Mutaciones</dt><dd>Visibles solo para miembros activos de esta tribu.</dd></div>
            <div><dt>Envíos</dt><dd>Autenticados, limitados y registrados desde una Edge Function.</dd></div>
          </dl>
        </section>
        ${canReset ? `<section class="settings-section settings-danger stagger-item">
          <div class="settings-section-copy"><span>04</span><h2>Nuevo wipe</h2><p>Conserva especies y líneas, crea un snapshot y reinicia stats actuales, conteos y cooldowns.</p></div>
          <div class="settings-readonly"><strong>Reinicio auditable</strong><p>Los registros históricos no se eliminan.</p><button class="button button-secondary button-small reset-breeding-button" type="button" data-open-breeding-reset>Reiniciar breeding</button></div>
        </section>` : ''}
        ${owner ? `<section class="settings-section settings-danger stagger-item">
          <div class="settings-section-copy"><span>05</span><h2>Archivar tribu</h2><p>La oculta de los selectores y bloquea el acceso sin borrar miembros ni historial.</p></div>
          <div class="settings-readonly"><strong>${escapeHtml(tribe.name)}</strong><p>Solo el propietario puede realizar esta acción.</p><button class="text-button danger-action" type="button" data-open-archive-tribe>Archivar tribu</button></div>
        </section>` : ''}
      </div>
      ${canReset ? `<dialog class="content-dialog" data-breeding-reset-dialog><div class="dialog-header"><div><span>Nuevo ciclo</span><h2>Reiniciar breeding</h2></div><button class="dialog-close" type="button" data-close-settings-dialog aria-label="Cerrar">×</button></div><p>Se guardará un snapshot antes del reinicio. Esta acción afecta solo a ${escapeHtml(tribe.name)}.</p><form class="settings-form" data-breeding-reset-form novalidate><label><span>Motivo del wipe</span><textarea name="reason" minlength="3" maxlength="500" required placeholder="Ej. Wipe de temporada 4"></textarea></label><label class="confirmation-check"><input name="acknowledge" type="checkbox" required /><span>Entiendo que los stats actuales, mutaciones acumuladas y cooldowns volverán al inicio del ciclo.</span></label><p class="form-status" data-form-status role="alert" hidden></p><button class="button button-secondary reset-breeding-button" type="submit">Confirmar reinicio</button></form></dialog>` : ''}
      ${owner ? `<dialog class="content-dialog" data-archive-tribe-dialog><div class="dialog-header"><div><span>Zona de riesgo</span><h2>Archivar tribu</h2></div><button class="dialog-close" type="button" data-close-settings-dialog aria-label="Cerrar">×</button></div><p>Escribe exactamente <strong>${escapeHtml(tribe.name)}</strong>. Podrás conservar la información en el historial, pero la tribu dejará de estar activa.</p><form class="settings-form" data-archive-tribe-form novalidate><label><span>Nombre exacto</span><input name="confirmationName" required autocomplete="off" /></label><label class="confirmation-check"><input name="acknowledge" type="checkbox" required /><span>Entiendo que todos los miembros perderán acceso a esta tribu activa.</span></label><p class="form-status" data-form-status role="alert" hidden></p><button class="button button-secondary danger-button" type="submit">Archivar definitivamente</button></form></dialog>` : ''}
    </section>
  `;
}

export function render({ state }) {
  return `<div class="private-app-shell">${createAppNavigation(state.profile)}<section class="private-app-main" data-settings-view>${loadingView()}</section></div>`;
}

export function bind({ state, authService, navigate }) {
  const view = document.querySelector('[data-settings-view]');
  const service = createBreedService(authService.getClient());
  const tribeService = createTribeService(authService.getClient());
  let workspace;
  let cleanupViewMotion = () => {};

  function refreshViewMotion() {
    cleanupViewMotion();
    const cleanupScroll = initScrollAnimations(view);
    const cleanupCards = initCardHoverEffects(view);
    cleanupViewMotion = () => {
      cleanupScroll();
      cleanupCards();
    };
  }

  async function load() {
    view.innerHTML = loadingView();
    workspace = await resolvePrivateWorkspace({ state, authService });
    if (workspace.error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos abrir la configuración.</h1><p>${escapeHtml(workspace.error)}</p><button class="button button-primary" data-retry-settings>Reintentar</button></section>`;
      return;
    }
    if (workspace.empty) { navigate('/app'); return; }
    const result = await service.getSettings(workspace.activeMembership.tribe_id);
    if (result.error) {
      view.innerHTML = `<section class="app-error"><h1>No pudimos leer la configuración.</h1><p>${escapeHtml(result.error)}</p><button class="button button-primary" data-retry-settings>Reintentar</button></section>`;
      return;
    }
    view.innerHTML = settingsView({ workspace, settings: result.data });
    refreshViewMotion();
  }

  const onSubmit = async (event) => {
    const form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const tribeId = workspace.activeMembership.tribe_id;

    if (form.matches('[data-breeding-settings-form]')) {
      const usesPropagators = values.get('mode') === 'propagators';
      setSubmitting(form, true, 'Guardar ritmo');
      const result = await service.configureBreeding({
        tribeId, usesPropagators, cooldownHours: values.get('cooldownHours'),
        breedingMultiplier: values.get('breedingMultiplier'),
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Guardar ritmo'); return; }
      showToast('Configuración de breeding actualizada.');
      await load();
    }

    if (form.matches('[data-webhook-form]')) {
      const buttonLabel = form.querySelector('[type="submit"]').textContent;
      setSubmitting(form, true, buttonLabel);
      const result = await service.configureWebhook({
        tribeId, webhookUrl: values.get('webhookUrl').trim(), enabled: true,
      });
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, buttonLabel); return; }
      form.reset();
      showToast('Webhook cifrado y conectado.');
      await load();
    }

    if (form.matches('[data-breeding-reset-form]')) {
      setSubmitting(form, true, 'Confirmar reinicio');
      const result = await service.resetTribeBreeding(tribeId, values.get('reason').trim());
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Confirmar reinicio'); return; }
      showToast(`Breeding reiniciado: ${result.data?.affected_breeds || 0} líneas actualizadas.`);
      await load();
    }

    if (form.matches('[data-archive-tribe-form]')) {
      setSubmitting(form, true, 'Archivar definitivamente');
      const result = await tribeService.archiveTribe(tribeId, values.get('confirmationName'), values.get('acknowledge') === 'on');
      if (result.error) { setFormStatus(form, result.error); setSubmitting(form, false, 'Archivar definitivamente'); return; }
      window.localStorage.removeItem('weaf:active-tribe');
      showToast('Tribu archivada.');
      navigate('/app');
    }
  };

  const onChange = (event) => {
    if (event.target.matches('[data-settings-tribe]')) {
      navigate(tribePath('/app/tribe-settings', event.target.value));
      return;
    }
    if (event.target.matches('[data-breeding-mode]')) {
      const propagators = event.target.value === 'propagators';
      const form = event.target.form;
      form.querySelector('[data-propagator-field]').hidden = !propagators;
      form.querySelector('[data-multiplier-field]').hidden = propagators;
      form.elements.cooldownHours.required = propagators;
      form.elements.breedingMultiplier.required = !propagators;
      form.querySelector('[data-settings-formula]').textContent = propagators
        ? 'Cada mutación agenda el cooldown fijo del propagator.'
        : 'Cada especie usa su tiempo vanilla dividido por este multiplicador.';
    }
  };

  const onClick = async (event) => {
    if (event.target.closest('[data-retry-settings]')) { await load(); return; }
    if (event.target.closest('[data-open-breeding-reset]')) { view.querySelector('[data-breeding-reset-dialog]')?.showModal(); return; }
    if (event.target.closest('[data-open-archive-tribe]')) { view.querySelector('[data-archive-tribe-dialog]')?.showModal(); return; }
    if (event.target.closest('[data-close-settings-dialog]')) { event.target.closest('dialog')?.close(); return; }
    const toggle = event.target.closest('[data-toggle-webhook]');
    if (!toggle) return;
    toggle.disabled = true;
    const enabled = toggle.dataset.enabled === 'true';
    const result = await service.setWebhookEnabled(workspace.activeMembership.tribe_id, enabled);
    if (result.error) { showToast(result.error, 'error'); toggle.disabled = false; }
    else { showToast(enabled ? 'Avisos reactivados.' : 'Avisos pausados.'); await load(); }
  };

  view.addEventListener('submit', onSubmit);
  view.addEventListener('change', onChange);
  view.addEventListener('click', onClick);
  load();
  return () => {
    cleanupViewMotion();
    view.removeEventListener('submit', onSubmit);
    view.removeEventListener('change', onChange);
    view.removeEventListener('click', onClick);
  };
}
