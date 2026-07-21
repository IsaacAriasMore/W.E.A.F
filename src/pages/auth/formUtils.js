export function setFormStatus(form, message = '', tone = 'error') {
  const status = form.querySelector('[data-form-status]');
  if (!status) return;
  status.textContent = message;
  status.className = `form-status form-status-${tone}`;
  status.hidden = !message;
}

export function setSubmitting(form, submitting, label) {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  button.disabled = submitting;
  button.textContent = submitting ? 'Procesando…' : label;
  form.setAttribute('aria-busy', String(submitting));
}

export function bindPasswordToggle(container) {
  container.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = container.querySelector(`#${button.getAttribute('aria-controls')}`);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.textContent = showing ? 'Mostrar' : 'Ocultar';
      button.setAttribute('aria-pressed', String(!showing));
    });
  });
}

export function configurationNotice(configured) {
  if (configured) return '';
  return `
    <aside class="config-notice" role="note">
      <strong>Conexión pendiente</strong>
      <p>La interfaz está lista. Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> para activar Auth.</p>
    </aside>
  `;
}
