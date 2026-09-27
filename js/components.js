// Reusable UI pieces. Pure functions returning HTML strings.
import { icon } from './icons.js';
import { categories, filterCategories, formatPeso, FEATURED_PACKAGE_PRICE, categoryName } from './data/products.js';

const CATEGORY_ICON = { beverages: 'cup', food: 'leaf', supplements: 'sprout', 'personal-care': 'heart', skincare: 'sparkle', household: 'home', apparel: 'shirt', appliance: 'gear' };

/** Product photo, or a branded placeholder tile when no photo exists yet. */
export const productImage = (p, cls = 'w-full h-full') => p.image
  ? `<img src="${p.image}" alt="${esc(p.name)}" class="${cls} object-contain" loading="lazy">`
  : `<div class="${cls} product-ph" role="img" aria-label="${esc(p.name)}">
       ${icon(CATEGORY_ICON[p.category] || 'box', 'w-[34%] h-[34%] max-w-[44px] max-h-[44px] text-brand/70', 1.4)}
       <span class="product-ph__code">${esc(p.code)}</span>
     </div>`;

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const arrowLink = (href, label, cls = 'text-[13px]') =>
  `<a href="${href}" class="link-arrow ${cls}">${label}${icon('arrowRight', 'w-4 h-4')}</a>`;

export const checkItem = (text, { gold = false, cls = 'text-[13px]' } = {}) =>
  `<li class="flex items-center gap-2.5 ${cls}"><span class="check-dot ${gold ? 'gold' : ''}">${icon('check', 'w-3 h-3', 3)}</span>${esc(text)}</li>`;

/** Category filter chips. `active` is a category id or 'all'. */
export function chips(active = 'all', { size = '', hrefBase = '#/products', only = null } = {}) {
  const all = [{ id: 'all', name: 'All Products' }, ...filterCategories.filter((c) => !only || only.includes(c.id))];
  return all.map((c) => {
    const href = c.id === 'all' ? hrefBase : `${hrefBase}?cat=${c.id}`;
    return `<a href="${href}" data-cat="${c.id}" class="chip ${size} inline-flex items-center ${c.id === active ? 'is-active' : ''}" ${c.id === active ? 'aria-current="true"' : ''}>${esc(c.name)}</a>`;
  }).join('');
}

/** Horizontal product card (desktop featured row). */
export const productCardRow = (p) => `
  <article class="card card-lift flex items-center gap-4 p-3 pr-4 min-w-[252px] lg:min-w-0">
    <div class="w-[92px] h-[92px] shrink-0 rounded-lg bg-white overflow-hidden">${productImage(p)}</div>
    <div class="flex-1 min-w-0 self-stretch flex flex-col justify-between py-1.5">
      <h3 class="text-[13.5px] leading-snug text-ink">${esc(p.name)}</h3>
      <div class="flex items-end justify-between gap-2 mt-2">
        <span class="font-price font-extrabold text-[17px]">${formatPeso(p.price)}</span>
        <button type="button" class="cart-btn" data-action="add" data-id="${p.id}" aria-label="Add ${esc(p.name)} to bundle">${icon('cart', 'w-[18px] h-[18px]')}</button>
      </div>
    </div>
  </article>`;

/** Vertical product card (mobile grids, catalog). */
export const productCardTile = (p) => `
  <article class="card card-lift p-3 flex flex-col">
    <div class="aspect-[1/0.9] rounded-lg bg-white grid place-items-center overflow-hidden">
      ${productImage(p)}
    </div>
    <h3 class="mt-2 text-[13.5px] leading-snug line-clamp-2">${esc(p.name)}</h3>
    <p class="text-[12px] text-ink-mute leading-snug mt-0.5 line-clamp-1">${esc(p.size || categoryName(p.category))}</p>
    <div class="mt-auto pt-2 flex items-center justify-between">
      <span class="font-price font-extrabold text-[16px]">${formatPeso(p.price)}</span>
      <button type="button" class="cart-btn" data-action="add" data-id="${p.id}" aria-label="Add ${esc(p.name)} to bundle">${icon('cart', 'w-[18px] h-[18px]')}</button>
    </div>
  </article>`;

