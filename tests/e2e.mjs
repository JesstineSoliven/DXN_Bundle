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

console.log('GCash flow');
await go('#/customize');
await click('[data-action="add"][data-id="hf001"]');
await go('#/checkout'); await sleep(400);
await fillCheckout({ name: 'Maria Santos', email: 'maria@example.com', referral: 'DXN-JS002' });
await click('input[name=payment][value=gcash]');
ok((await txt('[data-pay-note]')).includes('GCash QR'), 'GCash pay note');
await click('[data-place-order]');
ok(await waitHash(/^#\/pay\/DXN-/), 'order placed → payment page');
const id2 = (await hash()).split('/')[2].split('?')[0];
await waitText('#app', 'Pending Payment');
ok((await txt('#app')).includes(peso(price('hf001'))) && (await txt('#app')).includes('Jesstine Soliven'), 'amount due + GCash account');
ok(await p.$eval('#app img[alt^="GCash QR"]', (i) => i.complete && i.naturalWidth > 0), 'QR image loads');
await setVal('#pay-reference', '123'); await click('[data-submit-proof]'); await sleep(800);
ok(await visible('#pay-reference-err'), 'short reference rejected');
const refNo = String(Date.now()).slice(-13).padStart(13, '1');
await setVal('#pay-reference', refNo);
await click('[data-submit-proof]');
ok(await waitHash(/^#\/order\/DXN-/) && await waitText('[data-pay-status]', 'Payment Submitted'), 'proof submitted → Payment Submitted');
ok(mailLogged(`GCash payment submitted — ${id2}`), 'admin "payment submitted" email attempted');

console.log('Admin verification (demo panel)');
await go(`#/order/${id2}?demo=1`); await waitText('#app', 'Admin key');
await setVal('[data-admin-key]', 'wrong-key-wrong-key'); await click('[data-demo-status="failed"]'); await sleep(800);
ok(await visible('[data-demo-error]') && (await txt('[data-demo-error]')).includes('Invalid admin key'), 'wrong admin key refused');
if (ADMIN) {
  await setVal('[data-admin-key]', ADMIN); await click('[data-demo-status="failed"]');
  ok(await waitText('[data-pay-status]', 'Payment Failed') && (await txt('#app')).includes('Resubmit Payment'), 'marked Failed → resubmit CTA');
  await go(`#/pay/${id2}`); await waitText('#app', 'Payment Failed');
  await setVal('#pay-reference', refNo.replace(/.$/, refNo.endsWith('9') ? '8' : '9'));
  await click('[data-submit-proof]'); await waitHash(/^#\/order\/DXN-/);
  await go(`#/order/${id2}?demo=1`); await waitText('#app', 'Admin key');
  ok(await p.$eval('[data-admin-key]', (i) => i.value) === ADMIN, 'admin key remembered for the session');
  await click('[data-demo-status="confirmed"]');
  ok(await waitText('[data-pay-status]', 'Payment Confirmed'), 'marked Confirmed');
  const o2 = await apiOrder(id2);
  ok(o2.payment.history.map((h) => h.status).join('>') === 'pending>submitted>failed>submitted>confirmed', 'status history in the database');
  ok(mailLogged(`Payment confirmed — order ${id2}`), 'customer confirmation email attempted');
} else console.log('  (set ADMIN_API_KEY to test admin transitions)');

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
