// Categories (add, rename, reorder, delete-if-empty) and referral codes (add, rename, activate, sales).
import { admin } from '../api.js';
import { icon, esc, peso, fmtDate, pageHead, empty, toast, fieldErrors, reload } from '../ui.js';

const saveOnEnter = (tbody, selector, save) => {
  tbody.addEventListener('keydown', (e) => {
    if (!e.target.matches(selector)) return;
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Escape') { e.target.value = e.target.dataset.was; e.target.blur(); }
  });
  tbody.addEventListener('focusout', async (e) => {
    const el = e.target;
    if (!el.matches(selector) || el.value.trim() === el.dataset.was) return;
    try {
      await save(el);
      el.dataset.was = el.value.trim();
      el.classList.remove('is-invalid'); el.classList.add('is-saved'); setTimeout(() => el.classList.remove('is-saved'), 1500);
    } catch (err) { el.classList.add('is-invalid'); toast(err.message, 'error'); }
  });
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const categoriesView = {
  title: 'Categories',
  load: () => admin.get('categories'),
  render({ categories }) {
    return `
    ${pageHead('Categories', 'Order here is the order of the category chips in the store. Categories with a photo also appear in “Shop by Category”.')}
    <form class="card p-4 flex flex-wrap items-end gap-3 mb-4" data-add-form novalidate>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute flex-1 min-w-[220px]">New category name
        <input name="name" class="adm-input" maxlength="60" placeholder="e.g. Wellness Kits" required></label>
      <button type="submit" class="btn btn-green btn-sm h-9">${icon('plus', 'w-4 h-4', 2.4)}Add category</button>
    </form>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Order</th><th>Name</th><th>ID</th><th class="num">Active products</th><th class="num">All products</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody data-rows>
          ${categories.map((c, i) => `
          <tr data-id="${esc(c.id)}">
            <td class="whitespace-nowrap">
              <button type="button" class="icon-btn w-8 h-8" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(c.name)} up">${icon('up', 'w-4 h-4', 2)}</button>
              <button type="button" class="icon-btn w-8 h-8 rotate-180" data-move="1" ${i === categories.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(c.name)} down">${icon('up', 'w-4 h-4', 2)}</button>
            </td>
            <td><label class="sr-only" for="cat-${esc(c.id)}">Name</label><input id="cat-${esc(c.id)}" class="adm-input min-w-[200px]" value="${esc(c.name)}" data-was="${esc(c.name)}" data-name maxlength="60"></td>
            <td class="text-ink-mute">${esc(c.id)}</td>
            <td class="num">${c.activeProducts}</td>
            <td class="num">${c.totalProducts}</td>
            <td class="text-right">
              <button type="button" class="icon-btn w-9 h-9" data-delete ${c.totalProducts ? 'disabled title="Move or archive its products first"' : ''} aria-label="Delete ${esc(c.name)}">${icon('plus', 'w-5 h-5 rotate-45', 2)}</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-[12px] text-ink-mute mt-3">Rename: edit the name and press Enter. A category can only be deleted when it has no products.</p>`;
  },
  mount(root, _p, { categories }) {
    const tbody = root.querySelector('[data-rows]');
    saveOnEnter(tbody, '[data-name]', async (el) => {
      await admin.patch(`categories/${encodeURIComponent(el.closest('tr').dataset.id)}`, { name: el.value });
      toast('Category renamed');
    });
    tbody.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const id = tr.dataset.id;
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const i = categories.findIndex((c) => c.id === id), j = i + Number(mv.dataset.move);
        const [a, b] = [categories[i], categories[j]];
        mv.disabled = true;
        try {
          // Swap their sort values (fall back to positions if they were equal).
          const [sa, sb] = a.sort === b.sort ? [j, i] : [b.sort, a.sort];
          await admin.patch(`categories/${encodeURIComponent(a.id)}`, { sort: sa });
          await admin.patch(`categories/${encodeURIComponent(b.id)}`, { sort: sb });
          reload();
        } catch (err) { mv.disabled = false; toast(err.message, 'error'); }
        return;
      }
      const del = e.target.closest('[data-delete]');
      if (del) {
        if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.classList.add('text-[#B3261E]'); del.title = 'Click again to delete'; toast('Click delete again to confirm', 'error'); return; }
        try { await admin.del(`categories/${encodeURIComponent(id)}`); toast('Category deleted'); reload(); }
        catch (err) { toast(err.message, 'error'); }
      }
    });
    const form = root.querySelector('[data-add-form]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await admin.post('categories', { name: form.name.value }); toast('Category added'); reload(); }
      catch (err) { fieldErrors(form, err); toast(err.message, 'error'); }
    });
    return null;
  },
};

