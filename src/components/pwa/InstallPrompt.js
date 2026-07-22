import { getDeferredInstallPrompt, isIosInstallCandidate, isStandalone, requestAppInstall } from '../../services/pwaService.js';
import { readConsent } from '../../services/consentService.js';
import { showToast } from '../../utils/feedback.js';

const DISMISSED_KEY = 'weaf:install-dismissed:v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;

function recentlyDismissed() {
  return Number(window.localStorage.getItem(DISMISSED_KEY) || 0) > Date.now() - WEEK;
}

export function createInstallPrompt() {
  return `
    <aside class="install-prompt" data-install-prompt hidden aria-labelledby="install-prompt-title">
      <img src="/assets/weaf-mark.svg" width="44" height="44" alt="" />
      <div><span>W.E.A.F en tu dispositivo</span><h2 id="install-prompt-title">Instala el centro de tu tribu.</h2><p>Acceso rápido y una pantalla útil incluso cuando la conexión falla.</p></div>
      <button class="button button-primary button-small" type="button" data-install-confirm>Instalar</button>
      <button class="install-dismiss" type="button" data-install-dismiss aria-label="Recordármelo después">×</button>
    </aside>
    <dialog class="content-dialog ios-install-dialog" data-ios-install-dialog aria-labelledby="ios-install-title">
      <div class="dialog-header"><div><span>Instalar en iPhone o iPad</span><h2 id="ios-install-title">Añádela a tu inicio.</h2></div><button class="dialog-close" type="button" data-ios-install-close aria-label="Cerrar">×</button></div>
      <ol><li>Toca el botón <strong>Compartir</strong> de Safari.</li><li>Elige <strong>Añadir a pantalla de inicio</strong>.</li><li>Confirma con <strong>Añadir</strong>.</li></ol>
      <div class="dialog-actions"><button class="button button-primary" type="button" data-ios-install-close>Entendido</button></div>
    </dialog>
  `;
}

export function bindInstallPrompt(root) {
  const prompt = root.querySelector('[data-install-prompt]');
  const iosDialog = root.querySelector('[data-ios-install-dialog]');
  const installButtons = root.querySelectorAll('[data-install-app]');

  function canOffer() {
    return !isStandalone() && (Boolean(getDeferredInstallPrompt()) || isIosInstallCandidate());
  }

  function updateButtons() {
    installButtons.forEach((button) => { button.hidden = !canOffer(); });
  }

  function offerAutomatically() {
    updateButtons();
    if (!getDeferredInstallPrompt() || !readConsent() || recentlyDismissed()) return;
    prompt.hidden = false;
  }

  async function install() {
    if (isIosInstallCandidate() && !getDeferredInstallPrompt()) {
      iosDialog.showModal();
      return;
    }
    const result = await requestAppInstall();
    prompt.hidden = true;
    if (result.outcome === 'accepted') showToast('Instalación iniciada.');
  }

  root.querySelector('[data-install-confirm]')?.addEventListener('click', install);
  root.querySelector('[data-install-dismiss]')?.addEventListener('click', () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    prompt.hidden = true;
  });
  installButtons.forEach((button) => button.addEventListener('click', install));
  root.querySelectorAll('[data-ios-install-close]').forEach((button) => button.addEventListener('click', () => iosDialog.close()));
  iosDialog.addEventListener('click', (event) => { if (event.target === iosDialog) iosDialog.close(); });
  window.addEventListener('weaf:install-available', offerAutomatically);
  window.addEventListener('weaf:consent-changed', offerAutomatically);
  window.addEventListener('weaf:app-installed', () => { prompt.hidden = true; updateButtons(); });
  window.setTimeout(offerAutomatically, 900);
}
