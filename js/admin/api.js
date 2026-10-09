// Admin API client. Auth = HttpOnly session cookie set by /api/auth/login (sent automatically, same-origin).
// Every request carries X-Requested-With so the server can reject cross-site form posts (CSRF).
import { ApiError } from '../api.js';

async function send(base, method, path, body) {
  let res;
  try {
    res = await fetch(`${base}/${path}`, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'dxn-admin', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new ApiError('We can’t reach the server. Check your connection.', 0); }
  let data = {}; try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && base === '/api/admin') window.dispatchEvent(new CustomEvent('admin:logout'));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`, res.status, data);
  return data;
}

export const admin = {
  get: (path) => send('/api/admin', 'GET', path),
  post: (path, body) => send('/api/admin', 'POST', path, body || {}),
  patch: (path, body) => send('/api/admin', 'PATCH', path, body || {}),
  del: (path) => send('/api/admin', 'DELETE', path),
};

export const auth = {
  me: () => send('/api/auth', 'GET', 'me').then((r) => r.user),
  login: (email, password) => send('/api/auth', 'POST', 'login', { email, password }).then((r) => r.user),
  logout: () => send('/api/auth', 'POST', 'logout', {}),
  forgot: (email) => send('/api/auth', 'POST', 'forgot', { email }),
  tokenInfo: (token) => send('/api/auth', 'GET', `token?token=${encodeURIComponent(token)}`),
  setPassword: (token, password) => send('/api/auth', 'POST', 'set-password', { token, password }).then((r) => r.user),
};
