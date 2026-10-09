// Customers: search, orders count, total paid, last order → their orders.
import { admin } from '../api.js';
import { esc, peso, fmtDate, pageHead, empty, debounce } from '../ui.js';

export default {
  title: 'Customers',
  load: (p) => admin.get(`customers${p.get('q') ? `?q=${encodeURIComponent(p.get('q'))}` : ''}`),
  render({ customers }, p) {
    return `
    ${pageHead('Customers', `${customers.length} customer${customers.length === 1 ? '' : 's'} · "Paid" counts paid, non-cancelled orders.`)}
    <div class="card p-4 mb-4">
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute">Search
        <input type="search" class="adm-input" placeholder="Name, mobile or email" value="${esc(p.get('q') || '')}" data-search></label>
    </div>
    ${customers.length ? `
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th class="num">Orders</th><th class="num">Paid</th><th>Last order</th></tr></thead>
        <tbody>
          ${customers.map((c) => `
          <tr class="is-link" data-href="#/orders?customer=${c.id}">
            <td class="font-semibold"><a class="hover:underline" href="#/orders?customer=${c.id}">${esc(c.name)}</a></td>
            <td class="whitespace-nowrap">${esc(c.mobile)}</td>
            <td class="break-all">${esc(c.email)}</td>
            <td class="num">${c.orders}</td>
            <td class="num font-bold">${peso(c.spent)}</td>
            <td class="whitespace-nowrap">${fmtDate(c.lastOrderAt, { dateStyle: 'medium' })}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : empty('No customers found.')}`;
  },
  mount(root, p) {
    const s = root.querySelector('[data-search]');
    s.addEventListener('input', debounce(() => { location.hash = `#/customers${s.value.trim() ? `?q=${encodeURIComponent(s.value.trim())}` : ''}`; }, 450));
    if (p.get('q')) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    root.querySelector('tbody')?.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const tr = e.target.closest('tr[data-href]');
      if (tr) location.hash = tr.dataset.href;
    });
    return null;
  },
};
