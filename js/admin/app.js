// Admin shell: sign-in (email + password), forgot/set password, sidebar, hash router.
// Views: { title, load?(params) → data, render(data, params, me), mount?(root, params, data, me), owner? }.
import { icon, esc, loading, toast } from './ui.js';
import { auth } from './api.js';
import dashboard from './views/dashboard.js';
import { ordersView, orderView } from './views/orders.js';
import products from './views/products.js';
import { categoriesView, referralsView } from './views/settings.js';
import customers from './views/customers.js';
import team from './views/team.js';
import system from './views/system.js';

const NAV = [
  ['dashboard', 'Dashboard', 'chart'],
  ['orders', 'Orders', 'receipt'],
  ['products', 'Products', 'box'],
  ['categories', 'Categories', 'layers'],
  ['referrals', 'Referral Codes', 'tag'],
  ['customers', 'Customers', 'people'],
  ['team', 'Team', 'user', 'owner'],
  ['system', 'System', 'shield', 'owner'],
];
const routes = { dashboard, orders: ordersView, order: orderView, products, categories: categoriesView, referrals: referralsView, customers, team, system };

const root = document.getElementById('admin');
let me = null, cleanup = null, seq = 0;

function parseHash() {
  const [path, query = ''] = (location.hash.slice(1) || '/dashboard').split('?');
  const [name = 'dashboard', id] = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  if (id) params.set('id', id);
  return { name: name === 'orders' && id ? 'order' : name, params };
}

// ---------------------------------------------------------------------------
// Signed-out screens
// ---------------------------------------------------------------------------
const authCard = (inner) => `
  <main class="min-h-screen grid place-items-center px-4 py-10">
    <div class="card w-full max-w-sm p-7 sm:p-8">
      <div class="flex items-center gap-3 mb-6">
        <img src="assets/img/logo.webp" alt="DXN" class="h-11 w-auto" width="46" height="44">
        <div><p class="font-serif text-[18px] leading-tight">Store Admin</p><p class="text-[12.5px] text-ink-mute">DXN Bundle Store</p></div>
      </div>
      ${inner}
    </div>
  </main>`;

function busy(btn, on, text) {
  btn.disabled = on;
  btn.querySelector('[data-label]').innerHTML = on ? '<span class="spinner" aria-hidden="true"></span>Please wait…' : text;
}

function renderLogin(message = '') {
  root.innerHTML = authCard(`
    <form data-login novalidate>
      <label for="login-email" class="block text-[13.5px] font-semibold mb-1.5">Email</label>
      <input id="login-email" name="email" type="email" autocomplete="username" class="field-input" required autofocus>
      <label for="login-password" class="block text-[13.5px] font-semibold mt-4 mb-1.5">Password</label>
      <input id="login-password" name="password" type="password" autocomplete="current-password" class="field-input" required>
      <p class="field-error" data-error role="alert" ${message ? '' : 'hidden'}>${esc(message)}</p>
      <button type="submit" class="btn btn-green w-full h-12 mt-5 text-[15px]"><span data-label>Sign in</span></button>
      <button type="button" class="block mx-auto mt-4 text-[13px] text-brand underline underline-offset-2 hover:opacity-75" data-forgot>Forgot password?</button>
    </form>`);
  const form = root.querySelector('[data-login]'), err = form.querySelector('[data-error]'), btn = form.querySelector('[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true; busy(btn, true);
    try {
      me = await auth.login(form.email.value.trim(), form.password.value);
      location.hash = location.hash.startsWith('#/set-password') ? '#/dashboard' : location.hash || '#/dashboard';
      renderShell(); route();
    } catch (ex) {
      busy(btn, false, 'Sign in');
      err.textContent = ex.message; err.hidden = false;
      form.password.value = ''; form.password.focus();
    }
  });
  root.querySelector('[data-forgot]').addEventListener('click', () => renderForgot(form.email.value.trim()));
}

