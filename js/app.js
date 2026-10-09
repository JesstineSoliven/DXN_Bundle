// App shell: hash router, nav state, mobile menu, bundle actions and cart badge.
// Views are { load?(params) → Promise<data>, render(params, data) → HTML, mount?(root, params) → cleanup }.
import { icon } from './icons.js';
import { footer, toast, esc } from './components.js';
import { getProduct, loadCatalog } from './data/products.js';
import { getOrder, getAdminKey } from './store/orders.js';
import * as bundle from './store/bundle.js';
import { renderHome } from './views/home.js';
import { renderProducts, mountProducts } from './views/products.js';
import { renderCustomize, mountCustomize } from './views/customize.js';
import { renderReview, mountReview } from './views/review.js';
import { renderCheckout, mountCheckout } from './views/checkout.js';
import { renderConfirmation, mountConfirmation } from './views/confirmation.js';
import { renderPayment, mountPayment } from './views/payment.js';
import { renderMysteryBox, mountMysteryBox } from './views/mysteryBox.js';

const renderAccount = () => `
  <section class="mx-auto max-w-md px-4 py-16 text-center">
    <div class="card p-8">
      ${icon('user', 'w-12 h-12 mx-auto text-brand', 1.5)}
      <h1 class="font-serif text-[22px] mt-4">My Account</h1>
      <p class="text-[14px] text-ink-mute mt-2">Sign-in and order history are coming soon.</p>
      <a href="#/" class="btn btn-green h-11 px-6 mt-6 text-[14px]">Back to Home</a>
    </div>
  </section>`;

/** Orders live on the server; a 404 renders the view's "not found" state, other errors a retry card. */
async function loadOrder(params) {
  try {
    const admin = params.get('demo') === '1' ? getAdminKey() : '';
    return await getOrder(params.get('id'), params.get('t'), { adminKey: admin, sync: params.get('paid') === '1' });
  } catch (err) {
    if (err.status === 404 || err.status === 401) return null;
    throw err;
  }
}

const loadingView = () => `
  <section class="mx-auto max-w-md px-4 py-20 text-center text-ink-mute" aria-busy="true">
    <span class="spinner inline-block w-8 h-8 text-brand" aria-hidden="true"></span>
    <p class="mt-4 text-[14px]">Loading…</p>
  </section>`;

const errorView = (message) => `
  <section class="mx-auto max-w-md px-4 py-16 text-center">
    <div class="card p-8">
      ${icon('shield', 'w-12 h-12 mx-auto text-ink-mute', 1.4)}
      <h1 class="font-serif text-[22px] mt-4">Something went wrong</h1>
      <p class="text-[14px] text-ink-mute mt-2">${esc(message)}</p>
      <button type="button" class="btn btn-green h-11 px-6 mt-6 text-[14px]" onclick="window.dispatchEvent(new HashChangeEvent('hashchange'))">Try again</button>
    </div>
  </section>`;

const routes = {
  home: { render: renderHome, nav: 'home' },
  products: { render: renderProducts, mount: mountProducts, nav: 'products' },
  customize: { render: renderCustomize, mount: mountCustomize, nav: 'customize' },
  review: { render: renderReview, mount: mountReview, nav: 'customize' },
  checkout: { render: renderCheckout, mount: mountCheckout, nav: 'customize' },
  order: { load: loadOrder, render: renderConfirmation, mount: mountConfirmation, nav: null },
  pay: { load: loadOrder, render: renderPayment, mount: mountPayment, nav: null },
  'mystery-box': { render: renderMysteryBox, mount: mountMysteryBox, nav: 'mystery-box' },
  account: { render: renderAccount, nav: 'account' },
};

const app = document.getElementById('app');
let currentRoute = null;
let cleanup = null;

function parseHash() {
  const raw = location.hash.slice(1) || '/'; // "/products?cat=food", "/order/DXN-260927-1234"
  const [path, query = ''] = raw.split('?');
  const [name = 'home', id] = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  if (id) params.set('id', id);
  return { name, params };
}

function setActive(name) {
  document.querySelectorAll('[data-route]').forEach((el) => {
    const on = el.dataset.route === name;
    el.classList.toggle('is-active', on);
    if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
}

let renderSeq = 0;

async function render() {
  // In-page anchors (#about, #contact) scroll without re-routing.
  if (location.hash && !location.hash.startsWith('#/')) {
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  const { name, params } = parseHash();
  const route = routes[name] || routes.home;
  const seq = ++renderSeq;
  cleanup?.(); cleanup = null;
  setActive(route.nav);
  let data;
  if (route.load) {
    app.innerHTML = loadingView();
    try { data = await route.load(params); } catch (err) {
      if (seq === renderSeq) app.innerHTML = errorView(err.message);
      return;
    }
    if (seq !== renderSeq) return; // user navigated away while loading
  }
  app.innerHTML = `<div class="view-enter">${route.render(params, data)}</div>`;
  cleanup = route.mount?.(app, params, data) || null;
  if (currentRoute !== name) window.scrollTo({ top: 0, behavior: 'instant' });
  currentRoute = name;
  closeMenu();
}

// ---------- Bundle actions (any [data-action][data-id] button, on any page) ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action][data-id]');
  if (!btn || btn.disabled) return;
  const { action, id } = btn.dataset;
  const p = getProduct(id);
  if (!p) return;
  if (action === 'add') {
    if (bundle.getQty(id) >= bundle.MAX_QTY) return;
    bundle.add(id);
    // Quick-add from catalog cards gets a toast; the builder shows its own state.
    if (btn.classList.contains('cart-btn')) toast(`Added <strong>${esc(p.name)}</strong> · ${bundle.getQty(id)} in bundle`, { href: '#/review', label: 'View bundle' });
  } else if (action === 'dec') bundle.decrement(id);
  else if (action === 'remove') bundle.remove(id);
  else if (action === 'toggle') bundle.toggle(id);
});

// ---------- Cart badge ----------
const badge = document.querySelector('[data-cart-count]');
const cartLink = document.querySelector('[data-cart-link]');
function updateBadge(bump = false) {
  const { count } = bundle.summary();
  badge.textContent = count > 99 ? '99+' : String(count);
  cartLink.setAttribute('aria-label', `Bundle, ${count} item${count === 1 ? '' : 's'}`);
  if (bump) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
}
bundle.subscribe((change) => updateBadge(change.qty > (change.prev || 0)));
updateBadge();

// ---------- Mobile menu ----------
const menu = document.querySelector('[data-menu]');
const menuBtn = document.querySelector('[data-menu-open]');

function openMenu() {
  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('is-open'));
  menuBtn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  if (menu.hidden) return;
  menu.classList.remove('is-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  setTimeout(() => { menu.hidden = true; }, 350);
}
menuBtn.addEventListener('click', openMenu);
menu.addEventListener('click', (e) => {
  if (e.target.closest('[data-menu-close]') || e.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

// Header/menu search → catalog with the query.
document.querySelectorAll('[data-search]').forEach((f) => f.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = f.querySelector('input').value.trim();
  location.hash = q ? `#/products?q=${encodeURIComponent(q)}` : '#/products';
}));

// Static icon placeholders in index.html
document.querySelectorAll('[data-icon]').forEach((el) => {
  el.outerHTML = icon(el.dataset.icon, el.dataset.iconClass || 'w-5 h-5');
});

document.getElementById('site-footer').innerHTML = footer();
window.addEventListener('hashchange', render);
app.innerHTML = loadingView();
loadCatalog({ timeoutMs: 4000 }).finally(render); // live prices from the database (bundled list as fallback)
