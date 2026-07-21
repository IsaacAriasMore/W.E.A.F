import { bindPasswordToggle, configurationNotice, setFormStatus, setSubmitting } from './formUtils.js';
import { destinationFromSearch, pathWithNext } from '../../utils/navigation.js';

export function render({ state }) {
  const destination = destinationFromSearch(window.location.search, null);
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
          <button class="button button-primary auth-submit" type="submit">Ingresar</button>
        </form>
        <p class="auth-switch">¿Aún no tienes cuenta? <a class="text-link" href="${pathWithNext('/register', destination)}" data-link>Crear cuenta</a></p>
      </div>
    </section>
  `;
}

export function bind({ authService, navigate }) {
  const form = document.querySelector('[data-login-form]');
  bindPasswordToggle(form);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;

    setSubmitting(form, true, 'Ingresar');
    const values = new FormData(form);
    const { data, error } = await authService.signIn({
      email: values.get('email').trim(),
      password: values.get('password'),
    });

    if (error) {
      setFormStatus(form, error);
      setSubmitting(form, false, 'Ingresar');
      return;
    }

    const destination = destinationFromSearch();
    if (data?.session) navigate(destination);
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
