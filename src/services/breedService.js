const breedErrors = {
  authentication_required: 'Tu sesión ya no es válida.',
  not_authorized: 'Tu rol no permite realizar esta acción.',
  owner_required: 'Solo el propietario puede cambiar esta configuración.',
  invalid_propagator_cooldown: 'El cooldown debe estar entre 0.25 y 720 horas.',
  invalid_breeding_multiplier: 'El multiplicador debe estar entre 0.001 y 1000.',
  invalid_breed_title: 'El título debe tener entre 2 y 120 caracteres.',
  invalid_breed_stats: 'Revisa los stats de esta línea.',
  invalid_breed_data: 'Revisa los datos de esta línea.',
  invalid_mutation_stats: 'Registra al menos un stat con un valor válido.',
  invalid_notes: 'Las notas superan el límite permitido.',
  breed_not_found: 'La línea de breeding no existe en esta tribu.',
  species_not_available: 'Esa especie no está disponible para el juego de la tribu.',
  invalid_discord_webhook: 'La URL no corresponde con un webhook válido de Discord.',
  webhook_not_configured: 'La tribu todavía no tiene un webhook activo.',
  discord_rate_limit: 'Se alcanzó el límite temporal de avisos a Discord.',
};

function friendly(error, fallback = 'No pudimos completar la acción.') {
  if (!error) return null;
  const match = Object.keys(breedErrors).find((key) => error.message?.includes(key));
  return match ? breedErrors[match] : fallback;
}

export function createBreedService(client) {
  const unavailable = { data: null, error: 'Supabase no está conectado.' };

  return {
    async getSettings(tribeId) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('get_tribe_breeding_settings', { p_tribe_id: tribeId });
      return { data, error: friendly(error, 'No pudimos cargar la configuración de breeding.') };
    },

    async listSpecies(gameMode) {
      if (!client) return unavailable;
      let query = client
        .from('species')
        .select('id, name, slug, game_availability, image_url, category, vanilla_mating_cooldown_hours, stats')
        .eq('is_public', true)
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (gameMode !== 'both') query = query.in('game_availability', [gameMode, 'both']);
      const { data, error } = await query;
      return { data: data || [], error: friendly(error, 'No pudimos cargar las especies.') };
    },

    async listBreeds(tribeId) {
      if (!client) return unavailable;
      const { data, error } = await client
        .from('breeds')
        .select('id, tribe_id, title, status, target_stats, current_mutations, notes, created_at, updated_at, species:species!inner(id, name, slug, image_url, category, vanilla_mating_cooldown_hours)')
        .eq('tribe_id', tribeId)
        .order('updated_at', { ascending: false });
      return { data: data || [], error: friendly(error, 'No pudimos cargar las líneas de breeding.') };
    },

    async listMutations(tribeId) {
      if (!client) return unavailable;
      const { data, error } = await client
        .from('mutations')
        .select('id, tribe_id, stats, notes, created_at, breed:breeds!inner(id, title), species:species!inner(id, name, slug)')
        .eq('tribe_id', tribeId)
        .order('created_at', { ascending: false })
        .limit(60);
      return { data: data || [], error: friendly(error, 'No pudimos cargar las mutaciones.') };
    },

    async listAlerts(tribeId) {
      if (!client) return unavailable;
      const { data, error } = await client
        .from('propagator_alerts')
        .select('id, tribe_id, available_at, sent_at, status, breed:breeds!inner(id, title, species:species!inner(id, name, slug))')
        .eq('tribe_id', tribeId)
        .eq('status', 'scheduled')
        .order('available_at', { ascending: true })
        .limit(40);
      return { data: data || [], error: friendly(error, 'No pudimos cargar los cooldowns.') };
    },

    async createBreed({ tribeId, speciesId, title, targetStats, notes }) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('create_breed', {
        p_tribe_id: tribeId,
        p_species_id: speciesId,
        p_title: title,
        p_target_stats: targetStats,
        p_current_mutations: {},
        p_notes: notes || null,
      });
      return { data, error: friendly(error) };
    },

    async updateBreed({ breedId, title, status, targetStats, notes }) {
      if (!client) return unavailable;
      const { error } = await client.rpc('update_breed', {
        p_breed_id: breedId,
        p_title: title,
        p_status: status,
        p_target_stats: targetStats,
        p_notes: notes || null,
      });
      return { error: friendly(error) };
    },

    async deleteBreed(breedId) {
      if (!client) return unavailable;
      const { error } = await client.rpc('delete_breed', { p_breed_id: breedId });
      return { error: friendly(error) };
    },

    async registerMutation({ tribeId, breedId, stats, notes }) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('register_breed_mutation', {
        p_tribe_id: tribeId,
        p_breed_id: breedId,
        p_stats: stats,
        p_notes: notes || null,
      });
      return { data, error: friendly(error) };
    },

    async cancelAlert(alertId) {
      if (!client) return unavailable;
      const { error } = await client.rpc('cancel_propagator_alert', { p_alert_id: alertId });
      return { error: friendly(error) };
    },

    async configureBreeding({ tribeId, usesPropagators, cooldownHours, breedingMultiplier }) {
      if (!client) return unavailable;
      const { error } = await client.rpc('configure_tribe_breeding', {
        p_tribe_id: tribeId,
        p_uses_propagators: usesPropagators,
        p_cooldown_hours: usesPropagators ? Number(cooldownHours) : null,
        p_breeding_multiplier: usesPropagators ? null : Number(breedingMultiplier),
      });
      return { error: friendly(error) };
    },

    async configureWebhook({ tribeId, webhookUrl, enabled = true }) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('configure_tribe_discord_webhook', {
        p_tribe_id: tribeId,
        p_webhook_url: webhookUrl,
        p_enabled: enabled,
      });
      return { data, error: friendly(error) };
    },

    async setWebhookEnabled(tribeId, enabled) {
      if (!client) return unavailable;
      const { error } = await client.rpc('set_tribe_discord_enabled', {
        p_tribe_id: tribeId,
        p_enabled: enabled,
      });
      return { error: friendly(error) };
    },

    async notifyDiscord({ tribeId, eventType, entityId }) {
      if (!client) return unavailable;
      const { data, error } = await client.functions.invoke('notify-discord-tribe', {
        body: { tribeId, eventType, entityId },
      });
      const functionCode = data?.error;
      return { data, error: error ? friendly({ message: functionCode || error.message }, 'El registro se guardó, pero Discord no respondió.') : null };
    },

    async getDashboardSummary(tribeId) {
      if (!client) return unavailable;
      const now = new Date().toISOString();
      const [active, mutations, alerts] = await Promise.all([
        client.from('breeds').select('id, title, status, species:species!inner(name)', { count: 'exact' })
          .eq('tribe_id', tribeId).eq('status', 'active').order('updated_at', { ascending: false }).limit(3),
        client.from('mutations').select('id, stats, created_at, breed:breeds!inner(title), species:species!inner(name)')
          .eq('tribe_id', tribeId).order('created_at', { ascending: false }).limit(3),
        client.from('propagator_alerts').select('id, available_at, breed:breeds!inner(title, species:species!inner(name))')
          .eq('tribe_id', tribeId).eq('status', 'scheduled').gte('available_at', now)
          .order('available_at', { ascending: true }).limit(3),
      ]);
      const error = active.error || mutations.error || alerts.error;
      return {
        data: {
          activeCount: active.count || 0,
          activeBreeds: active.data || [],
          mutations: mutations.data || [],
          alerts: alerts.data || [],
        },
        error: friendly(error, 'No pudimos cargar el resumen de breeding.'),
      };
    },
  };
}
