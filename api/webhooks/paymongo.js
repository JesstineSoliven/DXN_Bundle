// POST /api/webhooks/paymongo — PayMongo event receiver (checkout_session.payment.paid).
// Verifies the Paymongo-Signature header over the raw body, then marks the order paid (idempotent).
import { handler, send, readRaw, siteUrl, HttpError } from '../../lib/http.js';
import { verifySignature, parsePaidEvent } from '../../lib/paymongo.js';
import { markGcashPaid } from '../../lib/orders.js';
import { onGcashPaid } from '../../lib/payments.js';

export default handler(['POST'], async (req, res) => {
  const raw = await readRaw(req);
  if (!verifySignature(raw, req.headers['paymongo-signature'], process.env.PAYMONGO_WEBHOOK_SECRET)) {
    throw new HttpError(401, 'Invalid signature.');
  }
  let event;
  try { event = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid JSON.'); }

  const paid = parsePaidEvent(event);
  if (!paid) return send(res, 200, { received: true, ignored: event?.data?.attributes?.type || 'unknown' });
  if (!paid.paid || !/^DXN-\d{6}-\d{4}$/.test(paid.reference || '')) {
    console.warn('[webhook] paid event without a matching order reference', paid);
    return send(res, 200, { received: true, ignored: 'no-order' });
  }
  try {
    const { order, changed } = await markGcashPaid(paid.reference, paid);
    if (changed) await onGcashPaid(order, siteUrl(req));
    send(res, 200, { received: true, order: paid.reference, changed });
  } catch (err) {
    // Amount mismatch / unknown order: acknowledge (so PayMongo stops retrying) but log loudly for the admin.
    console.error('[webhook] not applied:', paid.reference, err.message);
    send(res, 200, { received: true, applied: false, reason: err.message });
  }
});
