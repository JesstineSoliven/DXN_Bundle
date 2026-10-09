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

export async function getOrder(id, urlToken, { sync = false } = {}) {
  const token = tokenFor(id, urlToken);
  if (urlToken) rememberToken(id, urlToken);
  const { order } = await api.get(`/api/orders/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}${sync ? '&sync=1' : ''}`);
  return order;
}


/** Start (or resume) the GCash checkout → PayMongo URL to redirect to. */
export async function startGcashPayment(id) {
  const { checkoutUrl } = await api.post(`/api/orders/${encodeURIComponent(id)}/pay`, { token: tokenFor(id) });
  return checkoutUrl;
}

/** Shareable link for an order (includes the access token). */
export const orderLink = (id, page = 'order') => `#/${page}/${id}?t=${encodeURIComponent(tokenFor(id))}`;
