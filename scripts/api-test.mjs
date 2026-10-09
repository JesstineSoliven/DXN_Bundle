// API smoke test. Usage: BASE=http://localhost:3001 ADMIN_API_KEY=… npm run test:api
// Runs against the dev server (local PGlite) or a deployed URL. Creates real test orders.
import './env.mjs';

const BASE = process.env.BASE || 'http://localhost:3001';
const ADMIN = process.env.ADMIN_API_KEY || '';
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(cond ? '  ✓' : '  ✗', msg); };

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
  let data = {}; try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const customer = { name: 'API Test', mobile: '0917 555 0101', email: 'api-test@example.com', street: '1 Test St.', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '1200', notes: '' };
const ref13 = () => String(Date.now()).slice(-10).padStart(13, '7');

console.log(`API test → ${BASE}`);

console.log('Catalog');
const cat = await call('GET', '/api/catalog');
ok(cat.status === 200 && cat.data.products.length >= 154 && cat.data.categories.length >= 9, `catalog: ${cat.data.products?.length} products, ${cat.data.categories?.length} categories`);
const fb096 = cat.data.products.find((p) => p.id === 'fb096');
const hf001 = cat.data.products.find((p) => p.id === 'hf001');
ok(fb096?.price === 430 && fb096.featured, 'Lingzhi 3 in 1 = ₱430, featured');

console.log('Referral codes');
ok((await call('POST', '/api/referrals/validate', { code: ' dxn-js001 ' })).data.referrer === 'Sample Referrer A', 'valid code (normalised)');
ok((await call('POST', '/api/referrals/validate', { code: 'NOPE-123' })).data.valid === false, 'unknown code rejected');
ok((await call('POST', '/api/referrals/validate', { code: '<x>' })).data.valid === false, 'bad format rejected');

console.log('Create order — server pricing');
const tampered = await call('POST', '/api/orders', {
  type: 'custom', paymentMethod: 'cod', referralCode: 'DXN-JS001', customer,
  items: [{ id: 'fb096', qty: 2, price: 1 }, { id: 'hf001', qty: 1, price: 1 }],
  totals: { grandTotal: 3 }, // ignored
});
ok(tampered.status === 201, `COD order created (${tampered.status})`);
const o1 = tampered.data.order;
ok(o1?.totals.grandTotal === fb096.price * 2 + hf001.price, `client prices ignored → ₱${o1?.totals.grandTotal}`);
ok(/^DXN-\d{6}-\d{4}$/.test(o1?.id) && typeof tampered.data.token === 'string' && tampered.data.token.length >= 32, `order number ${o1?.id} + access token`);
ok(o1?.payment.status === 'cod_pending' && o1.customer.mobile === '+63 917 555 0101', 'COD pending, mobile normalised');

const o2 = (await call('POST', '/api/orders', { type: 'mystery', mysteryQty: 2, paymentMethod: 'gcash', referralCode: 'DXNPH2026', customer })).data;
ok(o2.order?.totals.subtotal === 15998 && o2.order.payment.status === 'pending', 'Mystery Box ×2 = ₱15,998 subtotal, GCash pending');
const n1 = +o1.id.slice(-4), n2 = +o2.order.id.slice(-4);
ok(n2 === n1 + 1, `order numbers sequential (${o1.id} → ${o2.order.id})`);

