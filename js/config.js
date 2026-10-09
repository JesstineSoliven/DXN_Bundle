// Store-wide settings for the browser. Shared values live in js/shared/constants.js so the API uses the same ones.
// Admin email and SMTP are server-side environment variables (ADMIN_EMAIL, GMAIL_USER, GMAIL_APP_PASSWORD).
import { DELIVERY_FEE, GCASH_ACCOUNT, getDeliveryFee } from './shared/constants.js';

export const config = {
  deliveryFee: DELIVERY_FEE,
  currency: 'PHP',
  gcash: GCASH_ACCOUNT,
};

export { getDeliveryFee };
