import { LEGAL_VERSION } from '../config/legal.js';

function databaseError(error) {
  if (!error) return null;
  return 'No pudimos guardar tu perfil. Conserva esta pantalla e inténtalo de nuevo.';
}

export function createProfileService(client) {
  return {
    async getProfile(userId) {
      if (!client || !userId) return { profile: null, error: null };
      const { data, error } = await client
        .from('profiles')
        .select('id, email, display_name, avatar_url, discord_username, default_game_mode, global_role, onboarding_completed, is_suspended, created_at')
        .eq('id', userId)
        .maybeSingle();
      return { profile: data, error: databaseError(error) };
    },

    async updateProfile(userId, { displayName, discordUsername, avatarUrl, gameMode }) {
      if (!client || !userId) return { profile: null, error: databaseError(new Error('Not configured')) };
      const { data, error } = await client
        .from('profiles')
        .update({
          display_name: displayName,
          discord_username: discordUsername || null,
          avatar_url: avatarUrl || null,
          default_game_mode: gameMode,
        })
        .eq('id', userId)
        .select('id, email, display_name, avatar_url, discord_username, default_game_mode, global_role, onboarding_completed, is_suspended, created_at')
        .single();
      return { profile: data, error: databaseError(error) };
    },

    async completeOnboarding(userId, { displayName, gameMode }) {
      if (!client || !userId) return { profile: null, error: databaseError(new Error('Not configured')) };
      const { data, error } = await client
        .from('profiles')
        .update({
          display_name: displayName,
          default_game_mode: gameMode,
          onboarding_completed: true,
        })
        .eq('id', userId)
        .select('id, display_name, avatar_url, discord_username, default_game_mode, global_role, onboarding_completed, is_suspended')
        .single();
      return { profile: data, error: databaseError(error) };
    },

    async recordLegalAcceptance(userId) {
      if (!client || !userId) return { error: databaseError(new Error('Not configured')) };
      const { error } = await client.from('legal_acceptances').upsert({
        user_id: userId,
        terms_version: LEGAL_VERSION,
        privacy_version: LEGAL_VERSION,
        user_agent: navigator.userAgent.slice(0, 500),
      }, { onConflict: 'user_id,terms_version,privacy_version', ignoreDuplicates: true });
      return { error: databaseError(error) };
    },
  };
}
