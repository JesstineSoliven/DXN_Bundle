// Referral-code validation. MOCK until Phase 5: the backend will validate against the database
// (and Phase 7 secures it server-side). The async signature stays the same.
const SAMPLE_CODES = {
  'DXN-JS001': { referrer: 'Sample Referrer A' },
  'DXN-JS002': { referrer: 'Sample Referrer B' },
  'DXNPH2026': { referrer: 'DXN Bundle Store' },
};

export const normalizeCode = (code) => String(code || '').trim().toUpperCase().replace(/\s+/g, '');

/** → { valid: true, code, referrer } | { valid: false, code, reason } */
export async function validateReferralCode(input) {
  const code = normalizeCode(input);
  await new Promise((r) => setTimeout(r, 450)); // simulate network latency
  if (!code) return { valid: false, code, reason: 'Enter a referral code.' };
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return { valid: false, code, reason: 'Referral codes use letters, numbers and dashes only.' };
  const hit = SAMPLE_CODES[code];
  return hit ? { valid: true, code, referrer: hit.referrer } : { valid: false, code, reason: 'We couldn’t find that referral code. Please check it with your referrer.' };
}
