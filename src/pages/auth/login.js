import { bindPasswordToggle, configurationNotice, setFormStatus, setSubmitting } from './formUtils.js';
import { destinationFromSearch, pathWithNext } from '../../utils/navigation.js';
import { AUTH_COPY } from '../../config/auth.js';

export function render({ state }) {
  const destination = destinationFromSearch(window.location.search, null);
  const search = new URLSearchParams(window.location.search);
  const passwordUpdated = search.get('password') === 'updated';
  const accountCreated = search.get('registered') === '1';
  return `
    <section class="auth-shell container">
      <div class="auth-context" aria-hidden="true">
        <span class="auth-coordinate">W.E.A.F / ACCESO</span>
        <div class="auth-mark-frame"><img src="/assets/weaf-mark.svg" alt="" width="96" height="96" /></div>
        <p>Un solo acceso para tu perfil, tus criaturas y el espacio privado de tu tribu.</p>
      </div>
      <div class="auth-card">
        <div class="auth-heading">
          <p class="section-kicker">Bienvenido de vuelta</p>
          <h1>Ingresa a la forja</h1>
          <p>Continúa desde el último punto guardado.</p>
        </div>
        ${configurationNotice(state.configured)}
        ${accountCreated ? '<p class="form-status form-status-success auth-route-status" role="status">Cuenta creada correctamente. Ya puedes entrar a W.E.A.F.</p>' : ''}
        ${passwordUpdated ? '<p class="form-status form-status-success auth-route-status" role="status">Contraseña actualizada. Ya puedes iniciar sesión.</p>' : ''}
        <form class="auth-form" data-login-form novalidate>
          <label>
            <span>Correo electrónico</span>
            <input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="tribe@example.com" />
          </label>
          <label>
            <span>Contraseña</span>
            <div class="password-control">
              <input id="login-password" name="password" type="password" autocomplete="current-password" required minlength="8" />
              <button type="button" data-password-toggle aria-controls="login-password" aria-pressed="false">Mostrar</button>
            </div>
          </label>
          <p class="form-status" data-form-status role="alert" hidden></p>
          <button class="button button-primary auth-submit" type="submit">${AUTH_COPY.es.signIn}</button>
        </form>
        <details class="auth-recovery">
          <summary>¿Olvidaste tu contraseña?</summary>
          <form data-recovery-form novalidate>
            <p>Te enviaremos un enlace. Esta función depende de que SMTP esté disponible.</p>
            <label><span>Correo de recuperación</span><input name="email" type="email" autocomplete="email" required /></label>
            <p class="form-status" data-form-status role="alert" hidden></p>
            <button class="button button-secondary button-small" type="submit">Enviar enlace</button>
          </form>
        </details>
        <p class="auth-switch">¿Aún no tienes cuenta? <a class="text-link" href="${pathWithNext('/register', destination)}" data-link>Crear cuenta</a></p>
      </div>
    </section>
  `;
}

export function bind({ authService, navigate }) {
  const form = document.querySelector('[data-login-form]');
  const recoveryForm = document.querySelector('[data-recovery-form]');
  bindPasswordToggle(form);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;

    setSubmitting(form, true, AUTH_COPY.es.signIn);
    const values = new FormData(form);
    const { data, error } = await authService.signIn({
      email: values.get('email').trim(),
      password: values.get('password'),
    });

    if (error) {
      setFormStatus(form, error);
      setSubmitting(form, false, AUTH_COPY.es.signIn);
      return;
    }

    const destination = destinationFromSearch();
    if (data?.session) navigate(destination);
  };

  const onRecovery = async (event) => {
    event.preventDefault();
    setFormStatus(recoveryForm);
    if (!recoveryForm.reportValidity()) return;
    setSubmitting(recoveryForm, true, 'Enviar enlace');
    const email = new FormData(recoveryForm).get('email').trim();
    const { error } = await authService.requestPasswordReset(email);
    if (error) {
      setFormStatus(recoveryForm, error);
      setSubmitting(recoveryForm, false, 'Enviar enlace');
      return;
    }
    setFormStatus(recoveryForm, 'Si la cuenta existe, recibirás un enlace de recuperación.', 'success');
    setSubmitting(recoveryForm, false, 'Enviar enlace');
  };

  form.addEventListener('submit', onSubmit);
  recoveryForm.addEventListener('submit', onRecovery);
  return () => {
    form.removeEventListener('submit', onSubmit);
    recoveryForm.removeEventListener('submit', onRecovery);
  };
}
