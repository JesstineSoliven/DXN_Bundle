// Order domain logic. Prices are always recomputed from the database — client prices are ignored.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { query, tx } from './db.js';
import { HttpError } from './http.js';
import { validateCheckout, normalizeMobile, normalizeCode, referralFormatError } from '../js/shared/rules.js';
import { MAX_QTY, MAX_BOXES, MYSTERY_BOX, PAYMENT_METHODS, PAYMENT_STATUS, getDeliveryFee, getPaymentFee } from '../js/shared/constants.js';
import { createCheckoutSession, retrieveCheckoutSession } from './paymongo.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function tokenMatches(token, hash) {
  if (typeof token !== 'string' || !token) return false;
  const a = Buffer.from(sha256(token), 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** YYMMDD in Philippine time (orders are numbered per local day). */
function manilaDay(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: '2-digit', month: '2-digit', day: '2-digit' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}${p.month}${p.day}`;
}

// ---------------------------------------------------------------------------
// Referral codes
// ---------------------------------------------------------------------------
export async function checkReferral(input) {
  const code = normalizeCode(input);
  const fmt = referralFormatError(code);
  if (fmt) return { valid: false, code, reason: fmt };
  const [row] = await query('SELECT referrer_name FROM referral_codes WHERE code = $1 AND active', [code]);
  return row
    ? { valid: true, code, referrer: row.referrer_name }
    : { valid: false, code, reason: 'We couldn’t find that referral code. Please check it with your referrer.' };
}

// ---------------------------------------------------------------------------
// Read model → the shape the frontend views use
// ---------------------------------------------------------------------------
async function loadOrder(id) {
  const [o] = await query(
    `SELECT o.*, r.referrer_name FROM orders o JOIN referral_codes r ON r.code = o.referral_code WHERE o.id = $1`, [id]);
  if (!o) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id]);
  const events = await query('SELECT status, note, created_at FROM payment_events WHERE order_id = $1 ORDER BY id', [id]);
  return { row: o, items, events };
}

function toPublic({ row: o, items, events }) {
  const lastFail = [...events].reverse().find((e) => e.status === 'failed');
  return {
    id: o.id,
    type: o.type,
    status: o.status,
    createdAt: new Date(o.created_at).toISOString(),
    customer: {
      name: o.customer_name, mobile: o.customer_mobile, email: o.customer_email,
      address: o.address, addressText: o.address_text, notes: o.notes,
    },
    referral: { code: o.referral_code, referrer: o.referrer_name },
    items: items.map((i) => ({ id: i.product_id || MYSTERY_BOX.id, code: i.code, name: i.name, size: i.size, price: i.unit_price, qty: i.qty, lineTotal: i.line_total })),
    totals: {
      count: items.reduce((a, i) => a + i.qty, 0),
      subtotal: o.subtotal, deliveryFee: o.delivery_fee, paymentFee: o.payment_fee ?? 0, grandTotal: o.grand_total,
    },
    payment: {
      method: o.payment_method,
      label: PAYMENT_METHODS[o.payment_method],
      status: o.payment_status,
      statusLabel: PAYMENT_STATUS[o.payment_status],
      amountDue: o.grand_total,
      note: o.payment_status === 'failed' ? lastFail?.note || '' : '',
      paidAt: o.paid_at ? new Date(o.paid_at).toISOString() : null,
      paymentId: o.paymongo_payment_id || null,
      proof: o.gcash_reference ? { reference: o.gcash_reference, senderName: o.sender_name, senderMobile: o.sender_mobile, submittedAt: o.submitted_at } : null,
      history: events.map((e) => ({ status: e.status, label: PAYMENT_STATUS[e.status], at: new Date(e.created_at).toISOString(), note: e.note })),
      updatedAt: new Date(o.updated_at).toISOString(),
    },
  };
}

/** Customer read: requires the order's access token (order numbers are sequential, hence guessable). */
export async function getOrderForCustomer(id, token) {
  const data = await loadOrder(id);
  if (!data || !tokenMatches(token, data.row.access_token_hash)) throw new HttpError(404, 'Order not found.');
  return toPublic(data);
}

export async function getOrderInternal(id) {
  const data = await loadOrder(id);
  return data ? toPublic(data) : null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
/**
 * body: { type: 'custom'|'mystery', items?: [{id, qty}], mysteryQty?: number,
 *         customer: {name, mobile, email, street, barangay, city, province, zip, notes},
 *         referralCode: string, paymentMethod: 'cod'|'gcash' }
 */
export async function createOrder(body) {
  const type = body?.type === 'mystery' ? 'mystery' : body?.type === 'custom' ? 'custom' : null;
  if (!type) throw new HttpError(400, 'Unknown order type.');
  if (!PAYMENT_METHODS[body.paymentMethod]) throw new HttpError(400, 'Choose a payment method.');

  const c = body.customer || {};
  const check = validateCheckout(c);
  if (!check.ok) throw new HttpError(422, 'Please check your details.', { fields: check.errors });

  const ref = await checkReferral(body.referralCode);
  if (!ref.valid) throw new HttpError(422, ref.reason, { fields: { referral: ref.reason } });

  // ---- lines, priced from the database ----
  let lines;
  if (type === 'mystery') {
    const qty = Number(body.mysteryQty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_BOXES) throw new HttpError(422, `Choose 1–${MAX_BOXES} Mystery Boxes.`);
    lines = [{ product_id: null, code: MYSTERY_BOX.code, name: MYSTERY_BOX.name, size: MYSTERY_BOX.size, unit_price: MYSTERY_BOX.price, qty }];
  } else {
    const want = new Map();
    for (const it of Array.isArray(body.items) ? body.items : []) {
      const qty = Number(it?.qty);
      if (typeof it?.id !== 'string' || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError(422, 'Invalid quantity in your bundle.');
      want.set(it.id, (want.get(it.id) || 0) + qty);
    }
    if (!want.size) throw new HttpError(422, 'Your bundle is empty.');
    if (want.size > 200) throw new HttpError(422, 'Too many products in one order.');
    const rows = await query('SELECT id, code, name, size, price FROM products WHERE active AND id = ANY($1::text[]) ORDER BY sort', [[...want.keys()]]);
    if (rows.length !== want.size) throw new HttpError(409, 'Some products in your bundle are no longer available. Please review your bundle.');
    lines = rows.map((p) => ({ product_id: p.id, code: p.code, name: p.name, size: p.size, unit_price: p.price, qty: Math.min(want.get(p.id), MAX_QTY) }));
  }
  lines.forEach((l) => { l.line_total = l.unit_price * l.qty; });
  const subtotal = lines.reduce((a, l) => a + l.line_total, 0);
  const deliveryFee = getDeliveryFee(subtotal);
  const paymentFee = getPaymentFee(body.paymentMethod, subtotal);

  const token = randomBytes(24).toString('base64url');
  const customer = {
    name: String(c.name).trim(),
    mobile: normalizeMobile(c.mobile),
    email: String(c.email).trim().toLowerCase(),
    address: { street: String(c.street).trim(), barangay: String(c.barangay).trim(), city: String(c.city).trim(), province: String(c.province).trim(), zip: String(c.zip ?? '').trim() },
    notes: String(c.notes || '').trim(),
  };
  const addressText = Object.values(customer.address).filter(Boolean).join(', ');
  const paymentStatus = body.paymentMethod === 'cod' ? 'cod_pending' : 'pending';

  const id = await tx(async (q) => {
    const [{ n }] = await q(
      `INSERT INTO order_counters (day, n) VALUES ($1, 1)
       ON CONFLICT (day) DO UPDATE SET n = order_counters.n + 1 RETURNING n`, [manilaDay()]);
    const orderId = `DXN-${manilaDay()}-${String(n).padStart(4, '0')}`;
    const [{ id: customerId }] = await q(
      `INSERT INTO customers (name, mobile, email) VALUES ($1, $2, $3)
       ON CONFLICT (email, mobile) DO UPDATE SET name = EXCLUDED.name, updated_at = now() RETURNING id`,
      [customer.name, customer.mobile, customer.email]);
    await q(
      `INSERT INTO orders (id, access_token_hash, type, customer_id, customer_name, customer_mobile, customer_email,
         address, address_text, notes, referral_code, subtotal, delivery_fee, payment_fee, grand_total, payment_method, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [orderId, sha256(token), type, customerId, customer.name, customer.mobile, customer.email,
        JSON.stringify(customer.address), addressText, customer.notes, ref.code, subtotal, deliveryFee, paymentFee,
        subtotal + deliveryFee + paymentFee, body.paymentMethod, paymentStatus]);
    for (const l of lines) {
      await q(`INSERT INTO order_items (order_id, product_id, code, name, size, unit_price, qty, line_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orderId, l.product_id, l.code, l.name, l.size, l.unit_price, l.qty, l.line_total]);
    }
    await q('INSERT INTO payment_events (order_id, status, note) VALUES ($1, $2, $3)', [orderId, paymentStatus, 'Order placed']);
    return orderId;
  });

  return { order: await getOrderInternal(id), token };
}

// ---------------------------------------------------------------------------
// GCash via PayMongo
// ---------------------------------------------------------------------------
async function requireCustomerOrder(id, token) {
  const data = await loadOrder(id);
  if (!data || !tokenMatches(token, data.row.access_token_hash)) throw new HttpError(404, 'Order not found.');
  return data;
}

/**
 * Start (or resume) the PayMongo checkout for a pending GCash order → { checkoutUrl }.
 * Reuses the existing session while it is still active, so double clicks don't create duplicates.
 */
export async function startGcashCheckout(id, token, baseUrl) {
  const data = await requireCustomerOrder(id, token);
  const o = data.row;
  if (o.payment_method !== 'gcash') throw new HttpError(409, 'This order is paid by Cash on Delivery.');
  if (o.payment_status === 'confirmed') throw new HttpError(409, 'This order is already paid.');

  if (o.paymongo_checkout_id) {
    const existing = await retrieveCheckoutSession(o.paymongo_checkout_id).catch(() => null);
    if (existing?.paid) { await markGcashPaid(id, { checkoutId: existing.id, paymentId: existing.paymentId, amount: existing.amount }); throw new HttpError(409, 'This order is already paid.'); }
    if (existing?.status === 'active' && existing.url) return { checkoutUrl: existing.url };
  }

  const back = `${baseUrl}/#/`;
  const t = encodeURIComponent(token);
  const session = await createCheckoutSession(toPublic(data), {
    baseUrl,
    successUrl: `${back}order/${id}?t=${t}&paid=1`,
    cancelUrl: `${back}pay/${id}?t=${t}&cancelled=1`,
  });
  await query('UPDATE orders SET paymongo_checkout_id = $2, updated_at = now() WHERE id = $1', [id, session.id]);
  return { checkoutUrl: session.url };
}

/**
 * Mark a GCash order paid (webhook or sync). Idempotent; the paid amount must equal the order total.
 * @returns {{ order, changed: boolean }}
 */
export async function markGcashPaid(id, { checkoutId, paymentId, amount }) {
  const changed = await tx(async (q) => {
    const [o] = await q('SELECT payment_method, payment_status, grand_total, paymongo_checkout_id FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!o) throw new HttpError(404, 'Order not found.');
    if (o.payment_method !== 'gcash') throw new HttpError(409, 'Not a GCash order.');
    if (o.paymongo_checkout_id && checkoutId && o.paymongo_checkout_id !== checkoutId) throw new HttpError(409, 'Checkout session does not belong to this order.');
    if (o.payment_status === 'confirmed') return false; // already processed (webhook replay or sync)
    if (Number(amount) !== o.grand_total * 100) {
      throw new HttpError(409, `Paid amount (${amount}) does not match order total (${o.grand_total * 100}).`);
    }
    await q(`UPDATE orders SET payment_status = 'confirmed', paymongo_payment_id = $2, paymongo_checkout_id = COALESCE(paymongo_checkout_id, $3),
               paid_at = now(), updated_at = now() WHERE id = $1`, [id, paymentId, checkoutId]);
    await q('INSERT INTO payment_events (order_id, status, note) VALUES ($1, $2, $3)', [id, 'confirmed', `Paid via GCash (PayMongo ${paymentId || checkoutId})`]);
    return true;
  });
  return { order: await getOrderInternal(id), changed };
}

/** Re-check a pending GCash order with PayMongo (customer returned from GCash; webhook may be late). */
export async function syncGcash(id) {
  const [o] = await query('SELECT payment_method, payment_status, paymongo_checkout_id FROM orders WHERE id = $1', [id]);
  if (!o || o.payment_method !== 'gcash' || o.payment_status === 'confirmed' || !o.paymongo_checkout_id) return { changed: false };
  const s = await retrieveCheckoutSession(o.paymongo_checkout_id).catch((err) => { console.error('[sync]', err.message); return null; });
  if (!s?.paid) return { changed: false };
  return markGcashPaid(id, { checkoutId: s.id, paymentId: s.paymentId, amount: s.amount });
}

// ---------------------------------------------------------------------------
// Admin override (Phase 6 dashboard): refunds/disputes or manual confirmation
// ---------------------------------------------------------------------------
const ADMIN_TRANSITIONS = {
  confirmed: ['pending', 'submitted', 'failed'],
  failed: ['pending', 'submitted', 'confirmed'],
};

export async function setPaymentStatus(id, status, note = '') {
  if (!ADMIN_TRANSITIONS[status]) throw new HttpError(400, 'Status must be confirmed or failed.');
  const cleanNote = String(note || '').slice(0, 300);
  await tx(async (q) => {
    const [o] = await q('SELECT payment_method, payment_status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!o) throw new HttpError(404, 'Order not found.');
    if (o.payment_method !== 'gcash') throw new HttpError(409, 'Cash on Delivery orders are settled on delivery.');
    if (!ADMIN_TRANSITIONS[status].includes(o.payment_status)) {
      throw new HttpError(409, `Can’t change payment from “${PAYMENT_STATUS[o.payment_status]}” to “${PAYMENT_STATUS[status]}”.`);
    }
    await q('UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1', [id, status]);
    await q('INSERT INTO payment_events (order_id, status, note) VALUES ($1, $2, $3)', [id, status, cleanNote]);
  });
  return getOrderInternal(id);
}
