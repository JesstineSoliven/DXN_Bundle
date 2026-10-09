// Admin API client. The admin key lives in sessionStorage (cleared when the tab closes).
// Phase 7 replaces the shared key with real admin accounts.
import { ApiError } from '../api.js';

const KEY = 'dxn.adminKey'; // same key the storefront's ?demo=1 panel uses
export const getKey = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setKey = (k) => { try { k ? sessionStorage.setItem(KEY, k) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

async function send(method, path, body) {
  let res;
  try {
    res = await fetch(`/api/admin/${path}`, {
      method,
      headers: { Accept: 'application/json', 'x-admin-key': getKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new ApiError('We can’t reach the server. Check your connection.', 0); }
  let data = {}; try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401) window.dispatchEvent(new CustomEvent('admin:logout'));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`, res.status, data);
  return data;
}

export const admin = {
  get: (path) => send('GET', path),
  post: (path, body) => send('POST', path, body || {}),
  patch: (path, body) => send('PATCH', path, body || {}),
  del: (path) => send('DELETE', path),
  /** Validate a key without storing it. */
  async check(key) {
    try { return (await fetch('/api/admin/me', { headers: { 'x-admin-key': key } })).ok; } catch { return false; }
  },
};
