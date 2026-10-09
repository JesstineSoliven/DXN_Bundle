// Admin API test. Usage: DATABASE_URL= ADMIN_API_KEY=… node scripts/admin-test.mjs   (dev server running)
// Creates test orders/products/referral codes in the target database — run against the local dev database.
import './env.mjs';

const BASE = process.env.BASE || 'http://localhost:3001';
const KEY = process.env.ADMIN_API_KEY;
if (!KEY) { console.error('Set ADMIN_API_KEY'); process.exit(1); }
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
async function call(method, path, body, key = KEY) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(key ? { 'x-admin-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}
const A = (m, p, b, k) => call(m, `/api/admin/${p}`, b, k);
const run = Date.now().toString(36).toUpperCase().slice(-5);
const customer = { name: 'Admin Test', mobile: '0917 555 0199', email: 'admin-test@example.com', street: '1 Test St.', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '', notes: '' };
const newOrder = (method = 'cod', items = [{ id: 'fb205', qty: 2 }]) => call('POST', '/api/orders', { type: 'custom', items, paymentMethod: method, referralCode: 'DXN-JS001', customer }, null).then((r) => r.data);

console.log(`Admin API → ${BASE}`);
console.log('Auth');
ok((await A('GET', 'me', null, null)).status === 401, 'no key → 401');
ok((await A('GET', 'me', null, 'wrong-key-wrong-key')).status === 401, 'wrong key → 401');
ok((await A('GET', 'me')).data.ok === true, 'valid key → ok');
ok((await A('GET', 'nope')).status === 404, 'unknown endpoint → 404');

console.log('Summary');
const before = (await A('GET', 'summary?days=30')).data;
ok(before.days === 30 && before.daily.length === 30 && typeof before.kpis.revenuePeriod === 'number', '30-day summary with daily series');

console.log('Orders: fulfilment + COD payment');
const o = await newOrder('cod');
const id = o.order.id;
const list = (await A('GET', `orders?q=${id}`)).data;
ok(list.total === 1 && list.orders[0].id === id, 'search by order number');
ok((await A('GET', `orders?status=placed&method=cod&limit=5`)).data.orders.every((x) => x.status === 'placed' && x.paymentMethod === 'cod'), 'filter by status + method');
ok((await A('POST', `orders/${id}/status`, { status: 'delivered' })).status === 409, 'placed → delivered refused (must ship first)');
ok((await A('POST', `orders/${id}/status`, { status: 'bogus' })).status === 400, 'unknown status → 400');
ok((await A('POST', `orders/${id}/status`, { status: 'processing' })).data.order.status === 'processing', 'placed → processing');
const shipped = (await A('POST', `orders/${id}/status`, { status: 'shipped', note: 'LBC 123' })).data.order;
ok(shipped.status === 'shipped' && shipped.statusHistory.at(-1).note === 'LBC 123', 'processing → shipped (with note)');
ok((await A('POST', `orders/${id}/status`, { status: 'delivered' })).data.order.status === 'delivered', 'shipped → delivered');
ok((await A('POST', `orders/${id}/status`, { status: 'cancelled' })).status === 409, 'delivered is final');
const paid = (await A('POST', `orders/${id}/payment-status`, { status: 'confirmed', note: 'Cash collected.' })).data.order;
ok(paid.payment.status === 'confirmed' && paid.payment.paidAt, 'COD cash collected → Payment Confirmed');
ok((await A('POST', `orders/${id}/payment-status`, { status: 'failed' })).status === 409, 'COD cannot be marked failed');
ok((await A('POST', `orders/${id}/payment-status`, { status: 'cod_pending' })).data.order.payment.status === 'cod_pending', 'undo cash collected');
await A('POST', `orders/${id}/payment-status`, { status: 'confirmed' });
const detail = (await A('GET', `orders/${id}`)).data.order;
ok(detail.statusHistory.map((h) => h.status).join('>') === 'placed>processing>shipped>delivered', 'status history');
const after = (await A('GET', 'summary?days=30')).data;
ok(after.kpis.revenuePeriod === before.kpis.revenuePeriod + o.order.totals.grandTotal, `revenue includes the paid COD order (+₱${o.order.totals.grandTotal})`);
const c = await newOrder('cod');
ok((await A('POST', `orders/${c.order.id}/status`, { status: 'cancelled', note: 'Customer request' })).data.order.status === 'cancelled', 'placed → cancelled');
ok((await A('POST', `orders/${c.order.id}/status`, { status: 'processing' })).status === 409, 'cancelled is final');

console.log('Products');
const code = `ZT${run}`;
ok((await A('POST', 'products', { code, name: 'Test Product', category: 'nope', price: 100 })).status === 422, 'unknown category → 422');
ok((await A('POST', 'products', { code, name: 'Test Product', category: 'food', price: -5 })).status === 422, 'negative price → 422');
ok((await A('POST', 'products', { code, name: 'Test', category: 'food', price: 100, image: 'javascript:alert(1)' })).status === 422, 'unsafe image URL → 422');
const created = await A('POST', 'products', { code, name: 'Test Product', size: '1 pack', category: 'food', price: 199 });
ok(created.status === 201 && created.data.product.id === code.toLowerCase(), `create ${code}`);
ok((await A('POST', 'products', { code, name: 'Dup', category: 'food', price: 1 })).status === 409, 'duplicate code → 409');
let cat = (await call('GET', '/api/catalog')).data;
ok(cat.products.some((p) => p.code === code && p.price === 199), 'new product appears in the store catalog');
ok((await A('PATCH', `products/${code.toLowerCase()}`, { price: 249 })).data.product.price === 249, 'price update');
const priced = await call('POST', '/api/orders', { type: 'custom', items: [{ id: code.toLowerCase(), qty: 1 }], paymentMethod: 'cod', referralCode: 'DXN-JS001', customer });
ok(priced.data.order?.totals.subtotal === 249, 'checkout uses the new price (₱249)');
ok((await A('PATCH', `products/${code.toLowerCase()}`, { active: false })).data.product.active === false, 'archive');
cat = (await call('GET', '/api/catalog')).data;
ok(!cat.products.some((p) => p.code === code), 'archived product hidden from the store');
ok((await call('POST', '/api/orders', { type: 'custom', items: [{ id: code.toLowerCase(), qty: 1 }], paymentMethod: 'cod', referralCode: 'DXN-JS001', customer })).status === 409, 'archived product cannot be ordered');
const prods = (await A('GET', 'products')).data.products;
ok(prods.find((p) => p.id === code.toLowerCase())?.unitsSold === 1, 'units sold tracked per product');
ok((await A('PATCH', 'products/does-not-exist', { price: 5 })).status === 404, 'unknown product → 404');

console.log('Categories');
const cname = `Test Cat ${run}`;
const cc = await A('POST', 'categories', { name: cname });
ok(cc.status === 201 && cc.data.category.name === cname, 'create category');
const cid = cc.data.category.id;
ok((await A('POST', 'categories', { name: cname })).status === 409, 'duplicate category → 409');
ok((await A('PATCH', `categories/${cid}`, { name: `${cname} Renamed` })).data.category.name === `${cname} Renamed`, 'rename');
ok((await call('GET', '/api/catalog')).data.categories.some((x) => x.name === `${cname} Renamed`), 'store sees the renamed category');
ok((await A('DELETE', 'categories/beverages')).status === 409, 'non-empty category cannot be deleted');
ok((await A('DELETE', `categories/${cid}`)).data.deleted === cid, 'delete empty category');

console.log('Referral codes');
const rcode = `T-${run}`;
ok((await A('POST', 'referrals', { code: 'x', referrerName: 'A' })).status === 422, 'bad code format → 422');
ok((await A('POST', 'referrals', { code: rcode.toLowerCase(), referrerName: 'Ana Test' })).data.referral?.code === rcode, 'create (normalised to upper case)');
ok((await A('POST', 'referrals', { code: rcode, referrerName: 'Again' })).status === 409, 'duplicate → 409');
ok((await call('POST', '/api/referrals/validate', { code: rcode }, null)).data.referrer === 'Ana Test', 'store accepts the new code');
await A('PATCH', `referrals/${rcode}`, { active: false });
ok((await call('POST', '/api/referrals/validate', { code: rcode }, null)).data.valid === false, 'deactivated code rejected at checkout');
const refs = (await A('GET', 'referrals')).data.referrals;
ok(refs.find((r) => r.code === 'DXN-JS001')?.orders >= 3, 'referral order counts');

console.log('Customers');
const cs = (await A('GET', 'customers?q=admin-test@example.com')).data.customers;
ok(cs.length === 1 && cs[0].orders >= 3, 'customer search + order count');
ok((await A('GET', `orders?customer=${cs[0].id}`)).data.orders.every((x) => x.customerName === 'Admin Test'), "customer's orders");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
