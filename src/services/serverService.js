const messages = {
  listing_not_available: 'Este servidor ya no está disponible.',
  invalid_server_event: 'No pudimos registrar esa interacción.',
  tracking_not_configured: 'La analítica del directorio todavía no está configurada.',
  listing_slug_taken: 'Ese slug ya está ocupado.',
  invalid_listing_payload: 'Revisa los datos de la publicación.',
  plan_change_requires_portal: 'Gestiona el cambio de plan desde facturación.',
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
        .select('id,title,slug,plan,game,server_type,platforms,has_mods,mods,maps,rates,region,language,description,discord_invite_url,website_url,banner_url,is_featured,is_verified,created_at,wipe_date,cluster_name,uses_propagators,click_count')
        .eq('status', 'active')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      return { data: data || [], error: friendly(error, 'No pudimos cargar el directorio de servidores.') };
    },
    async listPlans() {
      if (!client) return { data: [], error: null };
      const { data, error } = await client
        .from('plans')
        .select('code,name,price_usd_cents,features,is_active')
        .in('code', ['normal', 'plus'])
        .order('price_usd_cents');
      return { data: data || [], error: friendly(error, 'No pudimos cargar los planes.') };
    },
    async track(listingId, eventType) {
      if (!client) return { data: null, error: null };
      const { data, error } = await client.functions.invoke('track-server-event', {
        body: { listingId, eventType },
      });
      return { data, error: friendly(error, 'No pudimos registrar la interacción.') };
    },
    async startCheckout(serverListingId, planType) {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.functions.invoke('create-server-listing-checkout', {
        body: { server_listing_id: serverListingId, plan_type: planType },
      });
      const code = data?.error || error?.message || '';
      const paymentError = code.includes('payments_not_configured')
        ? 'Stripe todavía necesita sus claves privadas en Supabase.'
        : code.includes('billing_disabled') ? 'La facturación está desactivada temporalmente.'
          : code.includes('listing_already_active') ? 'Esta publicación ya tiene una suscripción activa.'
        : code.includes('checkout_rate_limit') ? 'Espera dos minutos antes de iniciar otro pago.' : 'No pudimos iniciar el checkout.';
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
      const { data, error } = await client.rpc('save_server_listing_draft', {
        p_listing_id: listingId || null,
        p_plan_type: planType,
        p_payload: payload,
      });
      return { data, error: friendly(error, 'No pudimos guardar la publicación.') };
    },
    async openBillingPortal() {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.functions.invoke('create-billing-portal-session', { body: {} });
      const message = data?.message || (data?.error === 'billing_customer_not_found'
        ? 'Todavía no tienes una cuenta de facturación en Stripe.'
        : 'No pudimos abrir el portal de facturación.');
      return { data, error: error || data?.error ? message : null };
    },
    async updateListing(listingId, payload) {
      if (!client) return { data: null, error: 'Supabase no está conectado.' };
      const { data, error } = await client.rpc('update_paid_server_listing', { p_listing_id: listingId, p_payload: payload });
      return { data, error: friendly(error, error?.message?.includes('listing_slug_taken') ? 'Ese slug ya está ocupado.' : 'No pudimos guardar los cambios.') };
    },
  };
}
