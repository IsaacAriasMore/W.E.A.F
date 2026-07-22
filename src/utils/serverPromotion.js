const INACTIVE_STATUSES = new Set([
  'canceled', 'expired', 'paused', 'hidden', 'rejected', 'pending_payment', 'draft',
]);

function validDateBoundary(value, now, comparison) {
  if (!value) return true;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && comparison(time, now);
}

export function isPromotableServer(server, now = Date.now()) {
  if (!server || server.status !== 'active' || INACTIVE_STATUSES.has(server.status)) return false;
  if (server.cancel_at_period_end || ['failed', 'canceled', 'refunded', 'pending'].includes(server.payment_status)) return false;

  const paid = server.payment_status === 'paid'
    || (server.billing_source === 'manual' && ['not_required', 'paid'].includes(server.payment_status));
  const plus = server.is_featured === true || server.plan === 'plus' || server.plan_type === 'plus';
  if (!paid || !plus) return false;

  return validDateBoundary(server.starts_at, now, (time, current) => time <= current)
    && validDateBoundary(server.expires_at, now, (time, current) => time > current)
    && validDateBoundary(server.current_period_end, now, (time, current) => time > current);
}

export function promotableServers(servers, now = Date.now()) {
  return (Array.isArray(servers) ? servers : [])
    .filter((server) => isPromotableServer(server, now))
    .sort((left, right) => Number(right.is_featured) - Number(left.is_featured)
      || new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
}
