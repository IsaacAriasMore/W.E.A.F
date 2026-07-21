export function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatRelativeTime(value, now = Date.now()) {
  if (!value) return 'Sin fecha';
  const difference = new Date(value).getTime() - now;
  const absolute = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (absolute < 60 * 60 * 1000) return formatter.format(Math.round(difference / 60000), 'minute');
  if (absolute < 24 * 60 * 60 * 1000) return formatter.format(Math.round(difference / 3600000), 'hour');
  return formatter.format(Math.round(difference / 86400000), 'day');
}
