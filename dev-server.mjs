// Local full-stack server: static site + /api functions with Vercel-style file routing
// (api/orders/[id]/payment.js ↔ /api/orders/DXN-…/payment). No Vercel CLI needed.
// Usage: npm run dev   (→ http://localhost:3001)  — uses .env.local if present, else local PGlite.
import './scripts/env.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 3001);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/** Resolve /api/... to a function file, preferring exact names over [param] names (like Vercel). */
function resolveApi(segments) {
  let dir = path.join(ROOT, 'api');
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i], last = i === segments.length - 1;
    const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const dyn = (suffix) => entries.find((e) => /^\[[^\]]+\]/.test(e) && e.endsWith(suffix));
    if (last) {
      const file = entries.includes(`${seg}.js`) ? `${seg}.js`
        : entries.includes(seg) && fs.existsSync(path.join(dir, seg, 'index.js')) ? path.join(seg, 'index.js')
        : dyn('].js') || null;
      return file ? path.join(dir, file) : null;
    }
    const next = entries.includes(seg) && fs.statSync(path.join(dir, seg)).isDirectory() ? seg : dyn(']');
    if (!next) return null;
    dir = path.join(dir, next);
  }
  return fs.existsSync(path.join(dir, 'index.js')) ? path.join(dir, 'index.js') : null;
}

// ---- PayMongo mock (PAYMONGO_MOCK=1): fake hosted checkout that pays/cancels and sends a signed webhook ----
if (process.env.PAYMONGO_MOCK === '1') process.env.PAYMONGO_WEBHOOK_SECRET ||= 'whsk_mock_dev_secret';

async function mockCheckout(url, res) {
  const pm = await import(pathToFileURL(path.join(ROOT, 'lib', 'paymongo.js')).href);
  const s = pm.mock.get(url.searchParams.get('cs'));
  if (!s) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Unknown checkout session'); }
  const action = url.pathname.split('/').pop();
  if (action === 'paymongo-checkout') {
    const peso = '₱' + (s.total / 100).toLocaleString('en-PH');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mock PayMongo — GCash</title>
      <body style="font-family:system-ui;max-width:420px;margin:40px auto;padding:0 16px;text-align:center">
      <p style="color:#888;font-size:12px">MOCK PAYMONGO CHECKOUT (local dev only)</p>
      <h1 style="color:#0057e4">GCash</h1><p>${s.reference}</p><p id="amount" style="font-size:32px;font-weight:800">${peso}</p>
      <p><a id="pay" href="/dev/paymongo-pay?cs=${s.id}" style="display:block;padding:14px;background:#0057e4;color:#fff;border-radius:10px;text-decoration:none">Authorize test payment</a></p>
      <p><a id="pay-nowebhook" href="/dev/paymongo-pay?cs=${s.id}&nowebhook=1">Pay (simulate delayed webhook)</a></p>
      <p><a id="cancel" href="/dev/paymongo-cancel?cs=${s.id}">Cancel</a></p></body>`);
  }
  if (action === 'paymongo-pay') {
    pm.mock.pay(s.id);
    if (url.searchParams.get('nowebhook') !== '1') {
      const body = JSON.stringify({ data: { id: `evt_mock_${Date.now()}`, attributes: { type: 'checkout_session.payment.paid', livemode: false, data: {
        id: s.id, attributes: { reference_number: s.reference, status: 'active', metadata: { order_id: s.reference },
          payments: [{ id: s.paymentId, attributes: { amount: s.amount, status: 'paid' } }] } } } } });
      await fetch(`http://localhost:${PORT}/api/webhooks/paymongo`, {
        method: 'POST', body, headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': pm.signPayload(body, process.env.PAYMONGO_WEBHOOK_SECRET) },
      }).catch((err) => console.error('[mock webhook]', err.message));
    }
    res.writeHead(302, { Location: s.successUrl }); return res.end();
  }
  if (action === 'paymongo-cancel') { res.writeHead(302, { Location: s.cancelUrl }); return res.end(); }
  res.writeHead(404); res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/dev/paymongo-') && process.env.PAYMONGO_MOCK === '1') return mockCheckout(url, res);
  if (url.pathname.startsWith('/api/')) {
    const file = resolveApi(url.pathname.split('/').filter(Boolean).slice(1));
    if (!file) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"Not found."}'); }
    try {
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end('{"error":"Dev server error."}');
    }
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const filePath = path.join(ROOT, p);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => console.log(`DXN Bundle dev server → http://localhost:${PORT}  (db: ${process.env.DATABASE_URL ? 'Neon' : 'local PGlite'})`));
