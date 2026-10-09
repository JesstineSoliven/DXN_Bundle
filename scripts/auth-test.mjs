// Admin accounts + security test. Usage: DATABASE_URL= ADMIN_API_KEY=… node scripts/auth-test.mjs
// Needs the dev server (logs skipped email bodies to .data/dev-server.log, which holds the invite/reset links).
import './env.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3001';
const KEY = process.env.ADMIN_API_KEY;
const LOG = process.env.MAIL_LOG || '.data/dev-server.log';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };

// Rate limits persist in the database, so each run acts as a fresh client address.
const RUN_IP = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;

/** Tiny cookie-jar client (one per "browser"). */
function client() {
  let cookie = '';
  return async (method, path, body, headers = {}) => {
    const res = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'dxn-admin', 'X-Forwarded-For': RUN_IP, ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) { const m = /dxn_admin=([^;]*)/.exec(set); cookie = m && m[1] ? `dxn_admin=${m[1]}` : ''; }
    let data = {}; try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data, setCookie: set, headers: res.headers };
  };
}
const keyed = (method, path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'x-admin-key': KEY }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
async function linkFor(email, after) {
  for (let i = 0; i < 30; i++) {
    const lines = readFileSync(LOG, 'utf8').split('\n').slice(after);
    const hit = [...lines].reverse().find((l) => l.includes('[mail:body]') && l.includes(email));
    const m = hit && /set-password\?token=([A-Za-z0-9_-]+)/.exec(hit);
    if (m) return m[1];
    await sleep(200);
  }
  return null;
}
const logLines = () => readFileSync(LOG, 'utf8').split('\n').length;
const run = Date.now().toString(36);
const ownerEmail = `owner-${run}@test.local`, staffEmail = `staff-${run}@test.local`;

console.log(`Auth & security → ${BASE}`);

console.log('Bootstrap (owner invited via API key)');
let mark = logLines();
const inv = await keyed('POST', '/api/admin/users', { email: ownerEmail, name: 'Owner Test', role: 'owner' });
ok(inv.status === 201 && inv.data.user.role === 'owner', 'owner invited');
const ownerToken = await linkFor(ownerEmail, mark - 1);
ok(Boolean(ownerToken), 'invite email contains a set-password link');

const anon = client();
ok((await anon('GET', '/api/admin/me')).status === 401, 'admin API without sign-in → 401');
ok((await anon('GET', '/api/auth/me')).data.user === null, '/auth/me signed out → null');
ok((await anon('GET', `/api/auth/token?token=nope`)).status === 400, 'invalid link → 400');
const info = await anon('GET', `/api/auth/token?token=${ownerToken}`);
ok(info.data.email === ownerEmail && info.data.purpose === 'invite', 'link info shows email + purpose');

console.log('Set password');
ok((await anon('POST', '/api/auth/set-password', { token: ownerToken, password: 'short' })).status === 422, 'weak password rejected');
const owner = client();
const setpw = await owner('POST', '/api/auth/set-password', { token: ownerToken, password: 'correct horse battery 1' });
ok(setpw.status === 200 && setpw.data.user.email === ownerEmail, 'password set → signed in');
ok(/HttpOnly/i.test(setpw.setCookie) && /SameSite=Strict/i.test(setpw.setCookie), 'session cookie is HttpOnly + SameSite=Strict');
ok((await anon('POST', '/api/auth/set-password', { token: ownerToken, password: 'another password 22' })).status === 400, 'link cannot be reused');
ok((await owner('GET', '/api/admin/me')).data.user?.email === ownerEmail, 'owner session works on admin API');

console.log('Sign in / out');
const b2 = client();
ok((await b2('POST', '/api/auth/login', { email: ownerEmail, password: 'wrong password 123' })).status === 401, 'wrong password → 401');
ok((await b2('POST', '/api/auth/login', { email: 'nobody@test.local', password: 'whatever 12345' })).data.error === 'Email or password is incorrect.', 'unknown email → same generic message');
const li = await b2('POST', '/api/auth/login', { email: ownerEmail.toUpperCase(), password: 'correct horse battery 1' });
ok(li.status === 200, 'sign in (email case-insensitive)');
ok((await b2('GET', '/api/admin/summary')).status === 200, 'signed-in session reads admin data');
await b2('POST', '/api/auth/logout', {});
ok((await b2('GET', '/api/admin/me')).status === 401, 'signed out → 401');

