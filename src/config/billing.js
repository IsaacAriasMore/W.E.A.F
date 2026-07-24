const env = import.meta.env ?? {};

export const BILLING_ENABLED =
  env.VITE_BILLING_ENABLED === 'true';

export const PAYPAL_ENABLED =
  env.VITE_PAYPAL_ENABLED === 'true';

export const PAYPAL_MODE =
  env.VITE_PAYPAL_MODE === 'sandbox'
    ? 'sandbox'
    : 'disabled';

export const REAL_PAYPAL_BILLING =
  BILLING_ENABLED &&
  PAYPAL_ENABLED &&
  PAYPAL_MODE === 'sandbox';

export const STRIPE_ENABLED = false;
export const REAL_STRIPE_BILLING = false;