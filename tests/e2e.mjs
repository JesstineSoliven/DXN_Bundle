// Browser end-to-end test: bundle builder → checkout (COD) → GCash payment → admin verification → Mystery Box.
// Requires the dev server (npm run dev, started with ADMIN_API_KEY and logging to .data/dev-server.log).
// Usage: ADMIN_API_KEY=… node tests/e2e.mjs [--mobile]
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire('C:/Users/Jess/Desktop/Claude/Optivion/package.json'); // same Puppeteer as screenshot.mjs
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://localhost:3001/';
const ADMIN = process.env.ADMIN_API_KEY || '';
const MAIL_LOG = process.env.MAIL_LOG || '.data/dev-server.log';
const mobile = process.argv.includes('--mobile');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const peso = (n) => '₱' + n.toLocaleString('en-PH');
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(cond ? '  ✓' : '  ✗', msg); };

const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errs.push(m.text()));
await p.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });

const go = async (h) => { await p.evaluate((h) => (location.hash = h), h); await sleep(400); };
const click = async (sel) => { await p.$eval(sel, (el) => el.click()); await sleep(180); };
const txt = (sel) => p.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
const hash = () => p.evaluate(() => location.hash);
const visible = (sel) => p.$eval(sel, (el) => !el.hidden && el.offsetParent !== null).catch(() => false);
const setVal = (sel, v) => p.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }, v);
const waitHash = async (re, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (re.test(await hash())) return true; await sleep(150); } return false; };
const waitText = async (sel, s, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await txt(sel).catch(() => '')).includes(s)) return true; await sleep(150); } return false; };
const total = () => p.$eval('[data-bar]', (el) => el.querySelector('.font-price').textContent.trim());
const badge = () => txt('[data-cart-count]');
const mailLogged = (s) => existsSync(MAIL_LOG) && readFileSync(MAIL_LOG, 'utf8').includes(s);
const apiOrder = (id) => p.evaluate(async (id) => {
  const t = JSON.parse(localStorage.getItem('dxn.myOrders') || '{}')[id];
  return (await (await fetch(`/api/orders/${id}?t=${encodeURIComponent(t)}`)).json()).order;
}, id);
async function fillCheckout(extra = {}) {
  const v = { name: 'Juan Dela Cruz', mobile: '0917-123-4567', email: 'Juan@Example.com', street: '123 Rizal St.', barangay: 'San Antonio', city: 'Quezon City', province: 'Metro Manila', zip: '1100', referral: 'DXN-JS001', ...extra };
  for (const [k, val] of Object.entries(v)) await setVal(`#co-${k}`, val);
}

const catalog = await (await fetch(new URL('/api/catalog', BASE))).json();
const price = (id) => catalog.products.find((x) => x.id === id).price;

await p.goto(BASE, { waitUntil: 'networkidle0' });
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); location.hash = '#/customize'; });
await p.reload({ waitUntil: 'networkidle0' }); await sleep(500);
console.log(`E2E (${mobile ? 'mobile' : 'desktop'}) → ${BASE}`);

console.log('Catalog from API');
ok((await p.$$('[data-grid] article')).length === catalog.products.length, `customize lists all ${catalog.products.length} products from the database`);

console.log('Bundle builder — any amount');
await click('[data-action="add"][data-id="fb096"]'); await click('[data-action="add"][data-id="fb096"]');
await click('[data-action="toggle"][data-id="hf127"]');
const A = price('fb096') * 2 + price('hf127');
ok(await total() === peso(A) && await badge() === '3', `${peso(A)} bundle, badge 3`);
ok((await txt('[data-bar]')).includes(`${Math.round(A / 7999 * 100)}% of ₱7,999`), 'progress toward ₱7,999 reference');
await p.type('#bundle-search', 'morinzhi'); await sleep(350);
ok((await p.$$('[data-grid] article')).length === 2, 'search "morinzhi" → 2');
await click('[data-clear-filters]');
await click('[data-chips] [data-cat="skincare"]');
ok((await p.$$('[data-grid] article')).length === 17, 'Skincare chip → 17');
await click('[data-chips] [data-cat="all"]');

