// Orders — stored on the server (/api/orders). The browser keeps only each order's access token
// (localStorage "dxn.myOrders") so the customer can reopen their order/payment pages on this device.
import { api } from '../api.js';

const KEY = 'dxn.myOrders';

function readTokens() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function rememberToken(id, token) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readTokens(), [id]: token })); } catch { /* storage unavailable */ }
}
/** Token from the URL (?t=…) wins; otherwise the one remembered on this device. */
export const tokenFor = (id, urlToken) => urlToken || readTokens()[id] || '';

/** @returns {Promise<{ order, token }>} */
export async function createOrder(payload) {
  const { order, token } = await api.post('/api/orders', payload);
  rememberToken(order.id, token);
  return { order, token };
}

export async function getOrder(id, urlToken, { adminKey } = {}) {
  const token = tokenFor(id, urlToken);
  if (urlToken) rememberToken(id, urlToken);
  const headers = adminKey && !token ? { 'x-admin-key': adminKey } : undefined;
  const { order } = await api.get(`/api/orders/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`, headers);
  return order;
}

const ADMIN_KEY = 'dxn.adminKey'; // sessionStorage — cleared when the browser tab closes
export const getAdminKey = () => { try { return sessionStorage.getItem(ADMIN_KEY) || ''; } catch { return ''; } };
export const saveAdminKey = (k) => { try { sessionStorage.setItem(ADMIN_KEY, k); } catch { /* ignore */ } };

/** → { ok: true, order } | { ok: false, errors } */
export async function submitPaymentProof(id, proof) {
  try {
    const { order } = await api.post(`/api/orders/${encodeURIComponent(id)}/payment`, { token: tokenFor(id), ...proof });
    return { ok: true, order };
  } catch (err) {
    if (err.fields) return { ok: false, errors: err.fields };
    throw err;
  }
}

/** Admin only (x-admin-key). Phase 6 moves this into the dashboard. */
export async function setPaymentStatus(id, status, note, adminKey) {
  const { order } = await api.post(`/api/admin/orders/${encodeURIComponent(id)}/payment-status`, { status, note }, { 'x-admin-key': adminKey });
  return order;
}

/** Shareable link for an order (includes the access token). */
export const orderLink = (id, page = 'order') => `#/${page}/${id}?t=${encodeURIComponent(tokenFor(id))}`;