function renderForgot(prefill = '') {
  root.innerHTML = authCard(`
    <form data-forgot-form novalidate>
      <h1 class="font-bold text-[16px]">Reset your password</h1>
      <p class="text-[13px] text-ink-mute mt-1">We’ll email you a link to choose a new password.</p>
      <label for="forgot-email" class="block text-[13.5px] font-semibold mt-4 mb-1.5">Email</label>
      <input id="forgot-email" name="email" type="email" autocomplete="username" class="field-input" value="${esc(prefill)}" required autofocus>
      <p class="field-error" data-error role="alert" hidden></p>
      <p class="mt-3 rounded-lg bg-brand-soft p-3 text-[13px]" data-done role="status" hidden>If that email has an admin account, a reset link is on its way. Check your inbox (and Spam).</p>
      <button type="submit" class="btn btn-green w-full h-12 mt-5 text-[15px]"><span data-label>Send reset link</span></button>
      <button type="button" class="block mx-auto mt-4 text-[13px] text-brand underline underline-offset-2 hover:opacity-75" data-back>Back to sign in</button>
    </form>`);
  const form = root.querySelector('[data-forgot-form]'), btn = form.querySelector('[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('[data-error]'); err.hidden = true;
    busy(btn, true);
    try { await auth.forgot(form.email.value.trim()); form.querySelector('[data-done]').hidden = false; busy(btn, false, 'Send again'); }
    catch (ex) { busy(btn, false, 'Send reset link'); err.textContent = ex.message; err.hidden = false; }
  });
  root.querySelector('[data-back]').addEventListener('click', () => renderLogin());
}

async function renderSetPassword(token) {
  root.innerHTML = authCard(loading());
  let info;
  try { info = await auth.tokenInfo(token); } catch (ex) {
    root.innerHTML = authCard(`<p class="font-semibold">Link not valid</p><p class="text-[13.5px] text-ink-mute mt-1">${esc(ex.message)}</p>
      <a href="#/dashboard" class="btn btn-green w-full h-11 mt-5 text-[14px]" data-to-login>Go to sign in</a>`);
    return;
  }
  root.innerHTML = authCard(`
    <form data-setpw novalidate>
      <h1 class="font-bold text-[16px]">${info.purpose === 'invite' ? `Welcome, ${esc(info.name)}` : 'Choose a new password'}</h1>
      <p class="text-[13px] text-ink-mute mt-1">For <strong>${esc(info.email)}</strong>. Use at least 10 characters — a short phrase is easiest to remember.</p>
      <input type="email" autocomplete="username" value="${esc(info.email)}" hidden>
      <label for="new-password" class="block text-[13.5px] font-semibold mt-4 mb-1.5">New password</label>
      <input id="new-password" name="password" type="password" autocomplete="new-password" minlength="10" class="field-input" required autofocus>
      <label for="new-password2" class="block text-[13.5px] font-semibold mt-3 mb-1.5">Repeat password</label>
      <input id="new-password2" name="password2" type="password" autocomplete="new-password" class="field-input" required>
      <p class="field-error" data-error role="alert" hidden></p>
      <button type="submit" class="btn btn-green w-full h-12 mt-5 text-[15px]"><span data-label>Save password and sign in</span></button>
    </form>`);
  const form = root.querySelector('[data-setpw]'), err = form.querySelector('[data-error]'), btn = form.querySelector('[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (form.password.value !== form.password2.value) { err.textContent = 'The two passwords don’t match.'; err.hidden = false; return; }
    busy(btn, true);
    try {
      me = await auth.setPassword(token, form.password.value);
      history.replaceState(null, '', '/admin#/dashboard');
      renderShell(); route();
      toast('Password saved — you’re signed in');
    } catch (ex) { busy(btn, false, 'Save password and sign in'); err.textContent = ex.message; err.hidden = false; }
  });
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
function renderShell() {
  const nav = NAV.filter(([, , , role]) => !role || me.role === role);
  root.innerHTML = `
  <div class="adm-shell">
    <aside class="adm-side" data-side aria-label="Admin navigation">
      <a href="#/dashboard" class="flex items-center gap-3 px-2 pb-5 mb-2 border-b border-white/10">
        <span class="bg-white rounded-lg p-1"><img src="assets/img/logo.webp" alt="DXN" class="h-8 w-auto" width="34" height="32"></span>
        <span class="leading-tight"><span class="block font-bold text-white text-[15px]">Store Admin</span><span class="block text-[11.5px] text-white/60">DXN Bundle Store</span></span>
      </a>
      <nav class="flex flex-col gap-1">
        ${nav.map(([id, label, ic]) => `<a href="#/${id}" class="adm-nav" data-nav="${id}">${icon(ic, 'w-5 h-5', 1.7)}${label}</a>`).join('')}
      </nav>
      <div class="mt-auto pt-4 border-t border-white/10 flex flex-col gap-1">
        <p class="px-3 pb-2 text-[12.5px] leading-snug text-white/75"><span class="block font-semibold text-white">${esc(me.name)}</span>${esc(me.email)} · ${me.role === 'owner' ? 'Owner' : 'Staff'}</p>
        <a href="/" target="_blank" rel="noopener" class="adm-nav">${icon('external', 'w-5 h-5', 1.7)}View store</a>
        <button type="button" class="adm-nav text-left" data-logout>${icon('logout', 'w-5 h-5', 1.7)}Sign out</button>
      </div>
    </aside>
    <div class="min-w-0">
      <header class="adm-top lg:hidden">
        <div class="flex items-center gap-3 px-4 h-14">
          <button type="button" class="icon-btn -ml-2" data-menu aria-label="Open menu">${icon('menu', 'w-6 h-6')}</button>
          <span class="font-bold" data-title>Admin</span>
        </div>
      </header>
      <main id="adm-main" class="px-4 sm:px-6 lg:px-10 py-6 lg:py-9 max-w-[1240px]" tabindex="-1"></main>
    </div>
  </div>
  <div class="adm-scrim" data-scrim hidden></div>`;
  const side = root.querySelector('[data-side]'), scrim = root.querySelector('[data-scrim]');
  const close = () => { side.classList.remove('is-open'); scrim.hidden = true; };
  root.querySelector('[data-menu]').addEventListener('click', () => { side.classList.add('is-open'); scrim.hidden = false; });
  scrim.addEventListener('click', close);
  side.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  root.querySelector('[data-logout]').addEventListener('click', async () => {
    try { await auth.logout(); } catch { /* signed out locally anyway */ }
    me = null; renderLogin('You’re signed out.');
  });
}

