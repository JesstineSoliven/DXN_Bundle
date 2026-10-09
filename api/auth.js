// /api/auth/* — admin sign-in, sign-out, current user, forgot password, set password (invite/reset link).
// vercel.json rewrites /api/auth/<path> → /api/auth?path=<path>.
import { handler, send, readJson, urlParts, siteUrl, HttpError } from '../lib/http.js';
import { login, logout, currentUser, publicUser, tokenInfo, setPasswordWithToken, issueToken } from '../lib/auth.js';
import { rateLimit, clientIp } from '../lib/security.js';
import { query } from '../lib/db.js';
import { emailAdminAccountLink } from '../lib/emails.js';

export default handler(['GET', 'POST'], async (req, res) => {
  const { segments, query: q } = urlParts(req);
  const path = (q.get('path') ?? segments.slice(2).join('/')).replace(/^\/+|\/+$/g, '');
  const ip = clientIp(req);

  if (req.method === 'GET' && path === 'me') {
    const u = await currentUser(req);
    return send(res, 200, { user: u ? publicUser(u) : null });
  }
  if (req.method === 'GET' && path === 'token') {
    await rateLimit('token', ip, 30, 3600);
    const t = await tokenInfo(q.get('token'));
    return send(res, 200, { purpose: t.purpose, email: t.email, name: t.name });
  }
  if (req.method !== 'POST') throw new HttpError(404, 'Unknown endpoint.');
  const b = await readJson(req);

  if (path === 'login') {
    await rateLimit('login-ip', ip, 20, 900);
    await rateLimit('login-email', String(b.email || '').trim().toLowerCase(), 10, 900);
    return send(res, 200, { user: await login(req, res, b) });
  }
  if (path === 'logout') { await logout(req, res); return send(res, 200, { ok: true }); }
  if (path === 'forgot') {
    await rateLimit('forgot-ip', ip, 5, 3600);
    const email = String(b.email || '').trim().toLowerCase();
    await rateLimit('forgot-email', email, 3, 3600);
    const [u] = await query('SELECT * FROM admin_users WHERE email = $1 AND active', [email]);
    if (u) await emailAdminAccountLink(u, await issueToken(u.id, u.password_hash ? 'reset' : 'invite'), u.password_hash ? 'reset' : 'invite', siteUrl(req));
    // Same answer whether or not the account exists (no account discovery).
    return send(res, 200, { ok: true });
  }
  if (path === 'set-password') {
    await rateLimit('setpw-ip', ip, 20, 3600);
    return send(res, 200, { user: await setPasswordWithToken(req, res, b) });
  }
  throw new HttpError(404, 'Unknown endpoint.');
});
