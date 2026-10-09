// Payment method registry (browser side). Views only talk to this module, never to a specific provider.
// The server (lib/orders.js + lib/paymongo.js) owns payment state.
// To add a method: append an entry here and allow its id in js/shared/constants.js PAYMENT_METHODS.
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../shared/constants.js';

export { PAYMENT_STATUS };

const methods = [
  {
    id: 'cod',
    label: PAYMENT_METHODS.cod,
    description: 'Pay in cash when your order arrives.',
    icon: 'truck',
    available: true,
    redirects: false,
  },
  {
    id: 'gcash',
    label: PAYMENT_METHODS.gcash,
    description: 'Pay securely in the GCash app — the exact amount is filled in for you.',
    icon: 'wallet',
    available: true,
    redirects: true,       // customer is sent to PayMongo → GCash, confirmed automatically
    feeLabel: 'GCash convenience fee',
  },
];

export const paymentMethods = methods;
export const getPaymentMethod = (id) => methods.find((m) => m.id === id);
export const defaultPaymentMethod = () => methods.find((m) => m.available);
