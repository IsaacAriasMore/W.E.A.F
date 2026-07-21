export function showToast(message, tone = 'success') {
  const region = document.querySelector('.toast-region');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  region.append(toast);

  window.setTimeout(() => {
    toast.classList.add('toast-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, 2800);
}