console.log('Checkout (COD) → server');
await go('#/review'); await click('[data-review] a[href="#/checkout"]'); await sleep(400);
ok(!!(await p.$('#checkout-form')) && (await txt('#app aside')).includes(peso(A)) && (await txt('#app aside')).includes('FREE'), 'checkout summary: total + FREE delivery');
await click('[data-place-order]'); await sleep(600);
ok((await p.$$eval('.field-error:not([hidden])', (e) => e.length)) >= 8 && (await hash()) === '#/checkout', 'empty form blocked with inline errors');
await fillCheckout({ referral: 'NOPE-123' });
await click('[data-verify]'); await waitText('#co-referral-err', 'couldn’t find');
ok(await visible('#co-referral-err'), 'unknown referral rejected by the server');
await setVal('#co-referral', ' dxn-js001 '); await click('[data-verify]');
ok(await waitText('#co-referral-ok', 'Sample Referrer A'), 'valid referral verified by the server');
await click('[data-place-order]');
ok(await waitHash(/^#\/order\/DXN-\d{6}-\d{4}\?t=/), `order placed → ${await hash()}`);
const id1 = (await hash()).split('/')[2].split('?')[0];
ok(await waitText('#app', 'Thank you, Juan!') && (await txt('#app')).includes(`please prepare ${peso(A)}`), 'confirmation page from the API (COD)');
const o1 = await apiOrder(id1);
ok(o1.totals.grandTotal === A && o1.payment.status === 'cod_pending' && o1.customer.email === 'juan@example.com', 'order stored in the database');
ok(await badge() === '0', 'bundle cleared');
ok(mailLogged(`New order ${id1}`), 'admin "new order" email attempted (mail log)');

console.log('GCash via PayMongo (mock checkout)');
await go('#/customize');
await click('[data-action="add"][data-id="hf001"]');
await go('#/checkout'); await sleep(400);
await fillCheckout({ name: 'Maria Santos', email: 'maria@example.com', referral: 'DXN-JS002' });
ok(!(await visible('[data-fee-row]')), 'COD: no convenience fee row');
await click('input[name=payment][value=gcash]');
const sub = price('hf001'), fee = Math.ceil(sub * 250 / 10000);
ok(await visible('[data-fee-row]') && (await txt('[data-fee]')) === peso(fee) && (await txt('[data-grand]')) === peso(sub + fee), `GCash: fee ${peso(fee)} shown, total ${peso(sub + fee)}`);
ok((await txt('[data-pay-note]')).includes(`pay exactly ${peso(sub + fee)}`), 'pay note: exact amount in GCash');
await click('[data-place-order]');
const toMock = async () => { const t = Date.now(); while (Date.now() - t < 8000) { if (p.url().includes('/dev/paymongo-checkout')) return true; await sleep(150); } return false; };
ok(await toMock(), 'redirected to the (mock) PayMongo GCash checkout');
ok((await txt('#amount')) === peso(sub + fee), 'checkout shows the exact amount');
const id2 = await p.evaluate(() => document.querySelector('p:nth-of-type(2)')?.textContent.trim());
await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('#pay')]);
ok(await waitHash(/^#\/order\/DXN-.*paid=1/), 'returned to the order page after paying');
ok(await waitText('[data-pay-status]', 'Payment Confirmed') && (await txt('#app')).includes('Payment confirmed'), 'Payment Confirmed automatically (webhook)');
ok((await txt('#app')).includes('GCash convenience fee'), 'fee line on the order page');
ok(mailLogged(`Payment received — ${id2}`), 'admin "payment received" email attempted');
ok(mailLogged(`Payment confirmed — order ${id2}`), 'customer "payment confirmed" email attempted');

console.log('GCash cancel → try again (delayed webhook → sync)');
await go('#/customize');
await click('[data-action="add"][data-id="fb205"]');
await go('#/checkout'); await sleep(400);
await fillCheckout({ name: 'Maria Santos', email: 'maria@example.com', referral: 'DXN-JS002' });
await click('input[name=payment][value=gcash]');
await click('[data-place-order]');
ok(await toMock(), 'redirected to checkout');
await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('#cancel')]);
ok(await waitHash(/^#\/pay\/DXN-.*cancelled=1/) && await waitText('#app', 'Payment cancelled'), 'cancel → back on site: "Payment cancelled", order kept');
ok(!p.url().includes('/dev/paymongo-checkout'), 'no automatic redirect after cancelling');
await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('[data-start-pay]')]);
ok(p.url().includes('/dev/paymongo-checkout'), 'Try Again → GCash checkout');
await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('#pay-nowebhook')]);
ok(await waitText('[data-pay-status]', 'Payment Confirmed', 12000), 'webhook delayed → page re-checks with PayMongo → Payment Confirmed');
const id3 = (await hash()).split('/')[2].split('?')[0];

