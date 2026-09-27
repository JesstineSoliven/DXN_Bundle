// App shell: hash router, nav state, mobile menu, bundle actions and cart badge.
// Views are { render(params) → HTML, mount?(root, params) → cleanup }.
import { icon } from './icons.js';
import { footer, toast, esc } from './components.js';
import { getProduct } from './data/products.js';
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

const routes = {
  home: { render: renderHome, nav: 'home' },
  products: { render: renderProducts, mount: mountProducts, nav: 'products' },
  customize: { render: renderCustomize, mount: mountCustomize, nav: 'customize' },
  review: { render: renderReview, mount: mountReview, nav: 'customize' },
  checkout: { render: renderCheckout, mount: mountCheckout, nav: 'customize' },
  order: { render: renderConfirmation, mount: mountConfirmation, nav: null },
  pay: { render: renderPayment, mount: mountPayment, nav: null },
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

function render() {
  // In-page anchors (#about, #contact) scroll without re-routing.
  if (location.hash && !location.hash.startsWith('#/')) {
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  const { name, params } = parseHash();
  const route = routes[name] || routes.home;
  cleanup?.(); cleanup = null;
  app.innerHTML = `<div class="view-enter">${route.render(params)}</div>`;
  cleanup = route.mount?.(app, params) || null;
  setActive(route.nav);
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
render();
