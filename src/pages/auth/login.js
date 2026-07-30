import { bindPasswordToggle, configurationNotice, setFormStatus, setSubmitting } from './formUtils.js';
import { destinationFromSearch, pathWithNext } from '../../utils/navigation.js';
import { getAuthCopy } from '../../config/auth.js';
import { getLanguage } from '../../i18n/index.js';
import { authCaptchaSubmitAttributes, bindAuthCaptcha, renderAuthCaptcha } from '../../services/turnstileService.js';
import '../../css/auth.css';
import { createSubmissionLock } from '../../utils/authCaptcha.js';

export function render({ state }) {
  const language = getLanguage();
  const copy = getAuthCopy(language);
  const destination = destinationFromSearch(window.location.search, null);
  const search = new URLSearchParams(window.location.search);
  const passwordUpdated = search.get('password') === 'updated';
  const accountCreated = search.get('registered') === '1';
  return `
    <section class="auth-shell container">
      <div class="auth-context premium-panel reveal-left" aria-hidden="true">
        <span class="auth-coordinate">${copy.login.coordinate}</span>
        <div class="auth-mark-frame"><img src="/assets/weaf-mark.svg" alt="" width="96" height="96" /></div>
        <p>${copy.login.context}</p>
      </div>
      <div class="auth-card reveal-right">
        <div class="auth-heading">
          <p class="section-kicker">${copy.login.eyebrow}</p>
          <h1>${copy.login.title}</h1>
          <p>${copy.login.body}</p>
        </div>
        ${configurationNotice(state.configured, language)}
        ${accountCreated ? `<p class="form-status form-status-success auth-route-status" role="status">${copy.login.created}</p>` : ''}
        ${passwordUpdated ? `<p class="form-status form-status-success auth-route-status" role="status">${copy.login.passwordUpdated}</p>` : ''}
        <form class="auth-form" data-login-form novalidate>
          <label>
            <span>${copy.login.email}</span>
            <input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="tribe@example.com" />
          </label>
          <label>
            <span>${copy.login.password}</span>
            <div class="password-control">
              <input id="login-password" name="password" type="password" autocomplete="current-password" required />
              <button type="button" data-password-toggle aria-controls="login-password" aria-pressed="false">${copy.show}</button>
            </div>
          </label>
          ${renderAuthCaptcha({ action: 'login', language })}
          <p class="form-status" data-form-status role="alert" hidden></p>
          <button class="button button-primary auth-submit" type="submit"${authCaptchaSubmitAttributes()}>${copy.signIn}</button>
        </form>
        <details class="auth-recovery">
          <summary>${copy.login.recoveryQuestion}</summary>
          <form data-recovery-form novalidate>
            <p>${copy.login.recoveryHelp}</p>
            <label><span>${copy.login.recoveryEmail}</span><input name="email" type="email" autocomplete="email" required /></label>
            ${renderAuthCaptcha({ action: 'password_recovery', language })}
            <p class="form-status" data-form-status role="alert" hidden></p>
            <button class="button button-secondary button-small" type="submit"${authCaptchaSubmitAttributes()}>${copy.login.sendLink}</button>
          </form>
        </details>
        <p class="auth-switch">${copy.login.noAccount} <a class="text-link" href="${pathWithNext('/register', destination)}" data-link>${copy.login.createAccount}</a></p>
      </div>
    </section>
  `;
}

export function bind({ authService, navigate }) {
  const language = getLanguage();
  const copy = getAuthCopy(language);
  const form = document.querySelector('[data-login-form]');
  const recoveryForm = document.querySelector('[data-recovery-form]');
  const recoveryDetails = recoveryForm.closest('details');
  const loginCaptcha = bindAuthCaptcha(form, { action: 'login', language });
  let recoveryCaptcha = null;
  const ensureRecoveryCaptcha = () => {
    recoveryCaptcha ||= bindAuthCaptcha(recoveryForm, { action: 'password_recovery', language });
    return recoveryCaptcha;
  };
  const onRecoveryToggle = () => { if (recoveryDetails.open) ensureRecoveryCaptcha(); };
  recoveryDetails.addEventListener('toggle', onRecoveryToggle);
  const loginLock = createSubmissionLock();
  const recoveryLock = createSubmissionLock();
  bindPasswordToggle(form, language);

  const restoreLogin = () => {
    setSubmitting(form, false, copy.signIn, copy.processing);
    loginCaptcha.reset();
    loginLock.release();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!loginLock.tryLock()) return;
    setFormStatus(form);
    if (!form.reportValidity()) { loginLock.release(); return; }
    const captcha = loginCaptcha.takeToken();
    if (!captcha.ok) {
      setFormStatus(form, copy.captcha.required);
      loginLock.release();
      return;
    }

    setSubmitting(form, true, copy.signIn, copy.processing);
    const values = new FormData(form);
    const { data, error } = await authService.signIn({
      email: values.get('email').trim(),
      password: values.get('password'),
      captchaToken: captcha.captchaToken,
    });

    if (error) {
      setFormStatus(form, error);
      restoreLogin();
      return;
    }

    loginCaptcha.reset();
    loginLock.release();
    const destination = destinationFromSearch();
    if (data?.session) {
      navigate(destination);
      return;
    }
    setFormStatus(form, copy.errors.generic);
    setSubmitting(form, false, copy.signIn, copy.processing);
  };

  const restoreRecovery = () => {
    setSubmitting(recoveryForm, false, copy.login.sendLink, copy.processing);
    ensureRecoveryCaptcha().reset();
    recoveryLock.release();
  };

  const onRecovery = async (event) => {
    event.preventDefault();
    if (!recoveryLock.tryLock()) return;
    setFormStatus(recoveryForm);
    if (!recoveryForm.reportValidity()) { recoveryLock.release(); return; }
    const captchaController = ensureRecoveryCaptcha();
    const captcha = captchaController.takeToken();
    if (!captcha.ok) {
      setFormStatus(recoveryForm, copy.captcha.required);
      recoveryLock.release();
      return;
    }

    setSubmitting(recoveryForm, true, copy.login.sendLink, copy.processing);
    const email = new FormData(recoveryForm).get('email').trim();
    const { error } = await authService.requestPasswordReset(email, captcha.captchaToken);
    if (error) {
      setFormStatus(recoveryForm, error);
      restoreRecovery();
      return;
    }
    setFormStatus(recoveryForm, copy.login.recoverySuccess, 'success');
    restoreRecovery();
  };

  form.addEventListener('submit', onSubmit);
  recoveryForm.addEventListener('submit', onRecovery);
  return () => {
    form.removeEventListener('submit', onSubmit);
    recoveryForm.removeEventListener('submit', onRecovery);
    recoveryDetails.removeEventListener('toggle', onRecoveryToggle);
    loginCaptcha.destroy();
    recoveryCaptcha?.destroy();
  };
}
