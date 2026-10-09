// GET /api/orders/:id?t=TOKEN → order (customer view; token required)
// Admin tools may send "x-admin-key" instead of a token (Phase 6 dashboard / ?demo=1 panel).
import { handler, send, urlParts, HttpError } from '../../lib/http.js';
import { getOrderForCustomer, getOrderInternal } from '../../lib/orders.js';
import { requireAdmin } from '../../lib/admin.js';

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
  send(res, 200, { order: await getOrderForCustomer(id, query.get('t')) });
});
