// POST /api/referrals/validate { code } → { valid, code, referrer } | { valid: false, code, reason }
import { handler, send, readJson } from '../../lib/http.js';
import { checkReferral } from '../../lib/orders.js';
import { rateLimit, clientIp } from '../../lib/security.js';

export default handler(['POST'], async (req, res) => {
  // Stops code guessing: 30 checks per 10 minutes per connection.
  await rateLimit('referral', clientIp(req), 30, 600, 'Too many referral code checks. Please wait a few minutes and try again.');
  const { code } = await readJson(req);
  send(res, 200, await checkReferral(code));
});
