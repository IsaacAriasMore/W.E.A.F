const tribeErrors = {
  authentication_required: 'Tu sesión ya no es válida. Vuelve a ingresar.',
  invalid_tribe_name: 'El nombre de la tribu debe tener entre 2 y 80 caracteres.',
  invalid_character_name: 'El nombre del personaje debe tener entre 2 y 80 caracteres.',
  invalid_steam_id: 'El Steam ID no tiene un formato válido.',
  tribe_creation_rate_limit: 'Alcanzaste el límite temporal de creación de tribus.',
  not_authorized: 'Tu rol no permite realizar esta acción.',
  invite_requires_one_target: 'Indica un correo o un Steam ID para la invitación.',
  owner_role_forbidden: 'La propiedad de la tribu no puede enviarse por invitación.',
  owner_required_for_admin_invite: 'Solo el propietario puede invitar administradores.',
  invalid_invite_expiration: 'La invitación debe durar entre 1 y 168 horas.',
  invite_rate_limit: 'Alcanzaste el límite de invitaciones por hora.',
  invite_invalid_or_expired: 'La invitación no existe, ya fue usada o expiró.',
  invite_target_mismatch: 'La invitación no corresponde con tu correo o Steam ID.',
  already_a_member: 'Ya perteneces a esta tribu.',
  owner_required: 'Solo el propietario puede cambiar roles.',
  member_not_found_or_protected: 'Ese miembro no existe o está protegido.',
  not_authorized_or_protected_member: 'No puedes expulsar a ese miembro.',
  owner_cannot_leave_or_membership_missing: 'El propietario no puede abandonar la tribu.',
};

function friendlyError(error, fallback = 'No pudimos completar la acción. Inténtalo de nuevo.') {
  if (!error) return null;
  const match = Object.keys(tribeErrors).find((key) => error.message?.includes(key));
  return match ? tribeErrors[match] : fallback;
}

export function createTribeService(client) {
  const unavailable = { data: null, error: 'Supabase no está conectado.' };

  return {
    async listMemberships(userId) {
      if (!client) return unavailable;
      const { data, error } = await client
        .from('tribe_members')
        .select(`
          id, tribe_id, role, character_name, steam_id, joined_at,
          tribe:tribes!inner(id, name, slug, game_mode, uses_propagators, is_active)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true });
      return { data: data || [], error: friendlyError(error, 'No pudimos cargar tus tribus.') };
    },

    async getMembers(tribeId) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('get_tribe_members', { p_tribe_id: tribeId });
      return { data: data || [], error: friendlyError(error, 'No pudimos cargar los miembros.') };
    },

    async getInvites(tribeId) {
      if (!client) return unavailable;
      const { data, error } = await client
        .from('tribe_invites')
        .select('id, invited_email, invited_steam_id, role, status, expires_at, created_at')
        .eq('tribe_id', tribeId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(8);
      return { data: data || [], error: friendlyError(error, 'No pudimos cargar las invitaciones.') };
    },

    async createTribe({ name, gameMode, characterName, steamId }) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('create_tribe', {
        p_name: name,
        p_game_mode: gameMode,
        p_character_name: characterName,
        p_steam_id: steamId || null,
      });
      return { data, error: friendlyError(error) };
    },

    async createInvite({ tribeId, targetType, target, role, expiresHours }) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('create_tribe_invite', {
        p_tribe_id: tribeId,
        p_invited_email: targetType === 'email' ? target : null,
        p_invited_steam_id: targetType === 'steam' ? target : null,
        p_role: role,
        p_expires_hours: Number(expiresHours),
      });
      return { data, error: friendlyError(error) };
    },

    async acceptInvite({ token, characterName, steamId }) {
      if (!client) return unavailable;
      const { data, error } = await client.rpc('accept_tribe_invite', {
        p_token: token,
        p_character_name: characterName,
        p_steam_id: steamId || null,
      });
      return { data, error: friendlyError(error) };
    },

    async changeMemberRole({ tribeId, userId, role }) {
      if (!client) return unavailable;
      const { error } = await client.rpc('change_tribe_member_role', {
        p_tribe_id: tribeId,
        p_target_user_id: userId,
        p_role: role,
      });
      return { error: friendlyError(error) };
    },

    async removeMember({ tribeId, userId }) {
      if (!client) return unavailable;
      const { error } = await client.rpc('remove_tribe_member', {
        p_tribe_id: tribeId,
        p_target_user_id: userId,
      });
      return { error: friendlyError(error) };
    },

    async leaveTribe(tribeId) {
      if (!client) return unavailable;
      const { error } = await client.rpc('leave_tribe', { p_tribe_id: tribeId });
      return { error: friendlyError(error) };
    },
  };
}
