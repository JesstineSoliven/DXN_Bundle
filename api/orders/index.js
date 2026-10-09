// POST /api/orders → { order, token }. Prices are recomputed server-side; the admin is emailed.
import { handler, send, readJson, siteUrl } from '../../lib/http.js';
import { createOrder } from '../../lib/orders.js';
import { emailAdminNewOrder } from '../../lib/emails.js';

export default handler(['POST'], async (req, res) => {
  const { order, token } = await createOrder(await readJson(req));
  await emailAdminNewOrder(order, siteUrl(req)); // best-effort; never throws
  send(res, 201, { order, token });
});
