// Minimal HTTP helpers for Vercel Node functions (also used by dev-server.mjs).
// Uses plain req/res so handlers run the same on Vercel and locally.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', headers['Cache-Control'] || 'no-store');
  for (const [k, v] of Object.entries(headers)) if (k !== 'Cache-Control') res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

const MAX_BODY = 64 * 1024;

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body; // Vercel pre-parsed JSON
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new HttpError(413, 'Request is too large.');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

/** Public site origin for links in emails: SITE_URL env, else the request's host. */
export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3001';
  const proto = req.headers['x-forwarded-proto'] || (/^localhost|^127\./.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** URL path segments and query, independent of the hosting platform. */
export function urlParts(req) {
  const url = new URL(req.url, 'http://localhost');
  return { segments: url.pathname.split('/').filter(Boolean).map(decodeURIComponent), query: url.searchParams };
}

/** Wrap a handler: method guard + uniform JSON errors (no stack traces leak to clients). */
export function handler(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new HttpError(405, 'Method not allowed.');
      }
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...err.extra });
      console.error('[api]', req.method, req.url, err);
      send(res, 500, { error: 'Something went wrong on our side. Please try again.' });
    }
  };
}
