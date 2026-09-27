// Orders. MOCK persistence (localStorage "dxn.orders") until the Phase 5 backend/database.
// The functions here are the only way views create or change orders; their shapes mirror the future API.
import { getPaymentMethod, PAYMENT_STATUS } from '../payments/index.js';
import { notifyAdminNewOrder, notifyAdminPaymentSubmitted, notifyPaymentStatus } from '../services/notify.js';

const KEY = 'dxn.orders';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function writeAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}
function update(id, fn) {
  const all = readAll();
  const i = all.findIndex((o) => o.id === id);
  if (i < 0) throw new Error('Order not found.');
  all[i] = fn(structuredClone(all[i]));
  writeAll(all);
  return all[i];
}

/** DXN-YYMMDD-NNNN (random suffix; the backend will issue sequential numbers). */
function newOrderId(existing) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  let id;
  do { id = `DXN-${ymd}-${String(Math.floor(1000 + Math.random() * 9000))}`; } while (existing.some((o) => o.id === id));
  return id;
}

const historyEntry = (status, note = '') => ({ status, label: PAYMENT_STATUS[status], at: new Date().toISOString(), note });

/**
 * @param {{ type: 'custom'|'mystery', items: Array, totals: object, customer: object, referral: object, paymentMethod: string }} draft
 */
export async function createOrder(draft) {
  const method = getPaymentMethod(draft.paymentMethod);
  if (!method?.available) throw new Error('Selected payment method is not available.');
  if (!draft.items?.length) throw new Error('Your order has no items.');
  if (!draft.referral?.code) throw new Error('A verified referral code is required.');

  const all = readAll();
  const order = {
    id: newOrderId(all),
    type: draft.type,
    createdAt: new Date().toISOString(),
    status: 'placed',
    customer: draft.customer,
    referral: draft.referral,
    items: draft.items,
    totals: draft.totals,
  };
  const pay = await method.start(order);
  order.payment = {
    ...pay,
    label: method.label,
    statusLabel: PAYMENT_STATUS[pay.status],
    updatedAt: order.createdAt,
    history: [historyEntry(pay.status, 'Order placed')],
  };

  writeAll([...all, order]);
  notifyAdminNewOrder(order);
  return order;
}

/** Customer submits payment proof (GCash reference no.). Pending/Failed → Submitted. */
export async function submitPaymentProof(id, data) {
  const order = getOrder(id);
  if (!order) throw new Error('Order not found.');
  const method = getPaymentMethod(order.payment.method);
  if (!method?.requiresProof) throw new Error('This order does not need payment confirmation.');
  if (!['pending', 'failed'].includes(order.payment.status)) throw new Error('Payment for this order was already submitted.');

  const res = method.validateProof(data);
  if (!res.ok) return res;
  const dupe = readAll().some((o) => o.id !== id && o.payment?.proof?.reference === res.proof.reference);
  if (dupe) return { ok: false, errors: { reference: 'This reference number was already used for another order.' } };

  await new Promise((r) => setTimeout(r, 400)); // simulate network latency
  const updated = update(id, (o) => {
    o.payment = { ...o.payment, status: 'submitted', statusLabel: PAYMENT_STATUS.submitted, proof: { ...res.proof, submittedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() };
    o.payment.history.push(historyEntry('submitted', `Ref. ${res.proof.reference}`));
    return o;
  });
  notifyAdminPaymentSubmitted(updated);
  return { ok: true, order: updated };
}

/** Admin verifies the transfer (Phase 6 dashboard; demo control for now). Submitted → Confirmed | Failed. */
export function setPaymentStatus(id, status, note = '') {
  if (!['confirmed', 'failed'].includes(status)) throw new Error('Unsupported status.');
  const updated = update(id, (o) => {
    if (o.payment.status !== 'submitted') throw new Error('Only submitted payments can be confirmed or failed.');
    o.payment = { ...o.payment, status, statusLabel: PAYMENT_STATUS[status], updatedAt: new Date().toISOString(), note };
    o.payment.history.push(historyEntry(status, note));
    return o;
  });
  notifyPaymentStatus(updated);
  return updated;
}

export const getOrder = (id) => readAll().find((o) => o.id === id) || null;
export const listOrders = () => readAll();