/** Bundle-builder product card (Customize screen). `qty` > 0 renders the selected state. */
export const bundleCard = (p, qty = 0) => `
  <article class="card card-lift flex gap-3.5 p-3 ${qty ? 'ring-1 ring-brand/25' : ''}" data-product="${p.id}">
    <div class="w-[38%] max-w-[160px] shrink-0 aspect-square rounded-xl bg-white grid place-items-center overflow-hidden">
      ${productImage(p)}
    </div>
    <div class="flex-1 min-w-0 flex flex-col py-1">
      <div class="flex items-start gap-2">
        <h3 class="flex-1 text-[15px] sm:text-[16px] font-semibold leading-snug">${esc(p.name)}</h3>
        <button type="button" data-action="toggle" data-id="${p.id}" class="checkbox ${qty ? 'is-checked' : ''}" role="checkbox" aria-checked="${qty ? 'true' : 'false'}" aria-label="Include ${esc(p.name)}">${qty ? icon('check', 'w-4 h-4', 3) : ''}</button>
      </div>
      <p class="text-[13px] text-ink-mute leading-snug mt-1">${esc(p.size || categoryName(p.category))}</p>
      <div class="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
        <span class="font-price font-extrabold text-[17px]">${formatPeso(p.price)}</span>
        ${qty
          ? `<div class="stepper" role="group" aria-label="Quantity for ${esc(p.name)}">
               <button type="button" data-action="dec" data-id="${p.id}" aria-label="${qty === 1 ? 'Remove' : 'Decrease'} ${esc(p.name)}">${icon('minus', 'w-4 h-4', 2.2)}</button>
               <output>${qty}</output>
               <button type="button" data-action="add" data-id="${p.id}" class="stepper-plus" aria-label="Increase ${esc(p.name)}" ${qty >= 99 ? 'disabled' : ''}>${icon('plus', 'w-4 h-4', 2.4)}</button>
             </div>`
          : `<button type="button" data-action="add" data-id="${p.id}" class="add-btn" aria-label="Add ${esc(p.name)}">${icon('plus', 'w-5 h-5', 2.4)}</button>`}
      </div>
    </div>
  </article>`;

/** Shop-by-category card. `layout`: 'row' (desktop) | 'tile' (mobile). */
export const categoryCard = (c, layout = 'row') => layout === 'row'
  ? `<a href="#/products?cat=${c.id}" class="card-lift group flex items-center gap-3 rounded-xl bg-sand pr-4 overflow-hidden h-[102px]">
       <img src="${c.image}" alt="" class="h-full w-[46%] object-cover object-center" loading="lazy">
       <span class="flex flex-col gap-1.5">
         <span class="text-[15px] font-semibold leading-tight">${esc(c.name)}</span>
         <span class="inline-flex items-center gap-2 text-[12px] text-ink-soft">Shop now ${icon('arrowRight', 'w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5')}</span>
       </span>
     </a>`
  : `<a href="#/products?cat=${c.id}" class="card-lift flex flex-col items-center rounded-xl bg-sand overflow-hidden pb-3">
       <img src="${c.image}" alt="" class="w-full aspect-[1.25] object-cover" loading="lazy">
       <span class="text-[14px] font-semibold mt-2">${esc(c.name)}</span>
       ${icon('arrowRight', 'w-4 h-4 mt-1')}
     </a>`;