async function route() {
  const { name, params } = parseHash();
  if (name === 'set-password') return renderSetPassword(params.get('token') || '');
  if (!me) return renderLogin();
  if (!root.querySelector('#adm-main')) renderShell();
  let view = routes[name] || dashboard;
  if (view.owner && me.role !== 'owner') view = dashboard;
  const main = root.querySelector('#adm-main');
  const current = ++seq;
  cleanup?.(); cleanup = null;
  root.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === (name === 'order' ? 'orders' : name)));
  const title = typeof view.title === 'function' ? view.title(params) : view.title;
  document.title = `${title} — Admin`;
  root.querySelector('[data-title]').textContent = title;
  main.innerHTML = loading();
  try {
    const data = view.load ? await view.load(params) : null;
    if (current !== seq) return;
    main.innerHTML = `<div class="view-enter">${view.render(data, params, me)}</div>`;
    cleanup = view.mount?.(main, params, data, me) || null;
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    if (current !== seq || err.status === 401) return;
    main.innerHTML = `<div class="card p-8 text-center"><p class="font-semibold">Couldn’t load this page.</p><p class="text-[13.5px] text-ink-mute mt-1">${esc(err.message)}</p>
      <button type="button" class="btn btn-green btn-sm mt-4" data-retry>Try again</button></div>`;
    main.querySelector('[data-retry]').addEventListener('click', route);
  }
}

window.addEventListener('admin:logout', () => { if (!me) return; me = null; renderLogin('Your session ended. Please sign in again.'); });
window.addEventListener('hashchange', route);

(async () => {
  root.innerHTML = loading();
  try { me = await auth.me(); } catch { me = null; }
  route();
})();
