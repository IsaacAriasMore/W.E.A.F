export const MARKETPLACE_DURATION_DAYS = 7;

export function marketplaceTimeLeft(expiresAt, now = Date.now()) {
  const remaining = new Date(expiresAt).getTime() - Number(now);
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return Math.ceil(remaining / 86_400_000);
}

export function marketplacePayload(formData) {
  const value = (key) => String(formData.get(key) || '').trim();
  return {
    category_id: value('category_id'), listing_type: value('listing_type'), title: value('title'),
    description: value('description'), game: 'ascended', resource_name: value('resource_name'),
    quantity: value('quantity') || null, trade_terms: value('trade_terms'), server_name: value('server_name') || null,
    region: value('region'), platform: value('platform'), language: value('language'),
    discord_invite_url: value('discord_invite_url'), image_url: value('image_url') || null,
  };
}

export function hasUnsafeMarketplaceText(payload) {
  const text = [payload.title, payload.description, payload.trade_terms].join(' ');
  return /<[a-z!/]|password|contraseña|token|secret|cookie|cuenta robada|stolen account|cheat|exploit/i.test(text);
}
