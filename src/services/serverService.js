import { REAL_PAYPAL_BILLING } from '../config/billing.js';
import { t } from '../i18n/index.js';
import { promotableServers } from '../utils/serverPromotion.js';
import { friendlyEdgeFunctionError } from '../utils/edgeFunctionErrors.js';

const messageKeys = {
  listing_not_available: 'listingNotAvailable',
  invalid_server_event: 'invalidServerEvent',
  tracking_not_configured: 'trackingNotConfigured',
  listing_slug_taken: 'listingSlugTaken',
  invalid_listing_payload: 'invalidListingPayload',
  plan_change_requires_portal: 'planChangeRequiresPortal',
  listing_already_subscribed: 'listingAlreadySubscribed',
  offer_not_available: 'offerNotAvailable',
  new_customers_only: 'newCustomersOnly',
  paypal_plan_not_synced: 'paypalPlanNotSynced',
  authentication_required: 'authenticationRequired',
  listing_not_owned: 'listingNotOwned',
  subscription_not_available: 'subscriptionNotAvailable',
  subscription_already_created: 'subscriptionAlreadyCreated',
  invalid_subscription_request: 'invalidSubscriptionRequest',
  paypal_approval_url_missing: 'paypalApprovalUrlMissing',
  paypal_subscription_failed: 'paypalSubscriptionFailed',
  subscription_reconciliation_failed: 'subscriptionReconciliationFailed',
  subscription_not_owned: 'subscriptionNotOwned',
  paypal_cancellation_failed: 'paypalCancellationFailed',
  cancellation_reconciliation_failed: 'cancellationReconciliationFailed',
};

const translatedMessages = () => Object.fromEntries(
  Object.entries(messageKeys).map(([code, key]) => [code, t(`servers.errors.${key}`)]),
);

const disconnected = (data = null) => ({ data, error: t('servers.errors.disconnected') });

function normalizeLegacyPlan(plan) {
  return {
    id: plan.code,
    code: plan.code,
    name: plan.name,
    description: '',
    tier: plan.code,
    features: plan.features || [],
    plan_version_id: null,
    currency: 'USD',
    price_minor: Number(plan.price_usd_cents || 0),
    base_price_minor: Number(plan.price_usd_cents || 0),
    frequency_unit: 'MONTH',
    interval_count: 1,
    total_cycles: null,
    benefit_cycles: null,
    auto_renew: true,
    end_behavior: 'same_price',
    offer_id: null,
    offer_name: null,
    acquisition_ends_at: null,
  };
}

const fallbackPlans = () => [
  { code: 'normal', name: 'Normal', price_usd_cents: 300, features: [] },
  { code: 'plus', name: 'Plus', price_usd_cents: 700, features: [] },
].map(normalizeLegacyPlan);

async function listBillingPlans(client) {
  if (!client) {
    const plans = fallbackPlans();
    return { data: plans, catalog: { plans, offers: [] }, enabled: false, error: null };
  }

  if (!REAL_PAYPAL_BILLING) {
    const { data, error } = await client
      .from('plans')
      .select('code,name,price_usd_cents,features,is_active')
      .in('code', ['normal', 'plus'])
      .eq('is_active', true)
      .order('price_usd_cents', { ascending: true });
    const plans = (data || []).map(normalizeLegacyPlan);
    return {
      data: plans,
      catalog: { plans, offers: [] },
      enabled: false,
      error: friendly(error, 'loadPlans'),
    };
  }

  const [catalogResult, statusResult] = await Promise.all([
    client.rpc('get_public_billing_catalog'),
    client.rpc('get_paypal_checkout_status'),
  ]);
  const catalog = catalogResult.data || { plans: [], offers: [] };
  return {
    data: [...(catalog.plans || []), ...(catalog.offers || [])],
    catalog,
    enabled: !statusResult.error && statusResult.data === true,
    error: friendly(catalogResult.error || statusResult.error, 'loadPlans'),
  };
}

