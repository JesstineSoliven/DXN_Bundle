// GET /api/orders/:id?t=TOKEN[&sync=1] → order (customer view; token required)
//   sync=1: re-check a pending GCash payment with PayMongo (customer just returned from GCash).
// (Admins view orders in /admin via /api/admin/orders/:id.)
import { handler, send, urlParts, siteUrl, HttpError } from '../../lib/http.js';
import { getOrderForCustomer, syncGcash } from '../../lib/orders.js';
import { onGcashPaid } from '../../lib/payments.js';
import { reportError } from '../../lib/alerts.js';

export default handler(['GET'], async (req, res) => {
  const { segments, query } = urlParts(req);
  const id = segments[2];
  if (!/^DXN-\d{6}-\d{4}$/.test(id || '')) throw new HttpError(404, 'Order not found.');
  let order = await getOrderForCustomer(id, query.get('t')); // validates the token first
  if (query.get('sync') === '1' && order.payment.method === 'gcash' && order.payment.status !== 'confirmed') {
    const r = await syncGcash(id).catch(async (err) => { await reportError('sync', err, { order: id }); return { changed: false }; });
    if (r.changed) { order = r.order; await onGcashPaid(order, siteUrl(req)); }
  }
  send(res, 200, { order });
});
