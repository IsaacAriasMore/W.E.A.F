import { t } from '../i18n/index.js';

const fallbackCategories = [
  ['resources', 'Recursos', 'Resources'], ['creatures', 'Criaturas', 'Creatures'],
  ['equipment', 'Equipamiento', 'Equipment'], ['blueprints', 'Planos', 'Blueprints'],
  ['services', 'Servicios permitidos', 'Allowed services'], ['other', 'Otros', 'Other'],
].map(([slug, name_es, name_en]) => ({ id: slug, slug, name_es, name_en }));

const errorKeys = {
  authentication_required: 'authRequired', marketplace_rules_required: 'rulesRequired',
  marketplace_disabled: 'disabled', marketplace_active_limit: 'activeLimit',
  marketplace_rate_limit: 'rateLimit', invalid_marketplace_payload: 'invalidPayload',
  html_not_allowed: 'htmlNotAllowed', prohibited_marketplace_content: 'prohibited',
  listing_not_owned: 'notOwned', listing_not_editable: 'notEditable',
  listing_not_owned_or_hidden: 'notOwned', listing_not_available: 'notAvailable',
};

function friendly(error, fallbackKey) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  const code = Object.keys(errorKeys).find((candidate) => message?.includes(candidate));
  return t(`marketplace.errors.${code ? errorKeys[code] : fallbackKey}`);
}

export function createMarketplaceService(client) {
  return {
    async getCatalog(slug = null) {
      if (!client) return { data: { categories: fallbackCategories, listings: [] }, error: null };
      const { data, error } = await client.rpc('get_marketplace_catalog', { p_slug: slug });
      return { data: data || { categories: fallbackCategories, listings: [] }, error: friendly(error, 'load') };
    },
    async getSettings() {
      if (!client) return { data: { marketplace_enabled: true, featured_enabled: false, price_minor: null, currency: 'USD', environment: 'sandbox' }, error: null };
      const { data, error } = await client.rpc('get_marketplace_checkout_settings');
      return { data, error: friendly(error, 'load') };
    },
    async getMyWorkspace() {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.rpc('get_my_marketplace_workspace');
      return { data, error: friendly(error, 'loadAccount') };
    },
    async publishFree(payload, acceptRules) {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.rpc('create_free_marketplace_listing', { p_payload: payload, p_accept_rules: acceptRules });
      return { data, error: friendly(error, 'publish') };
    },
    async update(listingId, payload) {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.rpc('update_my_marketplace_listing', { p_listing_id: listingId, p_payload: payload });
      return { data, error: friendly(error, 'save') };
    },
    async hide(listingId) {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.rpc('hide_my_marketplace_listing', { p_listing_id: listingId });
      return { data, error: friendly(error, 'hide') };
    },
    async report(listingId, reason, details) {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.rpc('report_marketplace_listing', { p_listing_id: listingId, p_reason: reason, p_details: details });
      return { data, error: friendly(error, 'report') };
    },
  };
}