function friendly(error, fallbackKey) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  const code = Object.keys(messageKeys).find((candidate) => message?.includes(candidate));
  return code ? t(`servers.errors.${messageKeys[code]}`) : t(`servers.errors.${fallbackKey}`);
}

export function createServerService(client) {
  return {
    async listPublic() {
      if (!client) return { data: [], error: t('servers.errors.disconnected') };
      const { data, error } = await client
        .from('server_listings')
        .select('id,title,slug,plan,plan_type,status,game,server_type,platforms,has_mods,maps,rates,region,language,description,discord_invite_url,website_url,banner_url,is_featured,is_verified,starts_at,expires_at,current_period_end,cancel_at_period_end,created_at,wipe_date,cluster_name,uses_propagators,click_count,billing_source,payment_status')
        .eq('status', 'active')
        .or('payment_status.eq.paid,and(billing_source.eq.manual,payment_status.eq.not_required)')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      return { data: data || [], error: friendly(error, 'loadDirectory') };
    },
    async listPromotable() {
      const result = await this.listPublic();
      return { ...result, data: promotableServers(result.data) };
    },
    async listPlans() {
      return listBillingPlans(client);
    },
    async track(listingId, eventType) {
      if (!client) return { data: null, error: null };
      try {
        const { data, error } = await client.functions.invoke('track-server-event', {
          body: { listingId, eventType },
        });
        if (error) {
          if (import.meta.env?.DEV) console.warn('[W.E.A.F] Tracking no crítico omitido.', error.message);
          return { data: null, error: null };
        }
        return { data, error: null };
      } catch (error) {
        if (import.meta.env?.DEV) console.warn('[W.E.A.F] Tracking no crítico omitido.', error?.message);
        return { data: null, error: null };
      }
    },
    async startSubscription(serverListingId, planVersionId, idempotencyKey) {
      if (!client) return disconnected();
      const { data, error } = await client.functions.invoke('create-paypal-subscription', {
        body: {
          server_listing_id: serverListingId,
          plan_version_id: planVersionId,
          idempotency_key: idempotencyKey,
        },
      });
      return {
        data,
        error: await friendlyEdgeFunctionError(
          error,
          data,
          translatedMessages(),
          t('servers.errors.startSubscription'),
        ),
      };
    },
    async getMyBilling() {
      if (!client) return disconnected();
      const { data, error } = await client.rpc('get_my_server_billing');
      return { data, error: friendly(error, 'loadListings') };
    },
    async createListing(subscriptionId, payload) {
      if (!client) return disconnected();
      const { data, error } = await client.rpc('create_paid_server_listing', { p_subscription_id: subscriptionId, p_payload: payload });
      return { data, error: friendly(error, 'publishListing') };
    },
    async saveListingDraft(listingId, planType, payload) {
      if (!client) return disconnected();
      const rpcName = REAL_PAYPAL_BILLING
        ? 'save_paypal_server_listing_draft'
        : 'save_server_listing_draft';
      const { data, error } = await client.rpc(rpcName, {
        p_listing_id: listingId || null,
        p_plan_type: planType,
        p_payload: payload,
      });
      return { data, error: friendly(error, 'saveListing') };
    },
    async cancelSubscription(subscriptionId, reason) {
      if (!client) return disconnected();
      const { data, error } = await client.functions.invoke('cancel-paypal-subscription', {
        body: { subscription_id: subscriptionId, reason, confirm: true },
      });
      return {
        data,
        error: await friendlyEdgeFunctionError(
          error,
          data,
          translatedMessages(),
          t('servers.errors.cancelSubscription'),
        ),
      };
    },
    async updateListing(listingId, payload) {
      if (!client) return disconnected();
      const { data, error } = await client.rpc('update_paid_server_listing', { p_listing_id: listingId, p_payload: payload });
      return { data, error: friendly(error, 'saveChanges') };
    },
  };
}