console.log('CSRF protection');
const noHeader = await fetch(`${BASE}/api/admin/referrals`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: (await (async () => { const c = client(); const r = await c('POST', '/api/auth/login', { email: ownerEmail, password: 'correct horse battery 1' }); return `dxn_admin=${/dxn_admin=([^;]*)/.exec(r.setCookie)[1]}`; })()) }, body: '{"code":"CSRF-1","referrerName":"x"}' });
ok(noHeader.status === 403, 'POST without X-Requested-With header → 403');
const crossSite = await owner('POST', '/api/admin/referrals', { code: 'CSRF-2', referrerName: 'x' }, { Origin: 'https://evil.example' });
ok(crossSite.status === 403, 'POST from another origin → 403');

console.log('Team management');
mark = logLines();
const staffInv = await owner('POST', '/api/admin/users', { email: staffEmail, name: 'Staff Test', role: 'staff' });
ok(staffInv.status === 201, 'owner invites staff');
ok((await owner('POST', '/api/admin/users', { email: staffEmail, name: 'Again' })).status === 409, 'duplicate email → 409');
const staffToken = await linkFor(staffEmail, mark - 1);
const staff = client();
await staff('POST', '/api/auth/set-password', { token: staffToken, password: 'staff password 12345' });
ok((await staff('GET', '/api/admin/orders?limit=1')).status === 200, 'staff can use the admin (orders)');
ok((await staff('GET', '/api/admin/users')).status === 403, 'staff cannot see the team (owner only)');
ok((await staff('GET', '/api/admin/system')).status === 403, 'staff cannot see System (owner only)');
ok((await staff('POST', '/api/admin/users', { email: `x-${run}@test.local`, name: 'X' })).status === 403, 'staff cannot invite');
const meId = (await owner('GET', '/api/admin/me')).data.user.id;
ok((await owner('PATCH', `/api/admin/users/${meId}`, { active: false })).status === 409, 'owner cannot switch themselves off');
const staffId = staffInv.data.user.id;
ok((await owner('PATCH', `/api/admin/users/${staffId}`, { active: false })).data.user?.email === staffEmail, 'owner turns staff off');
ok((await staff('GET', '/api/admin/me')).status === 401, '…and the staff session ends immediately');
await owner('PATCH', `/api/admin/users/${staffId}`, { active: true });

console.log('Password reset + lockout');
mark = logLines();
const ipHdr = {};
ok((await anon('POST', '/api/auth/forgot', { email: `nobody-${run}@test.local` }, ipHdr)).status === 200, 'forgot: unknown email gets the same answer');
await anon('POST', '/api/auth/forgot', { email: staffEmail }, ipHdr);
const resetToken = await linkFor(staffEmail, mark - 1);
ok(Boolean(resetToken) && (await anon('GET', `/api/auth/token?token=${resetToken}`)).data.purpose === 'reset', 'reset link emailed');
const atk = client();
for (let i = 0; i < 8; i++) await atk('POST', '/api/auth/login', { email: staffEmail, password: `guess ${i} wrong pw` });
const locked = await atk('POST', '/api/auth/login', { email: staffEmail, password: 'staff password 12345' });
ok(locked.status === 429, 'after 8 wrong passwords the account is locked (even the right password waits)');
const reset = client();
ok((await reset('POST', '/api/auth/set-password', { token: resetToken, password: 'new staff password 99' })).status === 200, 'reset link unlocks + sets a new password');

console.log('Rate limits');
const rl = client();
let last;
for (let i = 0; i < 35; i++) last = await rl('POST', '/api/referrals/validate', { code: `RL-${i}` }, { 'X-Forwarded-For': `203.0.113.${run.length}` });
ok(last.status === 429 && last.headers.get('retry-after'), 'referral checks rate-limited (429 + Retry-After)');

console.log('System page');
const sys = await owner('GET', '/api/admin/system');
ok(sys.status === 200 && sys.data.config.database === true && 'paymongoMode' in sys.data.config && !JSON.stringify(sys.data).includes(KEY), 'System status (no secret values exposed)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
