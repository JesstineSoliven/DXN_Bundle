// Validation rules shared by the checkout form and the API, so both enforce the same thing.
// Each field rule returns '' when valid, otherwise a customer-facing message.

export function normalizeMobile(v) {
  const d = String(v ?? '').replace(/[\s\-().]/g, '');
  const m = /^(?:\+?63|0)(9\d{9})$/.exec(d);
  return m ? `+63 ${m[1].slice(0, 3)} ${m[1].slice(3, 6)} ${m[1].slice(6)}` : null;
}

export const normalizeCode = (code) => String(code ?? '').trim().toUpperCase().replace(/\s+/g, '');

const s = (v) => String(v ?? '');

export const CHECKOUT_RULES = {
  name: (v) => (s(v).trim().length >= 2 && s(v).length <= 120 ? '' : 'Enter your full name.'),
  mobile: (v) => (normalizeMobile(v) ? '' : 'Enter a valid PH mobile number, e.g. 0917 123 4567.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s(v).trim()) && s(v).length <= 254 ? '' : 'Enter a valid email address.'),
  street: (v) => (s(v).trim().length >= 5 && s(v).length <= 200 ? '' : 'Enter your house no., street and building.'),
  barangay: (v) => (s(v).trim() && s(v).length <= 120 ? '' : 'Enter your barangay.'),
  city: (v) => (s(v).trim() && s(v).length <= 120 ? '' : 'Enter your city or municipality.'),
  province: (v) => (s(v).trim() && s(v).length <= 120 ? '' : 'Enter your province.'),
  zip: (v) => (!s(v).trim() || /^\d{4}$/.test(s(v).trim()) ? '' : 'ZIP code should be 4 digits.'),
  notes: (v) => (s(v).length <= 500 ? '' : 'Delivery notes are too long (max 500 characters).'),
};

/** Validate all checkout fields → { ok, errors: { field: message } } */
export function validateCheckout(fields) {
  const errors = {};
  for (const [k, rule] of Object.entries(CHECKOUT_RULES)) {
    const msg = rule(fields?.[k]);
    if (msg) errors[k] = msg;
  }
  return { ok: !Object.keys(errors).length, errors };
}

/** Referral code format check (existence is checked by the server). */
export function referralFormatError(code) {
  const c = normalizeCode(code);
  if (!c) return 'Enter a referral code.';
  if (!/^[A-Z0-9-]{4,20}$/.test(c)) return 'Referral codes use letters, numbers and dashes only.';
  return '';
}

