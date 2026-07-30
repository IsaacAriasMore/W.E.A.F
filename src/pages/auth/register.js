import { bindPasswordRequirements, bindPasswordToggle, configurationNotice, renderPasswordRequirements, setFormStatus, setSubmitting } from './formUtils.js';
import { destinationFromSearch, pathWithNext } from '../../utils/navigation.js';
import { getAuthCopy, REQUIRE_EMAIL_CONFIRMATION } from '../../config/auth.js';
import { showToast } from '../../utils/feedback.js';
import { getLanguage } from '../../i18n/index.js';
import { authCaptchaSubmitAttributes, bindAuthCaptcha, renderAuthCaptcha } from '../../services/turnstileService.js';
import { createSubmissionLock } from '../../utils/authCaptcha.js';

export function render({ state }) {
  const language = getLanguage();
  const copy = getAuthCopy(language);
  const destination = destinationFromSearch(window.location.search, null);
  return `
    <section class="auth-shell auth-shell-register container">
      <div class="auth-context premium-panel reveal-left" aria-hidden="true">
        <span class="auth-coordinate">${copy.register.coordinate}</span>
        <div class="auth-mark-frame"><img src="/assets/weaf-mark.svg" alt="" width="96" height="96" /></div>
        <p>${copy.register.context}</p>
      </div>
      <div class="auth-card reveal-right">
        <div class="auth-heading">
          <p class="section-kicker">${copy.register.eyebrow}</p>
          <h1>${copy.register.title}</h1>
          <p>${copy.register.body}</p>
        </div>
        ${configurationNotice(state.configured, language)}
        <form class="auth-form" data-register-form novalidate>
          <label>
            <span>${copy.register.displayName}</span>
            <input name="displayName" type="text" autocomplete="nickname" required minlength="2" maxlength="60" placeholder="${copy.register.displayNamePlaceholder}" />
          </label>
          <label>
            <span>${copy.register.email}</span>
            <input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="tribe@example.com" />
          </label>
          <label>
            <span>${copy.register.password}</span>
            <div class="password-control">
              <input id="register-password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="64" aria-describedby="password-help register-password-requirements" />
              <button type="button" data-password-toggle aria-controls="register-password" aria-pressed="false">${copy.show}</button>
            </div>
            <small id="password-help" class="field-help">${copy.register.passwordHelp}</small>
            ${renderPasswordRequirements(copy, 'register-password-requirements')}
          </label>
          <fieldset class="game-selector">
            <legend>${copy.register.gameQuestion}</legend>
            <label><input type="radio" name="gameMode" value="evolved" required /><span>ASE<small>Survival Evolved</small></span></label>
            <label><input type="radio" name="gameMode" value="ascended" required /><span>ASA<small>Survival Ascended</small></span></label>
            <label><input type="radio" name="gameMode" value="both" required checked /><span>${copy.register.both}<small>${copy.register.combined}</small></span></label>
          </fieldset>
          <label class="legal-check">
            <input name="legal" type="checkbox" required />
            <span>${copy.register.legalBefore} <a href="/terms" data-link>${copy.register.terms}</a> ${copy.register.legalAnd} <a href="/privacy" data-link>${copy.register.privacy}</a>.</span>
          </label>
          ${renderAuthCaptcha({ action: 'signup', language })}
          <p class="form-status" data-form-status role="alert" hidden></p>
          <button class="button button-primary auth-submit" type="submit"${authCaptchaSubmitAttributes()}>${copy.signUp}</button>
        </form>
        <p class="auth-switch">${copy.register.haveAccount} <a class="text-link" href="${pathWithNext('/login', destination)}" data-link>${copy.signIn}</a></p>
      </div>
    </section>
  `;
}

export function bind({ authService, profileService, store, navigate }) {
  const language = getLanguage();
  const copy = getAuthCopy(language);
  const form = document.querySelector('[data-register-form]');
  const destination = destinationFromSearch(window.location.search, null);
  const onboardingDestination = pathWithNext('/onboarding', destination);
  const captchaController = bindAuthCaptcha(form, { action: 'signup', language });
  const submissionLock = createSubmissionLock();
  bindPasswordToggle(form, language);
  const passwordPolicy = bindPasswordRequirements(form, form.elements.password, copy);

  const restoreForm = () => {
    setSubmitting(form, false, copy.signUp, copy.processing);
    captchaController.reset();
    submissionLock.release();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!submissionLock.tryLock()) return;
    setFormStatus(form);
    passwordPolicy.validate();
    if (!form.reportValidity()) { submissionLock.release(); return; }
    const captcha = captchaController.takeToken();
    if (!captcha.ok) {
      setFormStatus(form, copy.captcha.required);
      submissionLock.release();
      return;
    }

    setSubmitting(form, true, copy.signUp, copy.processing);
    const values = new FormData(form);
    const { data, error } = await authService.signUp({
      displayName: values.get('displayName').trim(),
      email: values.get('email').trim(),
      password: values.get('password'),
      gameMode: values.get('gameMode'),
      next: destination,
      captchaToken: captcha.captchaToken,
    });

    if (error) {
      setFormStatus(form, error);
      restoreForm();
      return;
    }

    captchaController.reset();
    submissionLock.release();
    if (data?.session?.user) {
      await profileService.recordLegalAcceptance(data.session.user.id);
      const { profile } = await profileService.getProfile(data.session.user.id);
      store.setState({ session: data.session, profile });
      showToast(`${copy.accountCreated} ${copy.tribeReady}`);
      navigate(onboardingDestination);
      return;
    }

    if (!REQUIRE_EMAIL_CONFIRMATION) {
      const loginDestination = pathWithNext('/login', destination);
      navigate(`${loginDestination}${loginDestination.includes('?') ? '&' : '?'}registered=1`);
      return;
    }

    form.closest('.auth-card').innerHTML = `
      <div class="auth-success" role="status">
        <span class="success-mark">✓</span>
        <p class="section-kicker">${copy.register.confirmEyebrow}</p>
        <h1>${copy.register.confirmTitle}</h1>
        <p>${copy.register.confirmBody}</p>
        <a class="button button-secondary" href="${pathWithNext('/login', destination)}" data-link>${copy.signIn}</a>
      </div>
    `;
  };

  form.addEventListener('submit', onSubmit);
  return () => {
    form.removeEventListener('submit', onSubmit);
    passwordPolicy.destroy();
    captchaController.destroy();
  };
}
