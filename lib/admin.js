// Temporary admin auth (Phase 7 replaces this with real accounts): a shared secret in ADMIN_API_KEY,
// sent by the admin tools as the "x-admin-key" header.
import { timingSafeEqual, createHash } from 'node:crypto';
import { HttpError } from './http.js';

const digest = (s) => createHash('sha256').update(String(s)).digest();

export function requireAdmin(req) {
  const key = process.env.ADMIN_API_KEY;
  if (!key || key.length < 16) throw new HttpError(503, 'Admin access is not configured (ADMIN_API_KEY).');
  const given = req.headers['x-admin-key'];
  if (typeof given !== 'string' || !timingSafeEqual(digest(given), digest(key))) throw new HttpError(401, 'Invalid admin key.');
}
