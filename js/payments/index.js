// Payment method registry. Views and the order store only talk to this module, never to a
// specific provider. To add a method, append an object with the same shape.
//
//   start(order)            → initial payment record when the order is placed
//   validateProof(data)     → { ok, errors, proof } for methods the customer must confirm (GCash)
import { config } from '../config.js';

export const PAYMENT_STATUS = {
  cod_pending: 'To pay on delivery',
  pending: 'Pending Payment',
  submitted: 'Payment Submitted',
  confirmed: 'Payment Confirmed',
  failed: 'Payment Failed',
};

const cod = {
  id: 'cod',
  label: 'Cash on Delivery',
  description: 'Pay in cash when your order arrives.',
  icon: 'truck',
  available: true,
  requiresProof: false,
  async start(order) {
    return { method: 'cod', status: 'cod_pending', amountDue: order.totals.grandTotal };
  },
};

const gcash = {
  id: 'gcash',
  label: 'GCash',
  description: 'Scan our GCash QR or send to our number, then enter your reference no.',
  icon: 'wallet',
  available: true,
  requiresProof: true,
  account: config.gcash,
  async start(order) {
    return { method: 'gcash', status: 'pending', amountDue: order.totals.grandTotal };
  },
  /** GCash reference numbers are 13 digits. Sender details help the admin match the transfer. */
  validateProof({ reference = '', senderName = '', senderMobile = '' }) {
    const ref = String(reference).replace(/\D/g, '');
    const mobile = String(senderMobile).replace(/[\s\-().]/g, '');
    const errors = {};
    if (ref.length !== 13) errors.reference = 'Enter the 13-digit reference number from your GCash receipt.';
    if (String(senderName).trim().length < 2) errors.senderName = 'Enter the name on the GCash account you paid from.';
    if (!/^(?:\+?63|0)9\d{9}$/.test(mobile)) errors.senderMobile = 'Enter the GCash mobile number you paid from.';
    return {
      ok: !Object.keys(errors).length,
      errors,
      proof: { reference: ref, senderName: String(senderName).trim(), senderMobile: mobile.replace(/^\+?63/, '0') },
    };
  },
};

const methods = [cod, gcash];

export const paymentMethods = methods;
export const getPaymentMethod = (id) => methods.find((m) => m.id === id);
export const defaultPaymentMethod = () => methods.find((m) => m.available);
