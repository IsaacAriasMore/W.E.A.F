const env = import.meta.env || {};

export const REQUIRE_EMAIL_CONFIRMATION = env.VITE_REQUIRE_EMAIL_CONFIRMATION === 'true';

export const AUTH_COPY = Object.freeze({
  es: {
    accountCreated: 'Cuenta creada correctamente.',
    tribeReady: 'Ya puedes crear o unirte a una tribu.',
    signIn: 'Iniciar sesión',
    signUp: 'Registrarse',
  },
  en: {
    accountCreated: 'Account created successfully.',
    tribeReady: 'You can now create or join a tribe.',
    signIn: 'Sign in',
    signUp: 'Sign up',
  },
});

export function needsUnverifiedEmailNotice(user) {
  return !REQUIRE_EMAIL_CONFIRMATION || !user?.email_confirmed_at;
}