// ---------------------------------------------------------------------------
// Referral codes
// ---------------------------------------------------------------------------
export const referralsView = {
  title: 'Referral Codes',
  load: () => admin.get('referrals'),
  render({ referrals }) {
    return `
    ${pageHead('Referral Codes', 'Customers must enter an active code at checkout. Sales count paid, non-cancelled orders.')}
    <form class="card p-4 flex flex-wrap items-end gap-3 mb-4" data-add-form novalidate>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute">Code
        <input name="code" class="adm-input uppercase w-[170px]" maxlength="20" placeholder="DXN-ANA01" required></label>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute flex-1 min-w-[220px]">Referrer name (shown to the customer)
        <input name="referrerName" class="adm-input" maxlength="120" placeholder="Ana Reyes" required></label>
      <button type="submit" class="btn btn-green btn-sm h-9">${icon('plus', 'w-4 h-4', 2.4)}Add code</button>
    </form>
    ${referrals.length ? `
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Code</th><th>Referrer</th><th class="num">Orders</th><th class="num">Paid</th><th class="num">Sales</th><th>Created</th><th>Status</th></tr></thead>
        <tbody data-rows>
          ${referrals.map((r) => `
          <tr data-code="${esc(r.code)}" class="${r.active ? '' : 'is-muted'}">
            <td class="font-bold whitespace-nowrap"><a class="text-brand hover:underline" href="#/orders?q=${encodeURIComponent(r.code)}">${esc(r.code)}</a></td>
            <td><label class="sr-only" for="ref-${esc(r.code)}">Referrer name</label><input id="ref-${esc(r.code)}" class="adm-input min-w-[180px]" value="${esc(r.referrerName)}" data-was="${esc(r.referrerName)}" data-name maxlength="120"></td>
            <td class="num">${r.orders}</td>
            <td class="num">${r.paidOrders}</td>
            <td class="num font-bold">${peso(r.sales)}</td>
            <td class="whitespace-nowrap">${fmtDate(r.createdAt, { dateStyle: 'medium' })}</td>
            <td><label class="inline-flex items-center gap-2 text-[13px] font-semibold cursor-pointer"><input type="checkbox" class="w-4 h-4 accent-[#1A552E]" data-active ${r.active ? 'checked' : ''}>${r.active ? 'Active' : 'Off'}</label></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : empty('No referral codes yet.')}
    <p class="text-[12px] text-ink-mute mt-3">Turning a code off stops new orders from using it; past orders keep it.</p>`;
  },
  mount(root) {
    const tbody = root.querySelector('[data-rows]');
    if (tbody) {
      saveOnEnter(tbody, '[data-name]', async (el) => {
        await admin.patch(`referrals/${encodeURIComponent(el.closest('tr').dataset.code)}`, { referrerName: el.value });
        toast('Referrer name saved');
      });
      tbody.addEventListener('change', async (e) => {
        if (!e.target.matches('[data-active]')) return;
        const code = e.target.closest('tr').dataset.code;
        try { await admin.patch(`referrals/${encodeURIComponent(code)}`, { active: e.target.checked }); toast(`${code} ${e.target.checked ? 'activated' : 'turned off'}`); reload(); }
        catch (err) { e.target.checked = !e.target.checked; toast(err.message, 'error'); }
      });
    }
    const form = root.querySelector('[data-add-form]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { const { referral } = await admin.post('referrals', { code: form.code.value, referrerName: form.referrerName.value }); toast(`${referral.code} added`); reload(); }
      catch (err) { fieldErrors(form, err); toast(err.message, 'error'); }
    });
    return null;
  },
};
