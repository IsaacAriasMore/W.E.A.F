import { promotableServers } from '../utils/serverPromotion.js';

const messages = {
  listing_not_available: 'Este servidor ya no está disponible.',
  invalid_server_event: 'No pudimos registrar esa interacción.',
  tracking_not_configured: 'La analítica del directorio todavía no está configurada.',
  listing_slug_taken: 'Ese slug ya está ocupado.',
  invalid_listing_payload: 'Revisa los datos de la publicación.',
  plan_change_requires_portal: 'Gestiona el cambio de plan desde facturación.',
  listing_already_subscribed: 'Esta publicación ya tiene una suscripción en curso.',
  offer_not_available: 'Esta oferta ya no está disponible.',
  new_customers_only: 'Esta oferta está reservada para clientes nuevos.',
  paypal_plan_not_synced: 'Este plan todavía no está sincronizado con PayPal.',
};

function friendly(error, fallback) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  const key = Object.keys(messages).find((candidate) => message?.includes(candidate));
  return key ? messages[key] : fallback;
}

export function createServerService(client) {
  return {
    async listPublic() {
      if (!client) return { data: [], error: 'Supabase no está conectado.' };
      const { data, error } = await client
        .from('server_listings')
        .select('id,title,slug,plan,plan_type,status,game,server_type,platforms,has_mods,maps,rates,region,language,description,discord_invite_url,website_url,banner_url,is_featured,is_verified,starts_at,expires_at,current_period_end,cancel_at_period_end,created_at,wipe_date,cluster_name,uses_propagators,click_count,billing_source,payment_status')
        .eq('status', 'active')
        .or('payment_status.eq.paid,and(billing_source.eq.manual,payment_status.eq.not_required)')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      return { data: data || [], error: friendly(error, 'No pudimos cargar el directorio de servidores.') };
    },
    async listPromotable() {
      const result = await this.listPublic();
      return { ...result, data: promotableServers(result.data) };
    },
    async listPlans() {
      if (!client) return { data: [], error: null };
      const { data, error } = await client.rpc('get_public_billing_catalog');
      return { data: [...(data?.plans || []), ...(data?.offers || [])], catalog: data || { plans: [], offers: [] }, error: friendly(error, 'No pudimos cargar los planes.') };
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
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.functions.invoke('create-paypal-subscription', {
        body: { server_listing_id: serverListingId, plan_version_id: planVersionId, idempotency_key: idempotencyKey },
      });
      const code = data?.error || error?.message || '';
      const paymentError = code.includes('paypal_not_configured') || code.includes('billing_not_configured')
        ? 'PayPal Sandbox todavía necesita configuración privada en Supabase.'
        : code.includes('billing_disabled') ? 'La facturación está desactivada temporalmente.'
          : friendly({ message: code }, 'No pudimos iniciar la suscripción con PayPal.');
      return { data, error: error || data?.error ? paymentError : null };
    },
    async getMyBilling() {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.rpc('get_my_server_billing');
      return { data, error: friendly(error, 'No pudimos cargar tus publicaciones.') };
    },
    async createListing(subscriptionId, payload) {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.rpc('create_paid_server_listing', { p_subscription_id: subscriptionId, p_payload: payload });
      return { data, error: friendly(error, error?.message?.includes('listing_slug_taken') ? 'Ese slug ya está ocupado.' : 'No pudimos publicar el servidor.') };
    },
    async saveListingDraft(listingId, planType, payload) {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.rpc('save_paypal_server_listing_draft', {
        p_listing_id: listingId || null,
        p_plan_type: planType,
        p_payload: payload,
      });
      return { data, error: friendly(error, 'No pudimos guardar la publicación.') };
    },
    async cancelSubscription(subscriptionId, reason) {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.functions.invoke('cancel-paypal-subscription', {
        body: { subscription_id: subscriptionId, reason, confirm: true },
      });
      return { data, error: error || data?.error ? (data?.error === 'subscription_not_owned' ? 'No puedes cancelar una suscripción ajena.' : 'No pudimos cancelar la suscripción.') : null };
    },
    async updateListing(listingId, payload) {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.rpc('update_paid_server_listing', { p_listing_id: listingId, p_payload: payload });
      return { data, error: friendly(error, error?.message?.includes('listing_slug_taken') ? 'Ese slug ya está ocupado.' : 'No pudimos guardar los cambios.') };
    },
  };
}
