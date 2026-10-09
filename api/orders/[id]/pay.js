// POST /api/orders/:id/pay { token } → { checkoutUrl } — start/resume the PayMongo GCash checkout.
import { handler, send, readJson, urlParts, siteUrl, HttpError } from '../../../lib/http.js';
import { startGcashCheckout } from '../../../lib/orders.js';

export default handler(['POST'], async (req, res) => {
  const id = urlParts(req).segments[2];
  if (!/^DXN-\d{6}-\d{4}$/.test(id || '')) throw new HttpError(404, 'Order not found.');
  const { token } = await readJson(req);
  send(res, 200, await startGcashCheckout(id, token, siteUrl(req)));
});
