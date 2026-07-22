export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';
export const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === 'true';
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';
export const REAL_STRIPE_BILLING = BILLING_ENABLED && STRIPE_ENABLED;
