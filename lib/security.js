// Request helpers for abuse protection: client IP and fixed-window rate limits (stored in Postgres,
// so limits hold across serverless instances).
import { query } from './db.js';
import { HttpError } from './http.js';

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (xff || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

/**
 * Count one hit for `key` in the current window; throw 429 when over `limit`.
 * @param {string} bucket e.g. 'order'   @param {string} id e.g. IP or email
 */
export async function rateLimit(bucket, id, limit, windowSec, message = 'Too many attempts. Please wait a few minutes and try again.') {
  if (process.env.RATE_LIMITS === 'off' && !process.env.VERCEL) return 0; // local bulk test runs only; always on in Vercel
  const now = Math.floor(Date.now() / 1000);
  const windowStart = new Date((now - (now % windowSec)) * 1000).toISOString();
  const key = `${bucket}:${String(id).toLowerCase().slice(0, 120)}`;
  const [{ count }] = await query(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`, [key, windowStart]);
  if (Math.random() < 0.02) query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`).catch(() => {});
  if (count > limit) {
    const retry = windowSec - (now % windowSec);
    throw new HttpError(429, message, { retryAfter: retry });
  }
  return count;
}
