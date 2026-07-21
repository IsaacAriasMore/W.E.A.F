const messages = {
  listing_not_available: 'Este servidor ya no está disponible.',
  invalid_server_event: 'No pudimos registrar esa interacción.',
  tracking_not_configured: 'La analítica del directorio todavía no está configurada.',
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
        .select('id,title,slug,game,server_type,platforms,has_mods,mods,maps,rates,region,language,description,discord_invite_url,website_url,banner_url,is_featured,is_verified,created_at,wipe_date,cluster_name,uses_propagators,click_count')
        .eq('status', 'active')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      return { data: data || [], error: friendly(error, 'No pudimos cargar el directorio de servidores.') };
    },
    async listPlans() {
      if (!client) return { data: [], error: null };
      const { data, error } = await client
        .from('server_listing_plans')
        .select('code,name,description,price_usd_cents,features,is_active')
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
  };
}
