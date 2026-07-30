import { getSupabaseClient } from '../config/supabase.js';
import { LEGAL_VERSION } from '../config/legal.js';
import { pathWithNext, safeInternalDestination } from '../utils/navigation.js';
import { REQUIRE_EMAIL_CONFIRMATION, getAuthCopy } from '../config/auth.js';
import { getLanguage } from '../i18n/index.js';

export function friendlyAuthError(error, { context = 'default', language = getLanguage() } = {}) {
  if (!error) return null;
  const copy = getAuthCopy(language).errors;
  if (error.status === 429 || error.code === 'over_request_rate_limit') return copy.rateLimit;
  if (context === 'recovery') return null;
  if (context === 'signup' && error.code === 'user_already_exists') return copy.signupUnavailable;
  if (error.code === 'invalid_credentials') return copy.invalidCredentials;
  if (error.code === 'email_not_confirmed') return REQUIRE_EMAIL_CONFIRMATION ? copy.confirmEmail : copy.confirmEmailConfig;
  if (error.code === 'signup_disabled') return copy.signupDisabled;
  if (error.code === 'weak_password') return copy.weakPassword;
  return context === 'signup' ? copy.signupUnavailable : copy.generic;
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

    async signUp({ email, password, displayName, gameMode, next = null, captchaToken }) {
      if (!client) return unavailable();
      const redirectBase = (import.meta.env?.VITE_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '');
      const onboardingPath = pathWithNext('/onboarding', safeInternalDestination(next, null));
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectBase}${onboardingPath}`,
          ...(captchaToken ? { captchaToken } : {}),
          data: {
            display_name: displayName,
            default_game_mode: gameMode,
            terms_version: LEGAL_VERSION,
            privacy_version: LEGAL_VERSION,
          },
        },
      });
      return { data, error: friendlyAuthError(error, { context: 'signup' }) };
    },

    async signIn({ email, password, captchaToken }) {
      if (!client) return unavailable();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (!error && REQUIRE_EMAIL_CONFIRMATION && data?.user && !data.user.email_confirmed_at) {
        await client.auth.signOut({ scope: 'local' });
        return { data: null, error: getAuthCopy(getLanguage()).errors.confirmEmail };
      }
      return { data, error: friendlyAuthError(error) };
    },

    async requestPasswordReset(email, captchaToken) {
      if (!client) return unavailable();
      const redirectBase = (import.meta.env?.VITE_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '');
      const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectBase}/reset-password`,
        ...(captchaToken ? { captchaToken } : {}),
      });
      return { data, error: friendlyAuthError(error, { context: 'recovery' }) };
    },

    async updatePassword(password) {
      if (!client) return unavailable();
      const { data, error } = await client.auth.updateUser({ password });
      return {
        data,
        error: friendlyAuthError(error),
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
