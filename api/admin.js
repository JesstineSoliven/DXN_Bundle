// /api/admin/* — every admin endpoint in one function (Vercel Hobby allows 12 functions per deployment).
// vercel.json rewrites /api/admin/<path> → /api/admin?path=<path>. All routes require the x-admin-key header.
import { handler, send, readJson, urlParts, siteUrl, HttpError } from '../lib/http.js';
import { requireAdmin } from '../lib/admin.js';
import { getOrderInternal, setOrderStatus, setPaymentStatus } from '../lib/orders.js';
import { listOrders, listCustomers, summary } from '../lib/admin/reports.js';
import * as catalog from '../lib/admin/catalog.js';
import { emailCustomerPaymentStatus, emailCustomerOrderStatus } from '../lib/emails.js';

const ORDER_ID = String.raw`(DXN-\d{6}-\d{4})`;
const routes = [
  ['GET', 'me', async () => ({ ok: true })],
  ['GET', 'summary', async (_m, _b, q) => summary({ days: q.get('days') })],
  ['GET', 'orders', async (_m, _b, q) => listOrders(Object.fromEntries(q))],
  ['GET', `orders/${ORDER_ID}`, async ([id]) => {
    const order = await getOrderInternal(id);
    if (!order) throw new HttpError(404, 'Order not found.');
    return { order };
  }],
  ['POST', `orders/${ORDER_ID}/status`, async ([id], b) => {
    const order = await setOrderStatus(id, b.status, b.note);
    await emailCustomerOrderStatus(order);
    return { order };
  }],
  ['POST', `orders/${ORDER_ID}/payment-status`, async ([id], b) => {
    const order = await setPaymentStatus(id, b.status, b.note);
    if (order.payment.method === 'gcash') await emailCustomerPaymentStatus(order);
    return { order };
  }],
  ['GET', 'customers', async (_m, _b, q) => ({ customers: await listCustomers(Object.fromEntries(q)) })],
  ['GET', 'products', async () => ({ products: await catalog.listProducts() })],
  ['POST', 'products', async (_m, b) => ({ product: await catalog.createProduct(b) })],
  ['PATCH', 'products/([a-z0-9-]{1,40})', async ([id], b) => ({ product: await catalog.updateProduct(id, b) })],
  ['GET', 'categories', async () => ({ categories: await catalog.listCategories() })],
  ['POST', 'categories', async (_m, b) => ({ category: await catalog.createCategory(b) })],
  ['PATCH', 'categories/([a-z0-9-]{1,40})', async ([id], b) => ({ category: await catalog.updateCategory(id, b) })],
  ['DELETE', 'categories/([a-z0-9-]{1,40})', async ([id]) => catalog.deleteCategory(id)],
  ['GET', 'referrals', async () => ({ referrals: await catalog.listReferrals() })],
  ['POST', 'referrals', async (_m, b) => ({ referral: await catalog.createReferral(b) })],
  ['PATCH', 'referrals/([A-Za-z0-9-]{1,20})', async ([code], b) => ({ referral: await catalog.updateReferral(code, b) })],
].map(([method, pattern, fn]) => ({ method, re: new RegExp(`^${pattern}$`), fn }));

export default handler(['GET', 'POST', 'PATCH', 'DELETE'], async (req, res) => {
  requireAdmin(req);
  const { segments, query } = urlParts(req);
  // Rewritten request: ?path=orders/DXN-…/status ; direct request: /api/admin/orders/…
  const path = (query.get('path') ?? segments.slice(2).join('/')).replace(/^\/+|\/+$/g, '');
  query.delete('path');
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(path);
    if (!m) continue;
    const body = ['POST', 'PATCH'].includes(req.method) ? await readJson(req) : {};
    return send(res, ['POST'].includes(req.method) && !path.includes('/') ? 201 : 200, await r.fn(m.slice(1), body, query, siteUrl(req)));
  }
  throw new HttpError(404, 'Unknown admin endpoint.');
});
