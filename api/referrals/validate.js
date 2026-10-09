// POST /api/referrals/validate { code } → { valid, code, referrer } | { valid: false, code, reason }
import { handler, send, readJson } from '../../lib/http.js';
import { checkReferral } from '../../lib/orders.js';

export default handler(['POST'], async (req, res) => {
  const { code } = await readJson(req);
  send(res, 200, await checkReferral(code));
});
