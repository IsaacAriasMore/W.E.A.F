import {
  bindPasswordRequirements, bindPasswordToggle, configurationNotice,
  renderPasswordRequirements, setFormStatus, setSubmitting,
} from './formUtils.js';
import { getAuthCopy } from '../../config/auth.js';
import { getLanguage } from '../../i18n/index.js';

export function render({ state }) {
  const language = getLanguage();
  const copy = getAuthCopy(language);
  return `
    <section class="auth-shell container">
      <div class="auth-context" aria-hidden="true">
        <span class="auth-coordinate">${copy.reset.coordinate}</span>
        <div class="auth-mark-frame"><img src="/assets/weaf-mark.svg" alt="" width="96" height="96" /></div>
        <p>${copy.reset.context}</p>
      </div>
      <div class="auth-card">
        <div class="auth-heading">
          <p class="section-kicker">${copy.reset.eyebrow}</p>
          <h1>${copy.reset.title}</h1>
          <p>${copy.reset.body}</p>
        </div>
        ${configurationNotice(state.configured, language)}
        ${state.session ? `
          <form class="auth-form" data-reset-password-form novalidate>
            <label><span>${copy.reset.password}</span><div class="password-control">
              <input id="reset-password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="64" aria-describedby="reset-password-requirements" />
              <button type="button" data-password-toggle aria-controls="reset-password" aria-pressed="false">${copy.show}</button>
            </div>${renderPasswordRequirements(copy, 'reset-password-requirements')}</label>
            <label><span>${copy.reset.confirmation}</span><input name="confirmation" type="password" autocomplete="new-password" required minlength="8" maxlength="64" /></label>
            <p class="form-status" data-form-status role="alert" hidden></p>
            <button class="button button-primary auth-submit" type="submit">${copy.reset.submit}</button>
          </form>
        ` : `
          <div class="auth-recovery-invalid" role="status">
            <p>${copy.reset.invalidLink}</p>
            <a class="button button-secondary" href="/login" data-link>${copy.reset.requestAgain}</a>
          </div>
        `}
      </div>
    </section>`;
}

export function bind({ authService }) {
  const form = document.querySelector('[data-reset-password-form]');
  if (!form) return null;
  const copy = getAuthCopy(getLanguage());
  bindPasswordToggle(form);
  const passwordPolicy = bindPasswordRequirements(form, form.elements.password, copy);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormStatus(form);
    passwordPolicy.validate();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    if (values.get('password') !== values.get('confirmation')) {
      setFormStatus(form, copy.passwordRequirements.mismatch);
      return;
    }
    setSubmitting(form, true, copy.reset.submit);
    const { error } = await authService.updatePassword(values.get('password'));
    if (error) {
      setFormStatus(form, error);
      setSubmitting(form, false, copy.reset.submit);
      return;
    }
    await authService.signOut({ localOnly: true });
    window.location.assign('/login?password=updated');
  };

  form.addEventListener('submit', onSubmit);
  return () => {
    form.removeEventListener('submit', onSubmit);
    passwordPolicy.destroy();
  };
}
import '../../css/auth.css';
