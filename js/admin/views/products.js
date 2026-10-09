// Products: list (search, category, archived), inline price edit, add/edit dialog, archive/restore.
// Changes reach the storefront within ~1 minute (catalog cache).
import { admin } from '../api.js';
import { icon, esc, peso, activeChip, pageHead, empty, toast, debounce, fieldErrors, compressImage, blobToBase64 } from '../ui.js';

let state = { q: '', cat: '', archived: false };

const thumb = (p) => p.image
  ? `<img src="${esc(p.image)}" alt="" class="w-11 h-11 rounded-lg object-contain bg-white border border-line" loading="lazy">`
  : `<span class="w-11 h-11 rounded-lg grid place-items-center bg-brand-soft text-brand/70 text-[10px] font-bold">${esc(p.code)}</span>`;

function rows(products, cats) {
  const needle = state.q.toLowerCase();
  const list = products.filter((p) => (state.archived || p.active)
    && (!state.cat || p.category === state.cat)
    && (!needle || `${p.code} ${p.name} ${p.size}`.toLowerCase().includes(needle)));
  if (!list.length) return `<tr><td colspan="7" class="text-center text-ink-mute py-10">No products match.</td></tr>`;
  const catName = Object.fromEntries(cats.map((c) => [c.id, c.name]));
  return list.map((p) => `
    <tr class="${p.active ? '' : 'is-muted'}" data-id="${esc(p.id)}">
      <td><div class="flex items-center gap-3">${thumb(p)}<div class="min-w-0"><p class="font-semibold leading-snug">${esc(p.name)}${p.featuredRank != null ? ` <span class="st st-confirmed ml-1">Featured #${p.featuredRank + 1}</span>` : ''}</p><p class="text-[12px] text-ink-mute">${esc(p.code)}${p.size ? ` · ${esc(p.size)}` : ''}</p></div></div></td>
      <td class="whitespace-nowrap">${esc(catName[p.category] || p.category)}</td>
      <td class="num"><label class="sr-only" for="price-${esc(p.id)}">Price for ${esc(p.name)}</label>
        <div class="inline-flex items-center gap-1"><span class="text-ink-mute">₱</span><input id="price-${esc(p.id)}" class="adm-input w-[96px] text-right" inputmode="numeric" value="${p.price}" data-price data-was="${p.price}"></div></td>
      <td class="num">${p.unitsSold}</td>
      <td class="num">${peso(p.sales)}</td>
      <td>${activeChip(p.active)}</td>
      <td class="whitespace-nowrap text-right">
        <button type="button" class="icon-btn w-9 h-9" data-edit aria-label="Edit ${esc(p.name)}">${icon('edit', 'w-[18px] h-[18px]', 1.8)}</button>
        <button type="button" class="icon-btn w-9 h-9" data-toggle aria-label="${p.active ? 'Archive' : 'Restore'} ${esc(p.name)}" title="${p.active ? 'Archive (hide from store)' : 'Restore to store'}">${icon(p.active ? 'archive' : 'refresh', 'w-[18px] h-[18px]', 1.8)}</button>
      </td>
    </tr>`).join('');
}

const dialog = (cats, p = null) => `
  <dialog class="adm-dialog" data-dialog>
    <form method="dialog" class="p-6" data-product-form novalidate>
      <h2 class="font-serif text-[20px]">${p ? 'Edit product' : 'Add product'}</h2>
      <div class="grid sm:grid-cols-2 gap-3 mt-4 text-[13px]">
        <label class="flex flex-col gap-1 font-semibold">Product code
          <input name="code" class="adm-input uppercase" value="${esc(p?.code || '')}" ${p ? 'disabled' : 'required'} placeholder="FB999" maxlength="20"></label>
        <label class="flex flex-col gap-1 font-semibold">Category
          <select name="category" class="adm-input">${cats.map((c) => `<option value="${esc(c.id)}" ${c.id === p?.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="flex flex-col gap-1 font-semibold sm:col-span-2">Name
          <input name="name" class="adm-input" value="${esc(p?.name || '')}" required maxlength="160"></label>
        <label class="flex flex-col gap-1 font-semibold">Size / pack
          <input name="size" class="adm-input" value="${esc(p?.size || '')}" placeholder="20 sachets x 21g" maxlength="80"></label>
        <label class="flex flex-col gap-1 font-semibold">Price (CP, ₱)
          <input name="price" class="adm-input" inputmode="numeric" value="${p?.price ?? ''}" required></label>
        <div class="sm:col-span-2 flex flex-col gap-1 font-semibold">Photo
          <div class="flex items-center gap-3">
            <img data-preview src="${esc(p?.image || '')}" alt="" class="w-16 h-16 rounded-lg object-contain bg-white border border-line shrink-0" ${p?.image ? '' : 'hidden'}>
            <label class="btn btn-ghost btn-sm cursor-pointer">${icon('plus', 'w-4 h-4', 2.4)}Upload photo
              <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-file></label>
            <button type="button" class="text-[12.5px] font-normal text-ink-mute underline hover:text-ink" data-clear-image ${p?.image ? '' : 'hidden'}>Remove</button>
            <span class="text-[12px] font-normal text-ink-mute" data-upload-status role="status"></span>
          </div>
          <input name="image" class="adm-input mt-1" value="${esc(p?.image || '')}" maxlength="500" placeholder="…or paste an image link (https://…)"></div>
        <label class="flex flex-col gap-1 font-semibold">Featured position <span class="font-normal text-ink-mute">(1–6 on the home page; blank = not featured)</span>
          <input name="featuredRank" class="adm-input" inputmode="numeric" value="${p?.featuredRank != null ? p.featuredRank + 1 : ''}"></label>
      </div>
      <p class="field-error mt-3" data-form-error hidden></p>
      <div class="flex justify-end gap-2 mt-5">
        <button type="button" class="btn btn-ghost btn-sm" data-close>Cancel</button>
        <button type="submit" class="btn btn-green btn-sm" data-save>${p ? 'Save changes' : 'Add product'}</button>
      </div>
    </form>
  </dialog>`;

export default {
  title: 'Products',
  load: () => Promise.all([admin.get('products'), admin.get('categories')]).then(([a, b]) => ({ products: a.products, categories: b.categories })),
  render(d) {
    const active = d.products.filter((p) => p.active).length;
    return `
    ${pageHead('Products', `${active} active · ${d.products.length - active} archived · prices are CP (Consumer Price). Changes show in the store within about a minute.`,
      `<button type="button" class="btn btn-green btn-sm" data-add>${icon('plus', 'w-4 h-4', 2.4)}Add product</button>`)}
    <div class="card p-4 flex flex-wrap items-end gap-3 mb-4">
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute flex-1 min-w-[220px]">Search
        <input type="search" class="adm-input" placeholder="Code, name or size" value="${esc(state.q)}" data-search></label>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute">Category
        <select class="adm-input min-w-[170px]" data-cat><option value="">All categories</option>${d.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === state.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="inline-flex items-center gap-2 text-[13px] font-semibold h-9"><input type="checkbox" class="w-4 h-4 accent-[#1A552E]" data-archived ${state.archived ? 'checked' : ''}>Show archived</label>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Product</th><th>Category</th><th class="num">Price</th><th class="num">Sold</th><th class="num">Sales</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody data-rows>${rows(d.products, d.categories)}</tbody>
      </table>
    </div>
    <p class="text-[12px] text-ink-mute mt-3">Price: type a new amount and press Enter (or click away) to save. Archived products are hidden from the store but stay on past orders.</p>
    <div data-dialog-host></div>`;
  },
  mount(root, _p, d) {
    const tbody = root.querySelector('[data-rows]');
    const redraw = () => { tbody.innerHTML = rows(d.products, d.categories); };
    const byId = (id) => d.products.find((p) => p.id === id);

    root.querySelector('[data-search]').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); redraw(); }, 200));
    root.querySelector('[data-cat]').addEventListener('change', (e) => { state.cat = e.target.value; redraw(); });
    root.querySelector('[data-archived]').addEventListener('change', (e) => { state.archived = e.target.checked; redraw(); });

    async function savePrice(input) {
      const p = byId(input.closest('tr').dataset.id);
      const v = Number(String(input.value).replace(/[₱,\s]/g, ''));
      if (v === p.price) { input.value = p.price; return; }
      if (!Number.isInteger(v) || v < 1) { input.classList.add('is-invalid'); toast('Price must be a whole number of pesos.', 'error'); return; }
      input.classList.remove('is-invalid');
      try {
        const { product } = await admin.patch(`products/${encodeURIComponent(p.id)}`, { price: v });
        p.price = product.price;
        input.classList.add('is-saved'); setTimeout(() => input.classList.remove('is-saved'), 1500);
        toast(`${p.code} price updated to ${peso(v)}`);
      } catch (err) { input.classList.add('is-invalid'); toast(err.message, 'error'); }
    }
    tbody.addEventListener('keydown', (e) => {
      if (!e.target.matches('[data-price]')) return;
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      if (e.key === 'Escape') { e.target.value = byId(e.target.closest('tr').dataset.id).price; e.target.blur(); }
    });
    tbody.addEventListener('focusout', (e) => { if (e.target.matches('[data-price]')) savePrice(e.target); });

    tbody.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const p = byId(tr.dataset.id);
      if (e.target.closest('[data-edit]')) return openDialog(p);
      const tog = e.target.closest('[data-toggle]');
      if (tog) {
        tog.disabled = true;
        try {
          const { product } = await admin.patch(`products/${encodeURIComponent(p.id)}`, { active: !p.active });
          p.active = product.active;
          toast(`${p.code} ${p.active ? 'restored to the store' : 'archived (hidden from the store)'}`);
          redraw();
        } catch (err) { tog.disabled = false; toast(err.message, 'error'); }
      }
    });

    function openDialog(p = null) {
      const host = root.querySelector('[data-dialog-host]');
      host.innerHTML = dialog(d.categories, p);
      const dlg = host.querySelector('[data-dialog]'), form = host.querySelector('[data-product-form]'), err = host.querySelector('[data-form-error]');
      dlg.showModal();
      host.querySelector('[data-close]').addEventListener('click', () => dlg.close());
      const preview = host.querySelector('[data-preview]'), status = host.querySelector('[data-upload-status]'), clear = host.querySelector('[data-clear-image]');
      const showImage = (url) => { form.image.value = url; preview.src = url; preview.hidden = !url; clear.hidden = !url; };
      host.querySelector('[data-file]').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast('Choose a JPEG, PNG or WebP photo.', 'error'); return; }
        const save = host.querySelector('[data-save]');
        save.disabled = true; status.textContent = 'Compressing…';
        try {
          const blob = await compressImage(file);
          status.textContent = `Uploading ${Math.round(blob.size / 1024)} KB…`;
          const { url } = await admin.post('upload', { filename: file.name, contentType: blob.type, data: await blobToBase64(blob) });
          showImage(url); status.textContent = 'Uploaded ✓';
        } catch (err) { status.textContent = ''; toast(err.message || 'Upload failed', 'error'); }
        finally { save.disabled = false; e.target.value = ''; }
      });
      clear.addEventListener('click', () => { showImage(''); status.textContent = ''; });
      form.image.addEventListener('change', () => showImage(form.image.value.trim()));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form));
        const body = {
          name: v.name, size: v.size, category: v.category, image: v.image,
          price: Number(String(v.price).replace(/[₱,\s]/g, '')),
          featuredRank: v.featuredRank === '' ? null : Number(v.featuredRank) - 1,
        };
        if (!p) body.code = v.code;
        const save = host.querySelector('[data-save]');
        save.disabled = true; err.hidden = true;
        try {
          const { product } = p ? await admin.patch(`products/${encodeURIComponent(p.id)}`, body) : await admin.post('products', body);
          const fresh = { ...(p || { unitsSold: 0, sales: 0 }), ...product, category: product.category_id, featuredRank: product.featured_rank };
          if (p) Object.assign(p, fresh); else d.products.unshift(fresh);
          dlg.close();
          toast(p ? `${fresh.code} saved` : `${fresh.code} added to the store`);
          redraw();
        } catch (ex) {
          save.disabled = false;
          fieldErrors(form, ex);
          err.textContent = ex.message; err.hidden = false;
        }
      });
    }
    root.querySelector('[data-add]').addEventListener('click', () => openDialog());
    return null;
  },
};
