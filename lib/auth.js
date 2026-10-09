// Admin accounts: scrypt password hashes, cookie sessions, invite/reset links, lockout.
// Cookie: HttpOnly + Secure (on https) + SameSite=Strict. State-changing admin requests must also send
// "X-Requested-With: dxn-admin" and a same-origin Origin header (CSRF defence in depth).
import { scrypt as _scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query, tx } from './db.js';
import { HttpError } from './http.js';
import { clientIp } from './security.js';

const scrypt = promisify(_scrypt);
const COOKIE = 'dxn_admin';
const SESSION_DAYS = 7;
const MAX_FAILS = 8, LOCK_MIN = 15;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------
export function passwordProblem(pw) {
  const s = String(pw ?? '');
  if (s.length < 10) return 'Use at least 10 characters.';
  if (s.length > 200) return 'That password is too long.';
  if (/^(.)\1+$/.test(s) || /^(?:0123456789|1234567890|password\d*|qwertyuiop)/i.test(s)) return 'That password is too easy to guess.';
  return '';
}

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scrypt(String(pw), Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}
// Burn comparable time for unknown emails so response time doesn't reveal which accounts exist.
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

// ---------------------------------------------------------------------------
// Cookies & sessions
// ---------------------------------------------------------------------------
const isHttps = (req) => (req.headers['x-forwarded-proto'] || '').includes('https') || Boolean(process.env.VERCEL);
function cookieHeader(req, value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
}
function readCookie(req) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,})`).exec(req.headers.cookie || '');
  return m ? m[1] : null;
}

async function startSession(req, res, userId) {
  const token = randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO admin_sessions (token_hash, user_id, expires_at, ip, user_agent) VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
    [sha256(token), userId, String(SESSION_DAYS), clientIp(req), String(req.headers['user-agent'] || '').slice(0, 200)]);
  res.setHeader('Set-Cookie', cookieHeader(req, token, SESSION_DAYS * 86400));
}

export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

/** The signed-in admin for this request, or null. Slides the 7-day expiry (at most once an hour). */
export async function currentUser(req) {
  const token = readCookie(req);
  if (!token) return null;
  const [row] = await query(
    `SELECT s.id AS sid, s.last_seen_at, u.* FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`, [sha256(token)]);
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > 3600_000) {
    await query(`UPDATE admin_sessions SET last_seen_at = now(), expires_at = now() + ($2 || ' days')::interval WHERE id = $1`, [row.sid, String(SESSION_DAYS)]);
  }
  return row;
}

/** Reject cross-site state-changing requests (cookie auth only). */
function checkCsrf(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  if (req.headers['x-requested-with'] !== 'dxn-admin') throw new HttpError(403, 'Request blocked (missing admin header).');
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (new URL(origin).host !== host) throw new HttpError(403, 'Request blocked (cross-site).');
  }
}

/**
 * Require a signed-in admin. Returns the user. `role: 'owner'` restricts to owners.
 * Break-glass: if ADMIN_API_KEY is set, the "x-admin-key" header also works (scripts/tests; remove in production).
 */
export async function requireAdmin(req, { role } = {}) {
  const key = process.env.ADMIN_API_KEY, given = req.headers['x-admin-key'];
  if (given !== undefined) {
    const d = (s) => createHash('sha256').update(String(s)).digest();
    if (key && key.length >= 16 && typeof given === 'string' && timingSafeEqual(d(given), d(key))) {
      return { id: 0, email: 'api-key', name: 'API key', role: 'owner' };
    }
    throw new HttpError(401, 'Invalid admin key.');
  }
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, 'Please sign in.');
  checkCsrf(req);
  if (role === 'owner' && user.role !== 'owner') throw new HttpError(403, 'Only the store owner can do that.');
  return user;
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------
export async function login(req, res, { email, password }) {
  const e = String(email || '').trim().toLowerCase();
  const [u] = await query('SELECT * FROM admin_users WHERE email = $1', [e]);
  const generic = new HttpError(401, 'Email or password is incorrect.');
  if (!u || !u.password_hash || !u.active) { await verifyPassword(String(password), DUMMY).catch(() => {}); throw generic; }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    throw new HttpError(429, 'Too many wrong passwords. This account is locked for a few minutes — or reset your password.');
  }
  if (!(await verifyPassword(String(password), u.password_hash))) {
    await query(`UPDATE admin_users SET failed_attempts = failed_attempts + 1,
                   locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
                 WHERE id = $1`, [u.id, MAX_FAILS, String(LOCK_MIN)]);
    throw generic;
  }
  await query('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [u.id]);
  await startSession(req, res, u.id);
  return publicUser(u);
}

export async function logout(req, res) {
  const token = readCookie(req);
  if (token) await query('DELETE FROM admin_sessions WHERE token_hash = $1', [sha256(token)]);
  res.setHeader('Set-Cookie', cookieHeader(req, '', 0));
}

// ---------------------------------------------------------------------------
// Invites & password reset (one-time links)
// ---------------------------------------------------------------------------
export async function issueToken(userId, purpose) {
  const token = randomBytes(32).toString('base64url');
  const hours = purpose === 'invite' ? 72 : 1;
  await query(`UPDATE admin_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
  await query(`INSERT INTO admin_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval)`,
    [sha256(token), userId, purpose, String(hours)]);
  return token;
}

