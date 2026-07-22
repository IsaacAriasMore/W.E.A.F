import { bindPasswordToggle, configurationNotice, setFormStatus, setSubmitting } from './formUtils.js';

export function render({ state }) {
  return `
    <section class="auth-shell container">
      <div class="auth-context" aria-hidden="true">
        <span class="auth-coordinate">W.E.A.F / RECUPERACIÓN</span>
        <div class="auth-mark-frame"><img src="/assets/weaf-mark.svg" alt="" width="96" height="96" /></div>
        <p>Recupera el acceso sin alterar tu perfil, tribus o permisos.</p>
      </div>
      <div class="auth-card">
        <div class="auth-heading">
          <p class="section-kicker">Acceso seguro</p>
          <h1>Crea una contraseña nueva</h1>
          <p>El enlace de recuperación debe seguir activo en este navegador.</p>
        </div>
        ${configurationNotice(state.configured)}
        ${state.session ? `
          <form class="auth-form" data-reset-password-form novalidate>
            <label><span>Nueva contraseña</span><div class="password-control">
              <input id="reset-password" name="password" type="password" autocomplete="new-password" required minlength="8" aria-describedby="reset-password-help" />
              <button type="button" data-password-toggle aria-controls="reset-password" aria-pressed="false">Mostrar</button>
            </div><small id="reset-password-help" class="field-help">Mínimo 8 caracteres.</small></label>
            <label><span>Confirmar contraseña</span><input name="confirmation" type="password" autocomplete="new-password" required minlength="8" /></label>
            <p class="form-status" data-form-status role="alert" hidden></p>
            <button class="button button-primary auth-submit" type="submit">Actualizar contraseña</button>
          </form>
        ` : `
          <div class="auth-recovery-invalid" role="status">
            <p>El enlace no es válido, expiró o todavía no abrió una sesión de recuperación.</p>
            <a class="button button-secondary" href="/login" data-link>Solicitar otro enlace</a>
          </div>
        `}
      </div>
    </section>`;
}

export function bind({ authService }) {
  const form = document.querySelector('[data-reset-password-form]');
  if (!form) return null;
  bindPasswordToggle(form);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    if (values.get('password') !== values.get('confirmation')) {
      setFormStatus(form, 'Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(form, true, 'Actualizar contraseña');
    const { error } = await authService.updatePassword(values.get('password'));
    if (error) {
      setFormStatus(form, error);
      setSubmitting(form, false, 'Actualizar contraseña');
      return;
    }
    await authService.signOut({ localOnly: true });
    window.location.assign('/login?password=updated');
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