console.log('Create order — validation');
ok((await call('POST', '/api/orders', { type: 'custom', paymentMethod: 'cod', referralCode: 'DXN-JS001', customer, items: [] })).status === 422, 'empty bundle → 422');
ok((await call('POST', '/api/orders', { type: 'custom', paymentMethod: 'cod', referralCode: 'DXN-JS001', customer, items: [{ id: 'nope', qty: 1 }] })).status === 409, 'unknown product → 409');
ok((await call('POST', '/api/orders', { type: 'custom', paymentMethod: 'cod', referralCode: 'DXN-JS001', customer, items: [{ id: 'fb096', qty: 500 }] })).status === 422, 'qty > 99 → 422');
const badRef = await call('POST', '/api/orders', { type: 'custom', paymentMethod: 'cod', referralCode: 'NOPE-123', customer, items: [{ id: 'fb096', qty: 1 }] });
ok(badRef.status === 422 && badRef.data.fields?.referral, 'invalid referral → 422 with field error');
const badFields = await call('POST', '/api/orders', { type: 'custom', paymentMethod: 'cod', referralCode: 'DXN-JS001', customer: { ...customer, mobile: '123', email: 'x' }, items: [{ id: 'fb096', qty: 1 }] });
ok(badFields.status === 422 && badFields.data.fields?.mobile && badFields.data.fields?.email, 'bad mobile/email → field errors');
ok((await call('POST', '/api/orders', { type: 'custom', paymentMethod: 'bitcoin', referralCode: 'DXN-JS001', customer, items: [{ id: 'fb096', qty: 1 }] })).status === 400, 'unknown payment method → 400');

console.log('Order access');
ok((await call('GET', `/api/orders/${o1.id}?t=${tampered.data.token}`)).data.order?.id === o1.id, 'GET with token → order');
ok((await call('GET', `/api/orders/${o1.id}`)).status === 404, 'GET without token → 404');
ok((await call('GET', `/api/orders/${o1.id}?t=${o2.token}`)).status === 404, 'GET with another order’s token → 404');

console.log('GCash via PayMongo (mock)');
const WH_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET || 'whsk_mock_dev_secret';
const { signPayload } = await import('../lib/paymongo.js');
const paidEvent = (cs, ref, amount, payId = 'pay_test_' + Date.now()) => JSON.stringify({ data: { id: 'evt_test', attributes: {
  type: 'checkout_session.payment.paid', livemode: false,
  data: { id: cs, attributes: { reference_number: ref, payments: [{ id: payId, attributes: { amount, status: 'paid' } }] } } } } });
