import { escapeHtml } from '../../utils/sanitize.js';
import { setFormStatus, setSubmitting } from './formUtils.js';
import { destinationFromSearch } from '../../utils/navigation.js';
import { needsUnverifiedEmailNotice } from '../../config/auth.js';

const modes = [
  { value: 'evolved', title: 'ARK: Survival Evolved', code: 'ASE', detail: 'Herramientas y datos clásicos.' },
  { value: 'ascended', title: 'ARK: Survival Ascended', code: 'ASA', detail: 'Contenido y sistemas actuales.' },
  { value: 'both', title: 'Juego en ambos', code: 'ASE + ASA', detail: 'Una vista combinada del ecosistema.' },
];

function emailNotice(user) {
  if (!needsUnverifiedEmailNotice(user)) return '';
  return `<aside class="email-verification-notice" role="note"><strong>Tu correo no ha sido verificado todavía.</strong><p>Puedes usar W.E.A.F con normalidad. Este aviso no cambia tus permisos ni bloquea el acceso.</p></aside>`;
}

export function render({ state }) {
  const metadata = state.session?.user?.user_metadata || {};
  const displayName = state.profile?.display_name || metadata.display_name || '';
  const selectedMode = state.profile?.default_game_mode || metadata.default_game_mode || 'both';
  const completed = state.profile?.onboarding_completed;
  const destination = destinationFromSearch();

  if (completed) {
    return `
      <section class="onboarding-complete container">
        <div class="completion-seal" aria-hidden="true">WF</div>
        <p class="section-kicker">Perfil operativo</p>
        <h1>La forja te reconoce, ${escapeHtml(displayName)}.</h1>
        <p>Tu preferencia de juego está guardada. Ya puedes crear una tribu, aceptar tu invitación y administrar sus permisos.</p>
        ${emailNotice(state.session?.user)}
        <div class="completion-actions">
          <a class="button button-primary" href="${escapeHtml(destination)}" data-link>Ir a mis tribus</a>
          <a class="button button-secondary" href="/" data-link>Volver al inicio</a>
        </div>
      </section>
    `;
  }

  return `
    <section class="onboarding-shell container">
      <div class="onboarding-progress" aria-label="Progreso de configuración">
        <span>Perfil</span>
        <div><i></i></div>
        <strong>1 de 1</strong>
      </div>
      <div class="onboarding-heading">
        <p class="section-kicker">Configura tu punto de partida</p>
        <h1>¿En qué ARK construyes?</h1>
        <p>Esta elección ordena el contenido que verás primero. Podrás cambiarla después.</p>
      </div>
      ${emailNotice(state.session?.user)}
      <form class="onboarding-form" data-onboarding-form novalidate>
        <label class="profile-name">
          <span>Nombre visible</span>
          <input name="displayName" type="text" required minlength="2" maxlength="60" autocomplete="nickname" value="${escapeHtml(displayName)}" />
        </label>
        <fieldset class="mode-grid">
          <legend class="sr-only">Juego principal</legend>
          ${modes.map((mode) => `
            <label class="mode-card">
              <input type="radio" name="gameMode" value="${mode.value}" ${mode.value === selectedMode ? 'checked' : ''} required />
              <span>
                <small>${mode.code}</small>
                <strong>${mode.title}</strong>
                <em>${mode.detail}</em>
              </span>
            </label>
          `).join('')}
        </fieldset>
        <p class="form-status" data-form-status role="alert" hidden></p>
        <div class="onboarding-actions">
          <button class="button button-primary" type="submit">Guardar y continuar</button>
          <a class="button button-quiet" href="/" data-link>Completar después</a>
        </div>
      </form>
    </section>
  `;
}

export function bind({ state, store, profileService, navigate }) {
  const form = document.querySelector('[data-onboarding-form]');
  const destination = destinationFromSearch();
  if (!form) return null;

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;

    setSubmitting(form, true, 'Guardar y continuar');
    const values = new FormData(form);
    const result = await profileService.completeOnboarding(state.session.user.id, {
      displayName: values.get('displayName').trim(),
      gameMode: values.get('gameMode'),
    });

    if (result.error) {
      setFormStatus(form, result.error);
      setSubmitting(form, false, 'Guardar y continuar');
      return;
    }

    store.setState({ profile: result.profile });
    navigate(destination);
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
