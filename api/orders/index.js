// POST /api/orders → { order, token }. Prices are recomputed server-side; the admin is emailed.
import { handler, send, readJson, siteUrl } from '../../lib/http.js';
import { createOrder } from '../../lib/orders.js';
import { emailAdminNewOrder } from '../../lib/emails.js';
import { rateLimit, clientIp } from '../../lib/security.js';

export default handler(['POST'], async (req, res) => {
  // A real customer places a handful of orders; bots get stopped here.
  await rateLimit('order', clientIp(req), 8, 600, 'Too many orders from this connection. Please wait a few minutes and try again.');
  const { order, token } = await createOrder(await readJson(req));
  await emailAdminNewOrder(order, siteUrl(req)); // best-effort; never throws
  send(res, 201, { order, token });
});
