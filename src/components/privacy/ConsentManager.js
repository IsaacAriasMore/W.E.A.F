import { readConsent, saveConsent } from '../../services/consentService.js';
import { showToast } from '../../utils/feedback.js';

export function createConsentManager() {
  return `
    <aside class="consent-banner" data-consent-banner hidden aria-labelledby="consent-title">
      <div>
        <span>Tu privacidad, primero</span>
        <h2 id="consent-title">Tú decides qué medimos.</h2>
        <p>Usamos almacenamiento necesario para sesión y preferencias. Analítica y publicidad son opcionales.</p>
        <a href="/cookies" data-link>Ver política de cookies</a>
      </div>
      <div class="consent-actions">
        <button class="button button-primary" type="button" data-consent-accept>Aceptar opcionales</button>
        <button class="button button-secondary" type="button" data-consent-reject>Solo necesarias</button>
        <button class="text-button" type="button" data-consent-manage>Configurar</button>
      </div>
    </aside>

    <dialog class="content-dialog consent-dialog" data-consent-dialog aria-labelledby="consent-dialog-title">
      <div class="dialog-header">
        <div><span>Preferencias de privacidad</span><h2 id="consent-dialog-title">Controla tus datos.</h2></div>
        <button class="dialog-close" type="button" data-consent-close aria-label="Cerrar">×</button>
      </div>
      <p>Puedes cambiar esta decisión cuando quieras desde el pie de página.</p>
      <form data-consent-form>
        <label class="consent-option">
          <span><strong>Necesarias</strong><small>Sesión, seguridad, checklists y la propia elección de privacidad.</small></span>
          <input type="checkbox" checked disabled aria-label="Cookies necesarias siempre activas" />
        </label>
        <label class="consent-option">
          <span><strong>Analítica</strong><small>Medición agregada para detectar funciones útiles y errores.</small></span>
          <input type="checkbox" name="analytics" />
        </label>
        <label class="consent-option">
          <span><strong>Publicidad</strong><small>Medición de promociones y, en el futuro, proveedores externos.</small></span>
          <input type="checkbox" name="advertising" />
        </label>
        <div class="dialog-actions">
          <button class="button button-primary" type="submit">Guardar preferencias</button>
          <button class="button button-secondary" type="button" data-consent-reject-dialog>Rechazar opcionales</button>
        </div>
      </form>
    </dialog>
  `;
}

export function bindConsentManager(root) {
  const banner = root.querySelector('[data-consent-banner]');
  const dialog = root.querySelector('[data-consent-dialog]');
  const form = root.querySelector('[data-consent-form]');

  function syncForm() {
    const consent = readConsent();
    form.elements.analytics.checked = Boolean(consent?.analytics);
    form.elements.advertising.checked = Boolean(consent?.advertising);
  }

  function decide(preferences, message) {
    saveConsent(preferences);
    banner.hidden = true;
    if (dialog.open) dialog.close();
    showToast(message);
  }

  function openPreferences() {
    syncForm();
    dialog.showModal();
  }

  banner.hidden = Boolean(readConsent());
  root.querySelector('[data-consent-accept]')?.addEventListener('click', () => decide({ analytics: true, advertising: true }, 'Preferencias guardadas.'));
  root.querySelector('[data-consent-reject]')?.addEventListener('click', () => decide({ analytics: false, advertising: false }, 'Solo usaremos almacenamiento necesario.'));
  root.querySelector('[data-consent-manage]')?.addEventListener('click', openPreferences);
  root.querySelectorAll('[data-open-consent]').forEach((button) => button.addEventListener('click', openPreferences));
  root.querySelector('[data-consent-close]')?.addEventListener('click', () => dialog.close());
  root.querySelector('[data-consent-reject-dialog]')?.addEventListener('click', () => decide({ analytics: false, advertising: false }, 'Solo usaremos almacenamiento necesario.'));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    decide({ analytics: form.elements.analytics.checked, advertising: form.elements.advertising.checked }, 'Preferencias de privacidad actualizadas.');
  });
}
