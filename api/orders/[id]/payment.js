// POST /api/orders/:id/payment { token, reference, senderName, senderMobile } → order (status: submitted)
import { handler, send, readJson, urlParts, siteUrl, HttpError } from '../../../lib/http.js';
import { submitGcashProof } from '../../../lib/orders.js';
import { emailAdminPaymentSubmitted } from '../../../lib/emails.js';
import { GCASH_ACCOUNT } from '../../../js/shared/constants.js';

export default handler(['POST'], async (req, res) => {
  const id = urlParts(req).segments[2];
  if (!/^DXN-\d{6}-\d{4}$/.test(id || '')) throw new HttpError(404, 'Order not found.');
  const { token, ...proof } = await readJson(req);
  const order = await submitGcashProof(id, token, proof);
  await emailAdminPaymentSubmitted(order, GCASH_ACCOUNT, siteUrl(req));
  send(res, 200, { order });
});
