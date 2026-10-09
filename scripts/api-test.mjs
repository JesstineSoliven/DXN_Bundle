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
ok(cat.status === 200 && cat.data.products.length === 154 && cat.data.categories.length === 9, `154 products, 9 categories (got ${cat.data.products?.length})`);
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
ok(o2.order?.totals.grandTotal === 15998 && o2.order.payment.status === 'pending', 'Mystery Box ×2 = ₱15,998, GCash pending');
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

console.log('GCash payment');
const id2 = o2.order.id, t2 = o2.token;
const bad = await call('POST', `/api/orders/${id2}/payment`, { token: t2, reference: '123', senderName: 'A', senderMobile: '1' });
ok(bad.status === 422 && bad.data.fields?.reference && bad.data.fields?.senderMobile, 'bad proof → field errors');
ok((await call('POST', `/api/orders/${id2}/payment`, { token: 'wrong', reference: '1234567890123', senderName: 'API Test', senderMobile: '09175550101' })).status === 404, 'wrong token → 404');
const refNo = ref13();
const sub = await call('POST', `/api/orders/${id2}/payment`, { token: t2, reference: refNo, senderName: 'API Test', senderMobile: '0917 555 0101' });
ok(sub.status === 200 && sub.data.order.payment.status === 'submitted' && sub.data.order.payment.proof.reference === refNo, 'proof accepted → submitted');
ok((await call('POST', `/api/orders/${id2}/payment`, { token: t2, reference: refNo, senderName: 'API Test', senderMobile: '09175550101' })).status === 409, 'second submit → 409');
ok((await call('POST', `/api/orders/${o1.id}/payment`, { token: tampered.data.token, reference: ref13(), senderName: 'API Test', senderMobile: '09175550101' })).status === 409, 'COD order cannot take GCash proof');

const o3 = (await call('POST', '/api/orders', { type: 'custom', items: [{ id: 'fb205', qty: 1 }], paymentMethod: 'gcash', referralCode: 'DXN-JS002', customer })).data;
const dupe = await call('POST', `/api/orders/${o3.order.id}/payment`, { token: o3.token, reference: refNo, senderName: 'API Test', senderMobile: '09175550101' });
ok(dupe.status === 422 && /already used/.test(dupe.data.fields?.reference || ''), 'reference reused on another order → rejected');

console.log('Admin payment status');
const path2 = `/api/admin/orders/${id2}/payment-status`;
ok((await call('POST', path2, { status: 'confirmed' })).status === 401 || !ADMIN, 'no admin key → 401');
ok((await call('POST', path2, { status: 'confirmed' }, { 'x-admin-key': 'wrong-key-wrong-key' })).status === 401 || !ADMIN, 'wrong admin key → 401');
if (ADMIN) {
  const h = { 'x-admin-key': ADMIN };
  ok((await call('POST', path2, { status: 'shipped' }, h)).status === 400, 'invalid status → 400');
  const failed = await call('POST', path2, { status: 'failed', note: 'Not found in GCash.' }, h);
  ok(failed.data.order?.payment.status === 'failed' && failed.data.order.payment.note === 'Not found in GCash.', 'mark failed (with note)');
  const resub = await call('POST', `/api/orders/${id2}/payment`, { token: t2, reference: ref13().replace(/.$/, '9'), senderName: 'API Test', senderMobile: '09175550101' });
  ok(resub.data.order?.payment.status === 'submitted', 'customer resubmits after failure');
  const conf = await call('POST', path2, { status: 'confirmed', note: 'Verified.' }, h);
  ok(conf.data.order?.payment.status === 'confirmed', 'mark confirmed');
  ok(conf.data.order.payment.history.map((e) => e.status).join('>') === 'pending>submitted>failed>submitted>confirmed', 'full status history');
  ok((await call('POST', path2, { status: 'failed' }, h)).status === 409, 'confirmed cannot change again → 409');
  ok((await call('POST', `/api/admin/orders/${o1.id}/payment-status`, { status: 'confirmed' }, h)).status === 409, 'COD order not confirmable here → 409');
  ok((await call('GET', `/api/orders/${o1.id}`, null, h)).data.order?.id === o1.id, 'admin key opens any order (no token)');
} else console.log('  (set ADMIN_API_KEY to test admin transitions)');
ok((await call('GET', `/api/orders/${o1.id}`, null, { 'x-admin-key': 'wrong-key-wrong-key' })).status === 401 || !ADMIN, 'wrong admin key on GET → 401');

console.log('Misc');
ok((await call('GET', '/api/orders')).status === 405, 'GET /api/orders → 405');
ok((await call('GET', '/api/orders/not-an-id?t=x')).status === 404, 'malformed id → 404');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
