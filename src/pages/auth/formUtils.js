import { getAuthCopy } from '../../config/auth.js';
import { getLanguage } from '../../i18n/index.js';
import { evaluatePassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_SYMBOLS } from '../../utils/passwordPolicy.js';

export function setFormStatus(form, message = '', tone = 'error') {
  const status = form.querySelector('[data-form-status]');
  if (!status) return;
  status.textContent = message;
  status.className = `form-status form-status-${tone}`;
  status.hidden = !message;
}

export function setSubmitting(form, submitting, label, processingLabel = getAuthCopy(getLanguage()).processing) {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  button.disabled = submitting;
  button.setAttribute('aria-disabled', String(submitting));
  button.textContent = submitting ? processingLabel : label;
  form.setAttribute('aria-busy', String(submitting));
}

export function bindPasswordToggle(container, language = getLanguage()) {
  if (!container) return;
  const copy = getAuthCopy(language);
  container.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = container.querySelector(`#${button.getAttribute('aria-controls')}`);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.textContent = showing ? copy.show : copy.hide;
      button.setAttribute('aria-pressed', String(!showing));
    });
  });
}

export function renderPasswordRequirements(copy, id) {
  const items = ['length', 'uppercase', 'lowercase', 'number', 'symbol'];
  return `<div class="password-requirements" id="${id}" data-password-requirements role="status" aria-live="polite" aria-atomic="true">
    <span>${copy.passwordRequirements.title}</span>
    <ul>${items.map((key) => `<li data-password-requirement="${key}" data-valid="false"><span aria-hidden="true">○</span>${copy.passwordRequirements[key]}</li>`).join('')}</ul>
    <small>${copy.passwordRequirements.allowedSymbols.replace('{symbols}', PASSWORD_SYMBOLS)}</small>
  </div>`;
}

export function bindPasswordRequirements(container, input, copy) {
  const list = container?.querySelector('[data-password-requirements]');
  if (!list || !input) return { validate: () => false, destroy() {} };
  input.minLength = PASSWORD_MIN_LENGTH;
  input.maxLength = PASSWORD_MAX_LENGTH;
  const update = () => {
    const result = evaluatePassword(input.value);
    if (result.valid) input.setCustomValidity('');
    Object.entries(result.requirements).forEach(([key, valid]) => {
      const item = list.querySelector(`[data-password-requirement="${key}"]`);
      if (!item) return;
      item.dataset.valid = String(valid);
      item.querySelector('[aria-hidden]')?.replaceChildren(document.createTextNode(valid ? '✓' : '○'));
    });
    list.dataset.valid = String(result.valid);
    return result.valid;
  };
  input.addEventListener('input', update);
  update();
  return {
    validate: () => {
      const valid = update();
      if (!valid) input.setCustomValidity(copy.passwordRequirements.invalid);
      else input.setCustomValidity('');
      return valid;
    },
    destroy() { input.removeEventListener('input', update); },
  };
}

export function configurationNotice(configured, language = getLanguage()) {
  if (configured) return '';
  const copy = getAuthCopy(language);
  return `
    <aside class="config-notice" role="note">
      <strong>${copy.configTitle}</strong>
      <p>${copy.configBody}</p>
    </aside>
  `;
}
