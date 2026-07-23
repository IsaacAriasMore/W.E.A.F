export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';
export const PAYPAL_ENABLED = import.meta.env.VITE_PAYPAL_ENABLED === 'true';
export const PAYPAL_MODE = import.meta.env.VITE_PAYPAL_MODE === 'sandbox' ? 'sandbox' : 'disabled';
export const REAL_PAYPAL_BILLING = BILLING_ENABLED && PAYPAL_ENABLED && PAYPAL_MODE === 'sandbox';

// Kept only for an explicit rollback while historical Stripe records are retained.
export const STRIPE_ENABLED = false;
export const REAL_STRIPE_BILLING = false;
