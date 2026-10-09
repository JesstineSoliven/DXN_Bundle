// Payment method registry (browser side). Views only talk to this module, never to a specific provider.
// The server (lib/orders.js) owns payment state; it validates with the same shared rules.
// To add a method: append an entry here and allow its id in js/shared/constants.js PAYMENT_METHODS.
import { GCASH_ACCOUNT, PAYMENT_METHODS, PAYMENT_STATUS } from '../shared/constants.js';
import { validateGcashProof } from '../shared/rules.js';

export { PAYMENT_STATUS };

const methods = [
  {
    id: 'cod',
    label: PAYMENT_METHODS.cod,
    description: 'Pay in cash when your order arrives.',
    icon: 'truck',
    available: true,
    requiresProof: false,
  },
  {
    id: 'gcash',
    label: PAYMENT_METHODS.gcash,
    description: 'Scan our GCash QR or send to our number, then enter your reference no.',
    icon: 'wallet',
    available: true,
    requiresProof: true,
    account: GCASH_ACCOUNT,
    validateProof: validateGcashProof,
  },
];

export const paymentMethods = methods;
export const getPaymentMethod = (id) => methods.find((m) => m.id === id);
export const defaultPaymentMethod = () => methods.find((m) => m.available);
