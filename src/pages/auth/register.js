import { bindPasswordToggle, configurationNotice, setFormStatus, setSubmitting } from './formUtils.js';

export function render({ state }) {
  return `
    <section class="auth-shell auth-shell-register container">
      <div class="auth-context" aria-hidden="true">
        <span class="auth-coordinate">W.E.A.F / NUEVO PERFIL</span>
        <div class="auth-mark-frame"><img src="/assets/weaf-mark.svg" alt="" width="96" height="96" /></div>
        <p>Empieza con tu identidad de juego. La tribu y sus permisos llegan en la siguiente fase.</p>
      </div>
      <div class="auth-card">
        <div class="auth-heading">
          <p class="section-kicker">Tu primera coordenada</p>
          <h1>Crea tu cuenta</h1>
          <p>Necesitamos solo lo esencial para preparar tu espacio.</p>
        </div>
        ${configurationNotice(state.configured)}
        <form class="auth-form" data-register-form novalidate>
          <label>
            <span>Nombre visible</span>
            <input name="displayName" type="text" autocomplete="nickname" required minlength="2" maxlength="60" placeholder="Cómo te conoce tu tribu" />
          </label>
          <label>
            <span>Correo electrónico</span>
            <input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="tribe@example.com" />
          </label>
          <label>
            <span>Contraseña</span>
            <div class="password-control">
              <input id="register-password" name="password" type="password" autocomplete="new-password" required minlength="8" aria-describedby="password-help" />
              <button type="button" data-password-toggle aria-controls="register-password" aria-pressed="false">Mostrar</button>
            </div>
            <small id="password-help" class="field-help">Mínimo 8 caracteres.</small>
          </label>
          <fieldset class="game-selector">
            <legend>¿Dónde juegas principalmente?</legend>
            <label><input type="radio" name="gameMode" value="evolved" required /><span>ASE<small>Survival Evolved</small></span></label>
            <label><input type="radio" name="gameMode" value="ascended" required /><span>ASA<small>Survival Ascended</small></span></label>
            <label><input type="radio" name="gameMode" value="both" required checked /><span>Ambos<small>Perfil combinado</small></span></label>
          </fieldset>
          <label class="legal-check">
            <input name="legal" type="checkbox" required />
            <span>Acepto los <a href="/terms" data-link>Términos</a> y la <a href="/privacy" data-link>Política de privacidad</a>.</span>
          </label>
          <p class="form-status" data-form-status role="alert" hidden></p>
          <button class="button button-primary auth-submit" type="submit">Crear cuenta</button>
        </form>
        <p class="auth-switch">¿Ya tienes cuenta? <a class="text-link" href="/login" data-link>Ingresar</a></p>
      </div>
    </section>
  `;
}

export function bind({ authService, profileService, navigate }) {
  const form = document.querySelector('[data-register-form]');
  bindPasswordToggle(form);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormStatus(form);
    if (!form.reportValidity()) return;

    setSubmitting(form, true, 'Crear cuenta');
    const values = new FormData(form);
    const { data, error } = await authService.signUp({
      displayName: values.get('displayName').trim(),
      email: values.get('email').trim(),
      password: values.get('password'),
      gameMode: values.get('gameMode'),
    });

    if (error) {
      setFormStatus(form, error);
      setSubmitting(form, false, 'Crear cuenta');
      return;
    }

    if (data?.session?.user) {
      await profileService.recordLegalAcceptance(data.session.user.id);
      navigate('/onboarding');
      return;
    }

    form.closest('.auth-card').innerHTML = `
      <div class="auth-success" role="status">
        <span class="success-mark">✓</span>
        <p class="section-kicker">Un paso más</p>
        <h1>Revisa tu correo</h1>
        <p>Enviamos un enlace de confirmación. Al abrirlo volverás a W.E.A.F para terminar tu perfil.</p>
        <a class="button button-secondary" href="/login" data-link>Ir al ingreso</a>
      </div>
    `;
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
