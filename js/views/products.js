// DXN Products catalog: live search + category chips (state mirrored in the URL).
import { icon, chips, productCardTile, categoryCard, esc, filterProducts, rerender } from '../components.js';
import { products, categories, showcaseCategories, filterCategories } from '../data/products.js';

const readState = (params) => {
  const cat = params.get('cat') || 'all';
  return { cat: cat === 'all' || categories.some((c) => c.id === cat) ? cat : 'all', q: params.get('q') || '' };
};
const title = (cat) => categories.find((c) => c.id === cat)?.name || 'DXN Products';

const results = (state) => {
  const list = filterProducts(products, state);
  return list.length
    ? `<p class="text-[13px] text-ink-mute mb-3" aria-live="polite">${list.length} product${list.length === 1 ? '' : 's'}${state.q ? ` for “${esc(state.q)}”` : ''}</p>
       <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-5">${list.map(productCardTile).join('')}</div>`
    : `<div class="card p-10 text-center" aria-live="polite">
         ${icon('search', 'w-10 h-10 mx-auto text-ink-mute', 1.5)}
         <p class="font-semibold mt-3">No products match “${esc(state.q)}”.</p>
         <button type="button" data-clear-filters class="btn btn-green h-11 px-6 mt-4 text-[14px]">Show all products</button>
       </div>`;
};

export function renderProducts(params) {
  const state = readState(params);
  return `
  <section class="mx-auto max-w-[1480px] px-4 lg:px-10 pt-6 lg:pt-10 pb-12">
    <div class="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-8 mb-5">
      <div>
        <h1 class="font-extrabold lg:font-bold lg:font-serif text-[22px] lg:text-[30px]" data-title>${esc(title(state.cat))}</h1>
        <p class="text-[14px] text-ink-mute mt-1">Authentic DXN products — add any to your bundle.</p>
      </div>
      <form class="search-field lg:ml-auto flex items-center gap-3 h-11 lg:w-[340px] rounded-[10px] bg-[#F1F1EE] px-4" role="search" data-catalog-search>
        ${icon('search', 'w-5 h-5 text-ink-soft')}
        <label for="catalog-search" class="sr-only">Search DXN products</label>
        <input id="catalog-search" type="search" value="${esc(state.q)}" placeholder="Search DXN products..." autocomplete="off" class="bg-transparent w-full text-[14px] focus:outline-none">
      </form>
    </div>
    <div class="flex gap-2.5 scroll-x -mx-4 px-4 lg:mx-0 lg:px-0 mb-6" data-chips>${chips(filterCategories.some((c) => c.id === state.cat) ? state.cat : 'all')}</div>

    <div data-results>${results(state)}</div>

    <div class="mt-12">
      <h2 class="font-extrabold lg:font-bold lg:font-serif text-[19px] lg:text-[20px] mb-4">Shop by Category</h2>
      <div class="hidden lg:grid grid-cols-5 gap-4">${showcaseCategories.map((c) => categoryCard(c, 'row')).join('')}</div>
      <div class="grid lg:hidden grid-cols-2 gap-3">${showcaseCategories.slice(0, 4).map((c) => categoryCard(c, 'tile')).join('')}</div>
    </div>
  </section>`;
}

export function mountProducts(root, params) {
  const state = readState(params);
  const resultsEl = root.querySelector('[data-results]'), chipsEl = root.querySelector('[data-chips]');
  const titleEl = root.querySelector('[data-title]'), search = root.querySelector('#catalog-search');

  const refresh = () => {
    rerender(resultsEl, results(state));
    titleEl.textContent = title(state.cat);
    const p = new URLSearchParams();
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.q) p.set('q', state.q);
    history.replaceState(null, '', `#/products${p.toString() ? `?${p}` : ''}`);
  };

  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value; refresh(); }, 120); });
  root.querySelector('[data-catalog-search]').addEventListener('submit', (e) => { e.preventDefault(); state.q = search.value; refresh(); });

  const onClick = (e) => {
    const chip = e.target.closest('[data-cat]');
    if (chip && chipsEl.contains(chip)) {
      e.preventDefault();
      state.cat = chip.dataset.cat;
      chipsEl.innerHTML = chips(state.cat);
      chipsEl.querySelector(`[data-cat="${state.cat}"]`)?.focus({ preventScroll: true });
      refresh();
    } else if (e.target.closest('[data-clear-filters]')) {
      state.q = ''; state.cat = 'all'; search.value = '';
      chipsEl.innerHTML = chips('all');
      refresh(); search.focus();
    }
  };
  root.addEventListener('click', onClick);
  if (state.q) search.focus();
  return () => root.removeEventListener('click', onClick);
}
