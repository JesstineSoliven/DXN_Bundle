// Store-wide settings for the browser. Shared values live in js/shared/constants.js so the API uses the same ones.
// Admin email, SMTP and PayMongo keys are server-side environment variables.
import { DELIVERY_FEE, getDeliveryFee, getPaymentFee } from './shared/constants.js';

export const config = {
  deliveryFee: DELIVERY_FEE,
  currency: 'PHP',
};

export { getDeliveryFee, getPaymentFee };
