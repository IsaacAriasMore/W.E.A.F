import { getAuthCopy } from '../../config/auth.js';
import { getLanguage } from '../../i18n/index.js';

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
