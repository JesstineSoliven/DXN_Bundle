// Admin dashboard browser test. Usage: ADMIN_API_KEY=… node tests/admin-e2e.mjs [--mobile]   (dev server running)
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Jess/Desktop/Claude/Optivion/package.json');
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://localhost:3001';
const KEY = process.env.ADMIN_API_KEY;
const mobile = process.argv.includes('--mobile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };

const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errs.push(m.text()));
await p.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });

const txt = (s) => p.$eval(s, (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const go = async (h) => { await p.evaluate((h) => (location.hash = h), h); await sleep(600); };
const waitText = async (s, t, ms = 8000) => { const st = Date.now(); while (Date.now() - st < ms) { if ((await txt(s)).includes(t)) return true; await sleep(150); } return false; };
const click = async (s) => { await p.$eval(s, (el) => el.click()); await sleep(250); };
const type = async (s, v) => { await p.$eval(s, (el) => { el.value = ''; el.focus(); }); await p.type(s, String(v)); };
const toastHas = (t) => waitText('#toast', t, 5000);

// A fresh COD order to work on
const order = await (await fetch(`${BASE}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
  type: 'custom', items: [{ id: 'fb096', qty: 1 }], paymentMethod: 'cod', referralCode: 'DXN-JS001',
  customer: { name: 'UI Test', mobile: '0917 555 0177', email: 'ui-test@example.com', street: '1 Test St.', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', zip: '', notes: 'Leave at gate' } }) })).json();
const oid = order.order.id;

console.log(`Admin UI (${mobile ? 'mobile' : 'desktop'}) → ${BASE}/admin`);
await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle0' });
await p.evaluate(() => sessionStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });

console.log('Sign in');
ok(!!(await p.$('[data-login]')), 'login screen shown without a key');
await type('#admin-key', 'wrong-key-wrong-key'); await click('[data-login] button');
ok(await waitText('[data-login-error]', 'isn’t valid'), 'wrong key rejected');
await type('#admin-key', KEY); await click('[data-login] button');
ok(await waitText('#adm-main', 'Paid revenue per day'), 'signed in → dashboard');

console.log('Dashboard');
ok((await p.$$('.kpi')).length === 6 && (await p.$$('.kpi-hero')).length === 1, '6 KPI tiles, one hero figure');
ok((await p.$$('.chart .hit')).length === 30, 'chart: 30 daily slots');
if (!mobile) {
  const hit = await p.$('.chart .hit:last-of-type');
  const box = await (await p.$$('.chart .hit')).at(-1).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await sleep(200);
  ok((await p.$eval('[data-tip]', (t) => t.classList.contains('is-visible') && t.textContent.includes('paid'))), 'hover tooltip shows the day’s revenue');
}
await click('[data-toggle-table]');
ok((await p.$$('[data-table] tbody tr')).length === 30, '"View as table" shows 30 rows');
await go('#/dashboard?days=7');
ok(await waitText('#adm-main', 'Last 7 days') && (await p.$$('.chart .hit')).length === 7, 'period switch → 7 days');

console.log('Orders');
await go(`#/orders?q=${oid}`);
ok(await waitText('#adm-main', '1 order') && (await txt('tbody')).includes(oid), 'search finds the order');
await click('tbody tr');
ok(await waitText('#adm-main', `Order ${oid}`) && (await txt('#adm-main')).includes('Leave at gate'), 'order detail with customer notes');
await click('[data-status="processing"]');
ok(await toastHas('Processing'), 'mark Processing');
await waitText('#adm-main', 'Mark Shipped');
await type('[data-status-note]', 'J&T 556677');
await click('[data-status="shipped"]');
ok(await toastHas('customer emailed'), 'mark Shipped → customer emailed');
ok(await waitText('#adm-main', 'J&T 556677'), 'note in the status history');
await waitText('#adm-main', 'Mark cash collected');
await click('[data-pay="confirmed"]');
ok(await toastHas('Payment Confirmed'), 'COD: mark cash collected');
await waitText('#adm-main', 'Mark Delivered');
await click('[data-status="delivered"]');
ok(await waitText('#adm-main', 'No further steps'), 'delivered → no further steps');

console.log('Products');
await go('#/products');
await type('[data-search]', 'FB096'); await sleep(400);
ok((await p.$$('[data-rows] tr')).length === 1, 'search by code');
const priceSel = '#price-fb096';
await type(priceSel, '445'); await p.keyboard.press('Enter');
ok(await toastHas('FB096 price updated to ₱445'), 'inline price edit (Enter saves)');
const cat = await (await fetch(`${BASE}/api/catalog`)).json();
ok(cat.products.find((x) => x.id === 'fb096').price === 445, 'store catalog shows ₱445');
await type(priceSel, '430'); await p.keyboard.press('Enter'); await toastHas('₱430');
await click('[data-add]');
const code = `UI${Date.now().toString(36).toUpperCase().slice(-5)}`;
await type('[data-product-form] [name=code]', code);
await type('[data-product-form] [name=name]', 'UI Test Product');
await type('[data-product-form] [name=price]', '0');
await click('[data-save]');
ok(await waitText('[data-form-error]', 'price'), 'dialog validates price');
await type('[data-product-form] [name=price]', '150');
await click('[data-save]');
ok(await toastHas(`${code} added`), 'add product via dialog');
await type('[data-search]', code); await sleep(400);
await click('[data-rows] [data-toggle]');
ok(await toastHas('archived'), 'archive product');

console.log('Categories');
await go('#/categories');
const cname = `UI Cat ${Date.now().toString(36).slice(-4)}`;
await type('[data-add-form] [name=name]', cname); await click('[data-add-form] button[type=submit]');
ok(await toastHas('Category added'), 'add category');
await sleep(600);
ok((await p.$$eval('[data-rows] [data-name]', (els) => els.map((e) => e.value))).includes(cname), 'new category listed');
const ids = await p.$$eval('[data-rows] tr', (rs) => rs.map((r) => r.dataset.id));
const newId = ids.at(-1);
await click(`tr[data-id="${newId}"] [data-move="-1"]`);
await sleep(900);
const ids2 = await p.$$eval('[data-rows] tr', (rs) => rs.map((r) => r.dataset.id));
ok(ids2.indexOf(newId) === ids.indexOf(newId) - 1, 'move category up');
await click(`tr[data-id="${newId}"] [data-delete]`);
await click(`tr[data-id="${newId}"] [data-delete]`);
ok(await toastHas('Category deleted'), 'delete (two-click confirm)');

console.log('Referral codes');
await go('#/referrals');
const rc = `UI-${Date.now().toString(36).toUpperCase().slice(-5)}`;
await type('[data-add-form] [name=code]', rc); await type('[data-add-form] [name=referrerName]', 'UI Referrer');
await click('[data-add-form] button[type=submit]');
ok(await toastHas(`${rc} added`), 'add referral code');
await sleep(500);
await click(`tr[data-code="${rc}"] [data-active]`);
ok(await toastHas('turned off'), 'turn code off');

console.log('Customers');
await go('#/customers?q=ui-test@example.com');
ok(await waitText('#adm-main', 'UI Test'), 'customer search');
await click('tbody tr');
ok(await waitText('#adm-main', 'for this customer') && (await txt('tbody')).includes(oid), "customer's orders");

if (mobile) {
  console.log('Mobile navigation');
  await click('[data-menu]');
  ok(await p.$eval('[data-side]', (s) => s.classList.contains('is-open')), 'menu opens');
  await click('[data-nav="products"]');
  ok(await waitText('#adm-main', 'Products') && !(await p.$eval('[data-side]', (s) => s.classList.contains('is-open'))), 'menu closes after navigating');
}

console.log('Sign out');
await click('[data-logout]');
ok(!!(await p.$('[data-login]')) && !(await p.evaluate(() => sessionStorage.getItem('dxn.adminKey'))), 'signed out, key cleared');

console.log(`\n${pass} passed, ${fail} failed; console errors: ${errs.length ? errs.join(' | ') : 'none'}`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