/** Featured ₱7,999 package card (hero). The price is a featured reference, not a minimum. */
export const featuredPackageCard = () => `
  <div class="relative rounded-[18px] bg-[#F8F7F2]/[.97] shadow-[var(--shadow-3)] pt-12 lg:pt-9">
    <span class="ribbon">FEATURED PACKAGE</span>
    <div class="px-5 lg:px-7 text-center">
      <h2 class="font-serif text-[20px] lg:text-[25px] text-ink">DXN Bundle Package</h2>
      <p class="font-price font-black text-brand tracking-[-0.03em] text-[58px] lg:text-[70px] leading-[1.02] mt-0.5">${formatPeso(FEATURED_PACKAGE_PRICE)}</p>
      <p class="text-[15px] lg:text-[16.5px] leading-snug mt-1.5 text-ink">Create your own combination<br>or let us surprise you!</p>
    </div>
    <div class="grid lg:grid-cols-2 gap-3 lg:gap-0 px-5 lg:px-3 mt-4">
      <div class="lg:pr-3 lg:border-r border-line text-center">
        <a href="#/customize" class="btn btn-green w-full h-[62px] lg:h-[58px] text-[15px] lg:text-[14px] leading-tight px-4 lg:px-3 lg:gap-2.5">
          ${icon('gear', 'w-7 h-7 lg:w-6 lg:h-6 shrink-0', 1.6)}<span class="text-left whitespace-nowrap">Customize<br>Your Bundle</span>${icon('chevronRight', 'w-5 h-5 btn-arrow ml-auto lg:ml-0', 2)}
        </a>
        <p class="hidden lg:block text-[11.5px] text-ink-soft leading-snug mt-2.5">Choose the DXN products<br>you want to include.</p>
      </div>
      <div class="lg:pl-3 text-center">
        <a href="#/mystery-box" class="btn btn-gold w-full h-[62px] lg:h-[58px] text-[15px] lg:text-[14px] px-4 lg:px-3 lg:gap-2.5">
          ${icon('box', 'w-7 h-7 lg:w-6 lg:h-6 shrink-0', 1.5)}<span class="whitespace-nowrap">Mystery Box</span>${icon('chevronRight', 'w-5 h-5 btn-arrow ml-auto lg:ml-0', 2)}
        </a>
        <p class="hidden lg:block text-[11.5px] text-ink-soft leading-snug mt-2.5">A curated mix of DXN<br>bestsellers and new products.</p>
      </div>
    </div>
    <div class="mt-4 lg:mt-3 mx-4 lg:mx-0 mb-4 lg:mb-0 flex items-center justify-center gap-3 rounded-xl lg:rounded-none lg:rounded-b-[18px] bg-brand-mist/80 px-4 py-3 lg:py-2.5 text-[12.5px] lg:text-[12px] text-ink">
      ${icon('leaf', 'w-6 h-6 text-brand shrink-0', 1.6)}
      <span>Same great DXN products. <br class="lg:hidden">You choose the experience.</span>
    </div>
  </div>`;

/** Shared site footer. Holds the #about / #contact anchors used by the nav. */
export const footer = () => `
  <div class="bg-white border-t border-line">
    <div class="mx-auto max-w-[1480px] px-5 lg:px-10 py-8 lg:py-10 grid gap-8 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
      <div id="about">
        <div class="flex items-center gap-4">
          <img src="assets/img/logo.webp" alt="DXN" class="h-14 w-auto">
          <span class="h-12 w-px bg-line"></span>
          <span class="text-[11px] leading-[1.4] tracking-[0.14em] text-[#233a6b] font-semibold">ONE WORLD<br>ONE MARKET<br>ONE FAMILY</span>
        </div>
        <p class="hidden lg:block text-[13px] text-ink-mute mt-4 max-w-xs">Authentic DXN wellness products, bundled your way. Better health, a brighter tomorrow.</p>
      </div>
      <nav class="flex flex-col lg:gap-2" aria-label="Footer">
        ${[['About DXN', '#about'], ['Products', '#/products'], ['Bundles', '#/customize'], ['Mystery Box', '#/mystery-box'], ['Contact Us', '#contact']]
          .map(([l, h]) => `<a href="${h}" class="footer-link flex items-center justify-between py-2 lg:py-0 text-[14px] text-ink-soft hover:text-ink active:opacity-60">${l}${icon('chevronRight', 'w-4 h-4 lg:hidden')}</a>`).join('')}
      </nav>
      <div class="hidden lg:block text-[13px] text-ink-mute space-y-1.5">
        <p class="font-bold text-ink text-[14px]">Contact</p>
        <p>Message us on Facebook for orders and bundle questions.</p>
      </div>
      <div id="contact" class="flex lg:flex-col items-center lg:items-start justify-center gap-6 lg:gap-3">
        <p class="hidden lg:block font-bold text-ink text-[14px]">Follow us</p>
        <div class="flex gap-6 lg:gap-4 text-ink">
          <a href="#contact" aria-label="Facebook" class="icon-btn w-9 h-9">${icon('facebook', 'w-6 h-6')}</a>
          <a href="#contact" aria-label="YouTube" class="icon-btn w-9 h-9">${icon('youtube', 'w-6 h-6')}</a>
          <a href="#contact" aria-label="Instagram" class="icon-btn w-9 h-9">${icon('instagram', 'w-6 h-6')}</a>
        </div>
      </div>
    </div>
    <p class="text-center text-[11.5px] text-ink-mute pb-6">© ${new Date().getFullYear()} DXN Bundle Store. Independent DXN distributor.</p>
  </div>`;

export { categories, icon, formatPeso };

