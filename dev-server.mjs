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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
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