const webhook = (body, sig = signPayload(body, WH_SECRET)) => fetch(BASE + '/api/webhooks/paymongo', { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': sig } });

const id2 = o2.order.id, t2 = o2.token;
const o3 = (await call('POST', '/api/orders', { type: 'custom', items: [{ id: 'fb205', qty: 1 }], paymentMethod: 'gcash', referralCode: 'DXN-JS002', customer })).data;
ok(o2.order.totals.paymentFee === Math.ceil(15998 * 250 / 10000) && o2.order.totals.grandTotal === 15998 + o2.order.totals.paymentFee,
  `GCash fee added server-side (₱${o2.order.totals.paymentFee}) → ₱${o2.order.totals.grandTotal}`);
ok(o1.totals.paymentFee === 0, 'COD has no payment fee');
const pay1 = await call('POST', `/api/orders/${id2}/pay`, { token: t2 });
ok(pay1.status === 200 && /\/dev\/paymongo-checkout\?cs=cs_mock_/.test(pay1.data.checkoutUrl || ''), 'checkout session created → redirect URL');
const pay2 = await call('POST', `/api/orders/${id2}/pay`, { token: t2 });
ok(pay2.data.checkoutUrl === pay1.data.checkoutUrl, 'active session reused (no duplicates)');
ok((await call('POST', `/api/orders/${id2}/pay`, { token: 'wrong' })).status === 404, 'wrong token → 404');
ok((await call('POST', `/api/orders/${o1.id}/pay`, { token: tampered.data.token })).status === 409, 'COD order cannot start GCash');
const cs = new URL(pay1.data.checkoutUrl).searchParams.get('cs');
const cents = o2.order.totals.grandTotal * 100;

ok((await webhook(paidEvent(cs, id2, cents), 't=1,te=deadbeef,li=')).status === 401, 'forged webhook signature → 401');
const stale = paidEvent(cs, id2, cents);
ok((await webhook(stale, signPayload(stale, WH_SECRET, Math.floor(Date.now() / 1000) - 3600))).status === 401, 'stale webhook timestamp → 401');
const short = await (await webhook(paidEvent(cs, id2, cents - 100))).json();
ok(short.applied === false && /does not match/.test(short.reason || ''), 'underpaid amount rejected');
ok((await call('GET', `/api/orders/${id2}?t=${t2}`)).data.order.payment.status === 'pending', '…order stays Pending');
const other = await (await webhook(paidEvent(cs, o3.order.id, cents))).json();
ok(other.applied === false, 'session paid for another order rejected');
const payOk = 'pay_test_ok_' + Date.now();
const good = await (await webhook(paidEvent(cs, id2, cents, payOk))).json();
ok(good.changed === true, 'valid webhook → order paid');
const paidOrder = (await call('GET', `/api/orders/${id2}?t=${t2}`)).data.order;
ok(paidOrder.payment.status === 'confirmed' && paidOrder.payment.paymentId === payOk && paidOrder.payment.paidAt, 'status Payment Confirmed + PayMongo payment id + paid time');
ok((await (await webhook(paidEvent(cs, id2, cents, payOk))).json()).changed === false, 'webhook replay is idempotent');
ok((await call('POST', `/api/orders/${id2}/pay`, { token: t2 })).status === 409, 'paid order cannot start a new checkout');
const ign = await (await webhook(JSON.stringify({ data: { attributes: { type: 'payment.refunded' } } }))).json();
ok(ign.ignored === 'payment.refunded', 'other event types acknowledged and ignored');

console.log('Sync on return (webhook delayed)');
const p3 = await call('POST', `/api/orders/${o3.order.id}/pay`, { token: o3.token });
const cs3 = new URL(p3.data.checkoutUrl).searchParams.get('cs');
await fetch(`${BASE}/dev/paymongo-pay?cs=${cs3}&nowebhook=1`, { redirect: 'manual' });
ok((await call('GET', `/api/orders/${o3.order.id}?t=${o3.token}`)).data.order.payment.status === 'pending', 'paid at PayMongo, no webhook yet → still pending');
ok((await call('GET', `/api/orders/${o3.order.id}?t=${o3.token}&sync=1`)).data.order.payment.status === 'confirmed', 'sync=1 asks PayMongo → confirmed');

console.log('Admin overrides');
const path2 = `/api/admin/orders/${id2}/payment-status`;
ok((await call('POST', path2, { status: 'failed' })).status === 401 || !ADMIN, 'no admin key → 401');
ok((await call('POST', path2, { status: 'failed' }, { 'x-admin-key': 'wrong-key-wrong-key' })).status === 401 || !ADMIN, 'wrong admin key → 401');
if (ADMIN) {
  const h = { 'x-admin-key': ADMIN };
  ok((await call('POST', path2, { status: 'shipped' }, h)).status === 400, 'invalid status → 400');
  const failed = await call('POST', path2, { status: 'failed', note: 'Refunded to customer.' }, h);
  ok(failed.data.order?.payment.status === 'failed' && failed.data.order.payment.note === 'Refunded to customer.', 'confirmed → failed (refund) with note');
  ok((await call('POST', path2, { status: 'failed' }, h)).status === 409, 'failed → failed refused');
  const back = await call('POST', path2, { status: 'confirmed', note: 'Resolved.' }, h);
  ok(back.data.order?.payment.status === 'confirmed', 'failed → confirmed');
  ok(back.data.order.payment.history.map((e) => e.status).join('>') === 'pending>confirmed>failed>confirmed', 'full status history');
  ok((await call('POST', `/api/admin/orders/${o1.id}/payment-status`, { status: 'failed' }, h)).status === 409, 'COD order cannot be marked failed → 409');
  ok((await call('GET', `/api/admin/orders/${o1.id}`, null, h)).data.order?.id === o1.id, 'admin API opens any order');
  ok((await call('GET', `/api/orders/${o1.id}`, null, h)).status === 404, 'store order endpoint ignores the admin key (token required)');
} else console.log('  (set ADMIN_API_KEY to test admin overrides)');
ok((await call('GET', `/api/admin/orders/${o1.id}`, null, { 'x-admin-key': 'wrong-key-wrong-key' })).status === 401 || !ADMIN, 'wrong admin key on GET → 401');

console.log('Misc');
ok((await call('GET', '/api/orders')).status === 405, 'GET /api/orders → 405');
ok((await call('GET', '/api/orders/not-an-id?t=x')).status === 404, 'malformed id → 404');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
