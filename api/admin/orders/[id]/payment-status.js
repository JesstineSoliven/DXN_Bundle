// POST /api/admin/orders/:id/payment-status { status: 'confirmed'|'failed', note } — header x-admin-key
import { handler, send, readJson, urlParts, HttpError } from '../../../../lib/http.js';
import { requireAdmin } from '../../../../lib/admin.js';
import { setPaymentStatus } from '../../../../lib/orders.js';
import { emailCustomerPaymentStatus } from '../../../../lib/emails.js';

export default handler(['POST'], async (req, res) => {
  requireAdmin(req);
  const id = urlParts(req).segments[3];
  if (!/^DXN-\d{6}-\d{4}$/.test(id || '')) throw new HttpError(404, 'Order not found.');
  const { status, note } = await readJson(req);
  const order = await setPaymentStatus(id, status, note);
  await emailCustomerPaymentStatus(order);
  send(res, 200, { order });
});