export async function tokenInfo(token) {
  const [row] = await query(
    `SELECT t.purpose, u.email, u.name FROM admin_tokens t JOIN admin_users u ON u.id = t.user_id
     WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND u.active`, [sha256(String(token || ''))]);
  if (!row) throw new HttpError(400, 'This link has expired or was already used. Ask for a new one.');
  return row;
}

/** Use an invite/reset link to set a password, then sign in. Ends the user's other sessions. */
export async function setPasswordWithToken(req, res, { token, password }) {
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(422, problem, { fields: { password: problem } });
  const hash = await hashPassword(String(password));
  const user = await tx(async (q) => {
    const [t] = await q(
      `SELECT t.token_hash, t.user_id FROM admin_tokens t JOIN admin_users u ON u.id = t.user_id
       WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND u.active FOR UPDATE OF t`, [sha256(String(token || ''))]);
    if (!t) throw new HttpError(400, 'This link has expired or was already used. Ask for a new one.');
    await q('UPDATE admin_tokens SET used_at = now() WHERE token_hash = $1', [t.token_hash]);
    const [u] = await q(`UPDATE admin_users SET password_hash = $2, failed_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING *`, [t.user_id, hash]);
    await q('DELETE FROM admin_sessions WHERE user_id = $1', [t.user_id]);
    return u;
  });
  await startSession(req, res, user.id);
  await query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [user.id]);
  return publicUser(user);
}

// ---------------------------------------------------------------------------
// User management (owner)
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function createAdminUser({ email, name, role = 'staff' }) {
  const e = String(email || '').trim().toLowerCase(), n = String(name || '').trim();
  if (!EMAIL_RE.test(e) || e.length > 254) throw new HttpError(422, 'Enter a valid email.', { fields: { email: 'Invalid email.' } });
  if (n.length < 2 || n.length > 80) throw new HttpError(422, 'Enter a name.', { fields: { name: 'Required.' } });
  if (!['owner', 'staff'].includes(role)) throw new HttpError(422, 'Unknown role.');
  const rows = await query(`INSERT INTO admin_users (email, name, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING *`, [e, n, role]);
  if (!rows.length) throw new HttpError(409, 'That email already has an admin account.', { fields: { email: 'Already exists.' } });
  return rows[0];
}

export async function listAdminUsers() {
  return query(`SELECT u.id, u.email, u.name, u.role, u.active, u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
                       (u.password_hash IS NULL) AS "invitePending"
                FROM admin_users u ORDER BY u.role = 'owner' DESC, u.created_at`);
}

export async function updateAdminUser(actor, id, b) {
  const targetId = Number(id);
  return tx(async (q) => {
    const [u] = await q('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [targetId]);
    if (!u) throw new HttpError(404, 'Admin user not found.');
    const next = { name: u.name, role: u.role, active: u.active };
    if ('name' in b) { const n = String(b.name || '').trim(); if (n.length < 2 || n.length > 80) throw new HttpError(422, 'Enter a name.'); next.name = n; }
    if ('role' in b) { if (!['owner', 'staff'].includes(b.role)) throw new HttpError(422, 'Unknown role.'); next.role = b.role; }
    if ('active' in b) next.active = Boolean(b.active);
    if (u.id === actor.id && (!next.active || next.role !== 'owner')) throw new HttpError(409, 'You can’t remove your own owner access.');
    if (u.role === 'owner' && (next.role !== 'owner' || !next.active)) {
      const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'owner' AND active AND id <> $1`, [u.id]);
      if (!n) throw new HttpError(409, 'The store needs at least one active owner.');
    }
    const [row] = await q('UPDATE admin_users SET name = $2, role = $3, active = $4 WHERE id = $1 RETURNING *', [u.id, next.name, next.role, next.active]);
    if (!next.active) await q('DELETE FROM admin_sessions WHERE user_id = $1', [u.id]); // sign them out everywhere
    return row;
  });
}