console.log('Admin override (demo panel)');
await go(`#/order/${id3}?demo=1`); await waitText('#app', 'Admin key');
await setVal('[data-admin-key]', 'wrong-key-wrong-key'); await click('[data-demo-status="failed"]'); await sleep(800);
ok(await visible('[data-demo-error]') && (await txt('[data-demo-error]')).includes('Invalid admin key'), 'wrong admin key refused');
if (ADMIN) {
  await setVal('[data-admin-key]', ADMIN); await click('[data-demo-status="failed"]');
  ok(await waitText('[data-pay-status]', 'Payment Failed') && (await txt('#app')).includes('Try Again'), 'override → Payment Failed (+ Try Again for customer)');
  await go(`#/order/${id3}?demo=1`); await waitText('#app', 'Admin key');
  ok(await p.$eval('[data-admin-key]', (i) => i.value) === ADMIN, 'admin key remembered for the session');
  await click('[data-demo-status="confirmed"]');
  ok(await waitText('[data-pay-status]', 'Payment Confirmed'), 'override → Payment Confirmed');
  const o3 = await apiOrder(id3);
  ok(o3.payment.history.map((h) => h.status).join('>') === 'pending>confirmed>failed>confirmed', 'status history in the database');
} else console.log('  (set ADMIN_API_KEY to test admin overrides)');

console.log('Mystery Box');
await go('#/mystery-box'); await click('[data-get-mystery]'); await sleep(400);
await click('[data-mystery="inc"]');
ok((await txt('[data-review]')).includes('₱15,998'), '2 boxes → ₱15,998');
await click('[data-review] a[href="#/checkout?type=mystery"]'); await sleep(400);
await fillCheckout({ name: 'Ana Reyes', email: 'ana@example.com', referral: 'DXNPH2026' });
await click('[data-place-order]');
ok(await waitHash(/^#\/order\/DXN-/) && await waitText('#app', 'DXN Mystery Box'), 'Mystery Box order placed');
const o3 = await apiOrder((await hash()).split('/')[2].split('?')[0]);
ok(o3.type === 'mystery' && o3.totals.grandTotal === 15998, 'mystery order stored (₱15,998)');

console.log('Access control');
await go(`#/order/${id1}?t=bogus`);
ok(await waitText('#app', 'Order not found'), 'wrong token → not found');
await p.evaluate(() => localStorage.removeItem('dxn.myOrders'));
await go(`#/order/${id1}`);
ok(await waitText('#app', 'Order not found'), 'no token on this device → not found');
if (ADMIN) {
  await p.evaluate(() => sessionStorage.clear());
  await go(`#/order/${id1}?demo=1`);
  ok(await waitText('#app', 'Enter your admin key'), 'admin link without key → unlock form');
  await setVal('#unlock-key', ADMIN); await click('[data-admin-unlock] button[type=submit]');
  ok(await waitText('#app', 'Thank you, Juan!'), 'admin key unlocks the order');
}

console.log(`\n${pass} passed, ${fail} failed; console errors: ${errs.length ? errs.join(' | ') : 'none'}`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
