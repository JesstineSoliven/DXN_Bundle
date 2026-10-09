// Referral-code validation — checked by the server against the referral_codes table.
import { api } from '../api.js';
import { normalizeCode, referralFormatError } from '../shared/rules.js';

export { normalizeCode };

/** → { valid: true, code, referrer } | { valid: false, code, reason } */
export async function validateReferralCode(input) {
  const code = normalizeCode(input);
  const fmt = referralFormatError(code);
  if (fmt) return { valid: false, code, reason: fmt };
  try {
    return await api.post('/api/referrals/validate', { code });
  } catch (err) {
    return { valid: false, code, reason: err.message };
  }
}
