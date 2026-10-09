// GET /api/orders/:id?t=TOKEN[&sync=1] → order (customer view; token required)
//   sync=1: re-check a pending GCash payment with PayMongo (customer just returned from GCash).
// Admin tools may send "x-admin-key" instead of a token (Phase 6 dashboard / ?demo=1 panel).
import { handler, send, urlParts, siteUrl, HttpError } from '../../lib/http.js';
import { getOrderForCustomer, getOrderInternal, syncGcash } from '../../lib/orders.js';
import { requireAdmin } from '../../lib/admin.js';
import { onGcashPaid } from '../../lib/payments.js';

export default handler(['GET'], async (req, res) => {
  const { segments, query } = urlParts(req);
  const id = segments[2];
  if (!/^DXN-\d{6}-\d{4}$/.test(id || '')) throw new HttpError(404, 'Order not found.');
  if (req.headers['x-admin-key']) {
    requireAdmin(req);
    const order = await getOrderInternal(id);
    if (!order) throw new HttpError(404, 'Order not found.');
    return send(res, 200, { order });
  }
  let order = await getOrderForCustomer(id, query.get('t')); // validates the token first
  if (query.get('sync') === '1' && order.payment.method === 'gcash' && order.payment.status !== 'confirmed') {
    const r = await syncGcash(id).catch((err) => { console.error('[sync]', err.message); return { changed: false }; });
    if (r.changed) { order = r.order; await onGcashPaid(order, siteUrl(req)); }
  }
  send(res, 200, { order });
});
