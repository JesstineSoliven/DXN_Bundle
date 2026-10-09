// PayMongo client: hosted Checkout Sessions for GCash + webhook signature verification.
// Docs: https://developers.paymongo.com (Checkout API, Webhooks).
// PAYMONGO_MOCK=1 (local dev/tests only) fakes the API and serves a mock checkout page via dev-server.mjs.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

const API = 'https://api.paymongo.com/v1';
export const isMock = () => process.env.PAYMONGO_MOCK === '1' && !process.env.VERCEL;

function authHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new HttpError(503, 'GCash payments are not configured yet. Please choose Cash on Delivery.');
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

async function pm(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.errors?.map((e) => e.detail).join('; ') || res.statusText;
    console.error('[paymongo]', method, path, res.status, detail);
    throw new HttpError(502, 'We couldn’t start the GCash payment. Please try again in a moment.');
  }
  return data.data;
}

/** Normalised session: { id, url, status: 'active'|'expired'|..., paid: bool, paymentId, amount (centavos) } */
function normalise(s) {
  const a = s.attributes || {};
  const paid = (a.payments || []).find((p) => p.attributes?.status === 'paid');
  return {
    id: s.id,
    url: a.checkout_url,
    status: a.status,
    paid: Boolean(paid) || a.payment_intent?.attributes?.status === 'succeeded',
    paymentId: paid?.id || null,
    amount: paid?.attributes?.amount ?? null,
    reference: a.reference_number || a.metadata?.order_id || null,
  };
}

// ---------------------------------------------------------------------------
// Mock (dev only): sessions kept in memory of the dev-server process
// ---------------------------------------------------------------------------
const mockSessions = new Map();
export const mock = {
  get: (id) => mockSessions.get(id),
  pay(id) {
    const s = mockSessions.get(id);
    if (!s) return null;
    s.paid = true; s.status = 'paid'; s.paymentId = `pay_mock_${randomBytes(6).toString('hex')}`; s.amount = s.total;
    return s;
  },
};

/**
 * Create a Checkout Session for an order (exact amount, GCash only).
 * @param {{ id, totals: { grandTotal }, customer: { name, email, mobile } }} order
 */
export async function createCheckoutSession(order, { successUrl, cancelUrl, baseUrl }) {
  const amount = order.totals.grandTotal * 100; // centavos
  if (isMock()) {
    const id = `cs_mock_${randomBytes(8).toString('hex')}`;
    const s = { id, total: amount, reference: order.id, status: 'active', paid: false, paymentId: null, amount: null, successUrl, cancelUrl };
    s.url = `${baseUrl}/dev/paymongo-checkout?cs=${id}`;
    mockSessions.set(id, s);
    return { id, url: s.url, status: 'active', paid: false };
  }
  const s = await pm('POST', '/checkout_sessions', {
    data: {
      attributes: {
        line_items: [{ currency: 'PHP', amount, name: `DXN Bundle Store — Order ${order.id}`, quantity: 1 }],
        payment_method_types: ['gcash'],
        success_url: successUrl,
        cancel_url: cancelUrl,
        reference_number: order.id,
        description: `Order ${order.id}`,
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        billing: { name: order.customer.name, email: order.customer.email, phone: order.customer.mobile.replace(/\s/g, '') },
        metadata: { order_id: order.id },
      },
    },
  });
  return normalise(s);
}

export async function retrieveCheckoutSession(id) {
  if (isMock()) {
    const s = mockSessions.get(id);
    return s ? { id: s.id, url: s.url, status: s.status, paid: s.paid, paymentId: s.paymentId, amount: s.amount, reference: s.reference } : null;
  }
  return normalise(await pm('GET', `/checkout_sessions/${encodeURIComponent(id)}`));
}

/** Register the webhook (one-off setup script). Returns { id, secret }. */
export async function createWebhook(url, events = ['checkout_session.payment.paid']) {
  const w = await pm('POST', '/webhooks', { data: { attributes: { url, events } } });
  return { id: w.id, secret: w.attributes.secret_key, livemode: w.attributes.livemode };
}

/**
 * Verify the "Paymongo-Signature" header: t=<timestamp>,te=<test sig>,li=<live sig>
 * Signature = HMAC-SHA256(secret, `${t}.${rawBody}`) as hex; te is used in test mode, li in live mode.
 */
export function verifySignature(rawBody, header, secret, { toleranceSec = 600 } = {}) {
  if (!secret || typeof header !== 'string') return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.trim().split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  return [parts.te, parts.li].filter(Boolean).some((sig) => {
    const a = Buffer.from(sig, 'hex'), b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Build a signature header (used by the mock checkout and tests). */
export function signPayload(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},te=${sig},li=`;
}

/** Extract { checkoutId, paymentId, amount, reference } from a checkout_session.payment.paid event. */
export function parsePaidEvent(event) {
  const attrs = event?.data?.attributes;
  if (attrs?.type !== 'checkout_session.payment.paid') return null;
  const s = normalise(attrs.data || {});
  return { checkoutId: s.id, paymentId: s.paymentId, amount: s.amount, reference: s.reference, paid: s.paid, livemode: Boolean(attrs.livemode) };
}
