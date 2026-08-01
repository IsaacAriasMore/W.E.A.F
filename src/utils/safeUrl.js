const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  const match = host.match(IPV4);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value > 255)) return true;
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

export function parseSafeHttpsUrl(value, { allowedHosts = null, maxLength = 500 } = {}) {
  if (typeof value !== 'string' || !value || value.length > maxLength || CONTROL_CHARACTERS.test(value)) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null;
  const hostname = url.hostname.toLowerCase();
  if (isPrivateHostname(hostname)) return null;
  if (allowedHosts && !allowedHosts.includes(hostname)) return null;
  return url;
}

export function safeImageUrl(value) {
  const url = parseSafeHttpsUrl(value);
  return url?.href || null;
}

export function safeDiscordInviteUrl(value) {
  const url = parseSafeHttpsUrl(value, { allowedHosts: ['discord.gg', 'discord.com'], maxLength: 240 });
  if (!url) return null;
  const validPath = url.hostname === 'discord.gg'
    ? /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    : /^\/invite\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  return validPath && !url.search && !url.hash ? url.href : null;
}

export function trustedPayPalSandboxApprovalUrl(value) {
  const url = parseSafeHttpsUrl(value, {
    allowedHosts: ['sandbox.paypal.com', 'www.sandbox.paypal.com'],
    maxLength: 2048,
  });
  return url?.href || null;
}
