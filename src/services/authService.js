import { getSupabaseClient } from '../config/supabase.js';
import { LEGAL_VERSION } from '../config/legal.js';
import { pathWithNext, safeInternalDestination } from '../utils/navigation.js';
import { REQUIRE_EMAIL_CONFIRMATION } from '../config/auth.js';

const authErrorMessages = {
  invalid_credentials: 'El correo o la contraseña no coinciden.',
  email_not_confirmed: REQUIRE_EMAIL_CONFIRMATION
    ? 'Confirma tu correo antes de ingresar.'
    : 'Supabase todavía exige confirmar el correo. Desactiva “Confirm email” para permitir el acceso directo.',
  user_already_exists: 'Ya existe una cuenta con este correo.',
  signup_disabled: 'El registro está deshabilitado temporalmente.',
  weak_password: 'Usa una contraseña más segura.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a probar.',
};

function friendlyAuthError(error) {
  if (!error) return null;
  return authErrorMessages[error.code]
    || (error.status === 429 ? authErrorMessages.over_request_rate_limit : null)
    || 'No pudimos completar la solicitud. Revisa tus datos e inténtalo de nuevo.';
}

export function createAuthService(client = getSupabaseClient()) {
  const unavailable = () => ({
    data: null,
    error: 'Supabase aún no está conectado. Agrega las variables públicas del proyecto para habilitar el acceso.',
  });

  return {
    isConfigured: () => Boolean(client),
    getClient: () => client,

    async getSession() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      return error ? null : data.session;
    },

    async signUp({ email, password, displayName, gameMode, next = null }) {
      if (!client) return unavailable();
      const redirectBase = (import.meta.env?.VITE_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '');
      const onboardingPath = pathWithNext('/onboarding', safeInternalDestination(next, null));
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectBase}${onboardingPath}`,
          data: {
            display_name: displayName,
            default_game_mode: gameMode,
            terms_version: LEGAL_VERSION,
            privacy_version: LEGAL_VERSION,
          },
        },
      });
      return { data, error: friendlyAuthError(error) };
    },

    async signIn({ email, password }) {
      if (!client) return unavailable();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (!error && REQUIRE_EMAIL_CONFIRMATION && data?.user && !data.user.email_confirmed_at) {
        await client.auth.signOut({ scope: 'local' });
        return { data: null, error: authErrorMessages.email_not_confirmed };
      }
      return { data, error: friendlyAuthError(error) };
    },

    async requestPasswordReset(email) {
      if (!client) return unavailable();
      const redirectBase = (import.meta.env?.VITE_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '');
      const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectBase}/reset-password`,
      });
      return {
        data,
        error: error ? 'No se pudo enviar el correo de recuperación. Inténtalo más tarde.' : null,
      };
    },

    async updatePassword(password) {
      if (!client) return unavailable();
      const { data, error } = await client.auth.updateUser({ password });
      return {
        data,
        error: error ? 'No pudimos actualizar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.' : null,
      };
    },

    async signOut({ localOnly = false } = {}) {
      if (!client) return { error: null };
      const { error } = await client.auth.signOut(localOnly ? { scope: 'local' } : undefined);
      return { error: friendlyAuthError(error) };
    },

    onAuthStateChange(callback) {
      if (!client) return { unsubscribe() {} };
      const { data } = client.auth.onAuthStateChange(callback);
      return data.subscription;
    },
  };
}
