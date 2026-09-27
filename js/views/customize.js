// Customize Your Bundle — per "checking out.png". Live search, category chips, sort, add/remove, quantities.
// Checkout is never blocked by the total: ₱7,999 is shown only as a featured reference.
import { icon, chips, bundleCard, formatPeso, esc, filterProducts, steps, referenceNote, rerender, announce } from '../components.js';
import { products, filterCategories } from '../data/products.js';
import * as bundle from '../store/bundle.js';

const SORTS = [['featured', 'Featured'], ['price-asc', 'Price: Low to High'], ['price-desc', 'Price: High to Low'], ['name', 'Name: A–Z']];
const validCat = (c) => (c === 'all' || filterCategories.some((x) => x.id === c) ? c : 'all');

function readState(params) {
  return {
    cat: validCat(params.get('cat') || 'all'),
    q: params.get('q') || '',
    sort: SORTS.some(([k]) => k === params.get('sort')) ? params.get('sort') : 'featured',
  };
}

const grid = (state) => {
  const list = filterProducts(products, state);
  const filtered = state.cat !== 'all' || state.q;
  return `
    <p class="text-[13px] text-ink-mute mb-3 flex items-center gap-3" aria-live="polite">
      <span>${list.length} product${list.length === 1 ? '' : 's'}${state.q ? ` for “${esc(state.q)}”` : ''}</span>
      ${filtered ? `<button type="button" data-clear-filters class="text-brand font-semibold underline underline-offset-2 hover:opacity-75 active:opacity-50">Clear filters</button>` : ''}
    </p>
    ${list.length
      ? `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">${list.map((p) => bundleCard(p, bundle.getQty(p.id))).join('')}</div>`
      : `<div class="card p-10 text-center">
           ${icon('search', 'w-10 h-10 mx-auto text-ink-mute', 1.5)}
           <p class="font-semibold mt-3">No products match your search.</p>
           <button type="button" data-clear-filters class="btn btn-green h-11 px-6 mt-4 text-[14px]">Show all products</button>
         </div>`}`;
};

const bar = (s) => `
  <div class="mx-auto max-w-[1180px] px-4 sm:px-6 py-3 lg:py-4 grid grid-cols-[1fr_1.15fr] lg:grid-cols-[1fr_1fr_auto] items-center gap-x-4 gap-y-2">
    <div>
      <p class="text-[14px] sm:text-[16px]">Bundle Total (${s.count} item${s.count === 1 ? '' : 's'})</p>
      <p class="font-price font-extrabold text-[26px] sm:text-[32px] leading-tight">${formatPeso(s.subtotal)}</p>
      <p class="text-[12px] sm:text-[13px] text-ink-mute leading-snug">${s.count ? `Check out at any amount<span class="hidden sm:inline"> · ${referenceNote(s)}</span>` : 'Add products to start your bundle'}</p>
    </div>
    <div class="flex flex-col gap-2.5 lg:contents">
      <div class="flex items-center gap-3 lg:px-4">
        <div class="progress-track flex-1" role="progressbar" aria-valuenow="${Math.min(s.pct, 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress toward the featured ${formatPeso(s.reference)} package">
          <div class="progress-fill" style="transform:scaleX(${s.fill})"></div>
        </div>
        <span class="text-[12px] sm:text-[14px] text-ink-soft whitespace-nowrap">${s.pct}% of ${formatPeso(s.reference)}</span>
      </div>
      <a href="#/review" class="btn btn-green h-12 sm:h-14 px-3 sm:px-6 text-[14px] sm:text-[17px] whitespace-nowrap w-full lg:w-[300px]">Next: Review Bundle${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}</a>
    </div>
  </div>`;

const sortPanel = (sort) => SORTS.map(([k, l]) =>
  `<button type="button" role="menuitemradio" aria-checked="${k === sort}" data-sort="${k}">${l}${k === sort ? icon('check', 'w-4 h-4', 2.6) : ''}</button>`).join('');

export function renderCustomize(params) {
  const state = readState(params);
  return `
  <section class="relative h-[190px] sm:h-[238px] bg-cover bg-[62%_center] sm:bg-[center_60%]" style="background-image:url('assets/img/customize-banner.webp')">
    <div class="absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-transparent"></div>
    <div class="relative mx-auto max-w-[1180px] h-full px-5 sm:px-10 flex flex-col justify-center text-white">
      <h1 class="font-script text-[34px] sm:text-[46px] leading-[1.1] [text-shadow:0_2px_14px_rgba(0,0,0,.3)]">Build Your<br>DXN Bundle</h1>
      <p class="mt-2 text-[13px] sm:text-[17px] leading-snug max-w-[175px] sm:max-w-[330px] [text-shadow:0_1px_8px_rgba(0,0,0,.4)]">Choose the products you want and create your own DXN package.</p>
    </div>
  </section>

  <div class="bg-[#F3F3F1] border-b border-line py-4">${steps(1)}</div>

  <section class="mx-auto max-w-[1180px] px-3 sm:px-6 pt-5 pb-44 lg:pb-36">
    <div class="relative text-center mb-5">
      <a href="#/" class="absolute left-0 top-0.5 sm:left-1 sm:top-1 inline-flex items-center gap-1.5 text-[15px] text-ink hover:opacity-70 active:opacity-50" aria-label="Back">${icon('chevronLeft', 'w-5 h-5', 2)}<span class="hidden sm:inline">Back</span></a>
      <h2 class="font-serif text-[20px] sm:text-[26px]">Customize Your Bundle</h2>
      <p class="text-[14px] sm:text-[15px] text-ink-soft mt-1">Select the DXN products you want to include.</p>
    </div>

    <div class="flex gap-3">
      <form class="search-field flex-1 flex items-center gap-3 h-12 rounded-[10px] bg-[#F1F1EE] px-4" role="search" data-bundle-search>
        ${icon('search', 'w-5 h-5 text-ink-soft')}
        <label for="bundle-search" class="sr-only">Search DXN products</label>
        <input id="bundle-search" type="search" value="${esc(state.q)}" placeholder="Search DXN products..." autocomplete="off" class="bg-transparent w-full text-[15px] focus:outline-none">
      </form>
      <div class="relative">
        <button type="button" class="icon-btn w-12 h-12 bg-[#F1F1EE] rounded-[10px]" aria-label="Sort products" aria-haspopup="menu" aria-expanded="false" data-sort-toggle>${icon('sliders', 'w-6 h-6')}</button>
        <div class="popover" role="menu" aria-label="Sort by" data-sort-panel hidden>${sortPanel(state.sort)}</div>
      </div>
    </div>
    <div class="flex gap-2.5 scroll-x -mx-3 px-3 sm:mx-0 sm:px-0 mt-4" data-chips>${chips(state.cat, { size: 'chip-lg', hrefBase: '#/customize' })}</div>

    <div class="mt-4" data-grid>${grid(state)}</div>
  </section>

  <div class="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] lg:bottom-0 z-30 bg-white border-t border-line shadow-[0_-10px_30px_-18px_rgba(20,45,28,.35)]" data-bar>${bar(bundle.summary())}</div>`;
}

export function mountCustomize(root, params) {
  const state = readState(params);
  const $ = (s) => root.querySelector(s);
  const gridEl = $('[data-grid]'), barEl = $('[data-bar]'), chipsEl = $('[data-chips]');
  const panel = $('[data-sort-panel]'), sortBtn = $('[data-sort-toggle]'), search = $('#bundle-search');
  document.body.classList.add('has-bundle-bar');

  const syncUrl = () => {
    const p = new URLSearchParams();
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'featured') p.set('sort', state.sort);
    history.replaceState(null, '', `#/customize${p.toString() ? `?${p}` : ''}`);
  };
  const refresh = () => { rerender(gridEl, grid(state)); syncUrl(); };

  const setPanel = (open) => {
    sortBtn.setAttribute('aria-expanded', String(open));
    if (open) { panel.hidden = false; requestAnimationFrame(() => panel.classList.add('is-open')); panel.querySelector('[aria-checked="true"]')?.focus(); }
    else { panel.classList.remove('is-open'); panel.hidden = true; }
  };

  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value; refresh(); }, 120); });
  root.querySelector('[data-bundle-search]').addEventListener('submit', (e) => { e.preventDefault(); state.q = search.value; refresh(); });

  const onClick = (e) => {
    const chip = e.target.closest('[data-cat]');
    if (chip && chipsEl.contains(chip)) {
      e.preventDefault();
      state.cat = chip.dataset.cat;
      chipsEl.innerHTML = chips(state.cat, { size: 'chip-lg', hrefBase: '#/customize' });
      chipsEl.querySelector(`[data-cat="${state.cat}"]`)?.focus({ preventScroll: true });
      refresh();
      return;
    }
    if (e.target.closest('[data-clear-filters]')) {
      state.cat = 'all'; state.q = ''; search.value = '';
      chipsEl.innerHTML = chips('all', { size: 'chip-lg', hrefBase: '#/customize' });
      refresh(); search.focus();
      return;
    }
    if (e.target.closest('[data-sort-toggle]')) { setPanel(panel.hidden); return; }
    const opt = e.target.closest('[data-sort]');
    if (opt) {
      state.sort = opt.dataset.sort;
      panel.innerHTML = sortPanel(state.sort);
      setPanel(false); sortBtn.focus(); refresh();
      return;
    }
    if (!panel.hidden && !e.target.closest('[data-sort-panel]')) setPanel(false);
  };
  const onKey = (e) => { if (e.key === 'Escape' && !panel.hidden) { setPanel(false); sortBtn.focus(); } };
  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  const unsub = bundle.subscribe((change) => {
    rerender(gridEl, grid(state));
    barEl.innerHTML = bar(bundle.summary());
    const p = change.id && products.find((x) => x.id === change.id);
    if (p) announce(`${p.name}: ${change.qty ? `${change.qty} in bundle` : 'removed'}. Bundle total ${formatPeso(bundle.summary().subtotal)}.`);
  });

  return () => {
    unsub();
    root.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('has-bundle-bar');
  };
}
