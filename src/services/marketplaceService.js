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
  marketplace_payments_disabled: 'paymentsDisabled', marketplace_order_not_available: 'paymentStart',
  marketplace_payment_not_available: 'paymentCapture',
  marketplace_asa_only: 'asaOnly', invalid_marketplace_cursor: 'cursor',
  marketplace_cursor_expired: 'cursorExpired', marketplace_personalization_disabled: 'personalizationDisabled',
  marketplace_recommendation_rate_limit: 'recommendationRateLimit', marketplace_qa_access_required: 'qaRequired',
};

function friendly(error, fallbackKey) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  const code = Object.keys(errorKeys).find((candidate) => message?.includes(candidate));
  return t(`marketplace.errors.${code ? errorKeys[code] : fallbackKey}`);
}

export function createMarketplaceService(client) {
  return {
    async getCatalog(options = {}) {
      const input = typeof options === 'string' ? { slug: options } : options;
      if (!client) return { data: { categories: fallbackCategories, featured: [], listings: [], next_cursor: null }, error: null };
      const { data, error } = await client.rpc('get_marketplace_catalog_v2', {
        p_slug: input.slug || null, p_type: input.type || null, p_category: input.category || null,
        p_region: input.region || null, p_platform: input.platform || null, p_search: input.search || null,
        p_cursor: input.cursor || null, p_limit: input.limit || 12,
      });
      if (error?.code === 'PGRST202' || error?.message?.includes('get_marketplace_catalog_v2')) {
        const legacy = await client.rpc('get_marketplace_catalog', { p_slug: input.slug || null });
        const asa = (legacy.data?.listings || []).filter((listing) => listing.game === 'ascended');
        return {
          data: { categories: legacy.data?.categories || fallbackCategories, featured: asa.filter((listing) => listing.is_featured), listings: asa.filter((listing) => !listing.is_featured), next_cursor: null, personalization_enabled: false },
          error: friendly(legacy.error, 'load'),
        };
      }
      return { data: data || { categories: fallbackCategories, featured: [], listings: [], next_cursor: null }, error: friendly(error, 'load') };
    },
    async getSettings() {
      if (!client) return { data: { marketplace_enabled: true, featured_enabled: false, payments_enabled: false, price_minor: 300, currency: 'USD', environment: 'sandbox', qa_eligible: false }, error: null };
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
    async startFeaturedOrder(listingId, idempotencyKey) {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.functions.invoke('create-marketplace-paypal-order', {
        body: { listing_id: listingId, idempotency_key: idempotencyKey },
      });
      return { data, error: error ? t('marketplace.errors.paymentStart') : null };
    },
    async captureFeaturedOrder(paymentId) {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.functions.invoke('capture-marketplace-paypal-order', { body: { payment_id: paymentId } });
      return { data, error: error ? t('marketplace.errors.paymentCapture') : null };
    },
    async getRecommendationSettings() {
      if (!client) return { data: { personalization_enabled: false, authenticated: false }, error: null };
      const { data, error } = await client.rpc('get_marketplace_recommendation_settings');
      if (error?.code === 'PGRST202' || error?.message?.includes('get_marketplace_recommendation_settings')) return { data: { personalization_enabled: false, authenticated: true }, error: null };
      return { data, error: friendly(error, 'loadPreferences') };
    },
    async setPersonalization(enabled) {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.rpc('set_marketplace_personalization', { p_enabled: Boolean(enabled) });
      return { data, error: friendly(error, 'savePreferences') };
    },
    async resetRecommendations() {
      if (!client) return { data: null, error: t('marketplace.errors.disconnected') };
      const { data, error } = await client.rpc('reset_marketplace_recommendations');
      return { data, error: friendly(error, 'resetPreferences') };
    },
    async recordRecommendation(eventType, { listingId = null, context = {}, clientEventId = crypto.randomUUID() } = {}) {
      if (!client) return { data: false, error: null };
      const { data, error } = await client.rpc('record_marketplace_recommendation_event', {
        p_event_type: eventType, p_listing_id: listingId, p_context: context, p_client_event_id: clientEventId,
      });
      return { data, error: friendly(error, 'recommendation') };
    },
  };
}