/** Filter + sort the catalog. cat: category id | 'all'; q: free text; sort: 'featured' | 'price-asc' | 'price-desc' | 'name'. */
export function filterProducts(list, { cat = 'all', q = '', sort = 'featured' } = {}) {
  const needle = q.trim().toLowerCase();
  const catName = (id) => (categories.find((c) => c.id === id)?.name || '').toLowerCase();
  const out = list.filter((p) =>
    (cat === 'all' || cat === 'bundles' || p.category === cat) &&
    (!needle || `${p.name} ${p.size} ${p.code} ${catName(p.category)}`.replace(/\u00a0/g, ' ').toLowerCase().includes(needle)));
  const by = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name),
  }[sort];
  return by ? [...out].sort(by) : out;
}

/** Bundle flow progress (Choose → Review → Checkout). */
export function steps(current = 1, { mystery = false } = {}) {
  const items = mystery
    ? [['Mystery Box', '#/mystery-box'], ['Review Order', '#/review?type=mystery'], ['Checkout', '#/checkout?type=mystery']]
    : [['Choose Products', '#/customize'], ['Review Bundle', '#/review'], ['Checkout', '#/checkout']];
  return `
  <ol class="relative flex justify-between max-w-[760px] mx-auto px-2" aria-label="Bundle progress">
    <span class="absolute left-[16.67%] right-[16.67%] top-[15px] h-[2px] bg-[#D9DAD8]" aria-hidden="true"></span>
    <span class="absolute left-[16.67%] top-[15px] h-[2px] w-[66.66%] bg-brand origin-left" style="transform:scaleX(${(current - 1) / 2})" aria-hidden="true"></span>
    ${items.map(([l, href], i) => {
      const n = i + 1, on = n <= current, done = n < current;
      const inner = `<span class="w-8 h-8 rounded-full grid place-items-center text-[14px] font-bold border-2 ${on ? 'bg-brand border-brand text-white' : 'bg-[#E6E6E3] border-white text-ink-soft'} ${n === current ? 'ring-4 ring-brand/15' : ''}">${done ? icon('check', 'w-4 h-4', 3) : n}</span>
        <span class="text-[13px] sm:text-[15px] ${on ? 'text-brand font-semibold' : 'text-ink-soft'}">${l}</span>`;
      return `<li class="relative w-1/3 flex justify-center" ${n === current ? 'aria-current="step"' : ''}>${done
        ? `<a href="${href}" class="flex flex-col items-center gap-1.5 hover:opacity-80 active:opacity-60">${inner}</a>`
        : `<span class="flex flex-col items-center gap-1.5">${inner}</span>`}</li>`;
    }).join('')}
  </ol>`;
}

/** Informational line about the ₱7,999 featured package. Never a requirement. */
export function referenceNote(s) {
  if (!s.count) return `Featured package: ${formatPeso(s.reference)} · any amount can check out`;
  if (s.diff > 0) return `${formatPeso(s.diff)} away from the ${formatPeso(s.reference)} featured package`;
  if (s.diff === 0) return `Matches the ${formatPeso(s.reference)} featured package`;
  return `${formatPeso(-s.diff)} above the ${formatPeso(s.reference)} featured package`;
}

/** Brief confirmation toast (uses the #toast live region in index.html). */
let toastTimer;
export function toast(message, action) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `<span>${message}</span>${action ? `<a href="${action.href}" class="font-bold underline underline-offset-2 whitespace-nowrap hover:opacity-80 active:opacity-60">${action.label}</a>` : ''}`;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/** Replace a container's HTML while keeping keyboard focus on the equivalent control. */
export function rerender(container, html) {
  const a = document.activeElement;
  const key = a && container.contains(a) ? { action: a.dataset.action, id: a.dataset.id, sort: a.dataset.sort } : null;
  container.innerHTML = html;
  if (!key || !(key.id || key.sort)) return;
  const sel = key.sort ? [`[data-sort="${key.sort}"]`]
    : [`[data-action="${key.action}"][data-id="${key.id}"]`, `[data-action="add"][data-id="${key.id}"]`, `[data-id="${key.id}"]`];
  for (const s of sel) { const el = container.querySelector(s); if (el && !el.disabled) { el.focus({ preventScroll: true }); return; } }
}

/** Visually-hidden live announcement for screen readers. */
export function announce(text) {
  const el = document.getElementById('sr-live');
  if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = text; }); }
}
