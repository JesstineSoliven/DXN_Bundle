// Admin shell: login (admin key), sidebar, hash router. Views: { title, load?(params) → data, render(data, params), mount?(root, params, data) }.
import { icon, esc, loading, toast } from './ui.js';
import { admin, getKey, setKey } from './api.js';
import dashboard from './views/dashboard.js';
import { ordersView, orderView } from './views/orders.js';
import products from './views/products.js';
import { categoriesView, referralsView } from './views/settings.js';
import customers from './views/customers.js';

const NAV = [
  ['dashboard', 'Dashboard', 'chart'],
  ['orders', 'Orders', 'receipt'],
  ['products', 'Products', 'box'],
  ['categories', 'Categories', 'layers'],
  ['referrals', 'Referral Codes', 'tag'],
  ['customers', 'Customers', 'people'],
];
const routes = { dashboard, orders: ordersView, order: orderView, products, categories: categoriesView, referrals: referralsView, customers };

const root = document.getElementById('admin');
let cleanup = null, seq = 0;

function parseHash() {
  const [path, query = ''] = (location.hash.slice(1) || '/dashboard').split('?');
  const [name = 'dashboard', id] = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  if (id) params.set('id', id);
  return { name: name === 'orders' && id ? 'order' : name, params };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function renderLogin(message = '') {
  root.innerHTML = `
  <main class="min-h-screen grid place-items-center px-4 py-10">
    <form class="card w-full max-w-sm p-7 sm:p-8" data-login novalidate>
      <div class="flex items-center gap-3">
        <img src="assets/img/logo.webp" alt="DXN" class="h-11 w-auto">
        <div><p class="font-serif text-[18px] leading-tight">Store Admin</p><p class="text-[12.5px] text-ink-mute">DXN Bundle Store</p></div>
      </div>
      <label for="admin-key" class="block text-[13.5px] font-semibold mt-6 mb-1.5">Admin key</label>
      <input id="admin-key" type="password" autocomplete="current-password" class="field-input" required autofocus>
      <p class="field-error" data-login-error role="alert" ${message ? '' : 'hidden'}>${esc(message)}</p>
      <button type="submit" class="btn btn-green w-full h-12 mt-5 text-[15px]"><span data-label>Sign in</span></button>
      <p class="text-[12px] text-ink-mute mt-4">The admin key is the <code>ADMIN_API_KEY</code> set in Vercel. You stay signed in until you close this tab.</p>
    </form>
  </main>`;
  const form = root.querySelector('[data-login]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = form.querySelector('input').value.trim();
    const btn = form.querySelector('button'), err = form.querySelector('[data-login-error]');
    btn.disabled = true; btn.querySelector('[data-label]').innerHTML = '<span class="spinner" aria-hidden="true"></span>Checking…';
    if (key && await admin.check(key)) { setKey(key); renderShell(); route(); return; }
    btn.disabled = false; btn.querySelector('[data-label]').textContent = 'Sign in';
    err.textContent = 'That admin key isn’t valid.'; err.hidden = false;
  });
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
function renderShell() {
  root.innerHTML = `
  <div class="adm-shell">
    <aside class="adm-side" data-side aria-label="Admin navigation">
      <a href="#/dashboard" class="flex items-center gap-3 px-2 pb-5 mb-2 border-b border-white/10">
        <span class="bg-white rounded-lg p-1"><img src="assets/img/logo.webp" alt="DXN" class="h-8 w-auto"></span>
        <span class="leading-tight"><span class="block font-bold text-white text-[15px]">Store Admin</span><span class="block text-[11.5px] text-white/60">DXN Bundle Store</span></span>
      </a>
      <nav class="flex flex-col gap-1">
        ${NAV.map(([id, label, ic]) => `<a href="#/${id}" class="adm-nav" data-nav="${id}">${icon(ic, 'w-5 h-5', 1.7)}${label}</a>`).join('')}
      </nav>
      <div class="mt-auto pt-4 border-t border-white/10 flex flex-col gap-1">
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
  root.querySelector('[data-logout]').addEventListener('click', () => { setKey(''); renderLogin('Signed out.'); });
}

async function route() {
  if (!getKey()) return renderLogin();
  if (!root.querySelector('#adm-main')) renderShell();
  const { name, params } = parseHash();
  const view = routes[name] || dashboard;
  const main = root.querySelector('#adm-main');
  const me = ++seq;
  cleanup?.(); cleanup = null;
  root.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === (name === 'order' ? 'orders' : name)));
  const title = typeof view.title === 'function' ? view.title(params) : view.title;
  document.title = `${title} — Admin`;
  root.querySelector('[data-title]').textContent = title;
  main.innerHTML = loading();
  try {
    const data = view.load ? await view.load(params) : null;
    if (me !== seq) return;
    main.innerHTML = `<div class="view-enter">${view.render(data, params)}</div>`;
    cleanup = view.mount?.(main, params, data) || null;
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    if (me !== seq || err.status === 401) return;
    main.innerHTML = `<div class="card p-8 text-center"><p class="font-semibold">Couldn’t load this page.</p><p class="text-[13.5px] text-ink-mute mt-1">${esc(err.message)}</p>
      <button type="button" class="btn btn-green btn-sm mt-4" onclick="window.dispatchEvent(new HashChangeEvent('hashchange'))">Try again</button></div>`;
  }
}


window.addEventListener('admin:logout', () => { setKey(''); renderLogin('Your session ended. Please sign in again.'); toast('Signed out', 'error'); });
window.addEventListener('hashchange', route);
route();
