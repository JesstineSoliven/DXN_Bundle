// Orders list (filters + search) and order detail (fulfilment status, payment actions, history).
import { admin } from '../api.js';
import { icon, esc, peso, fmtDate, orderChip, payChip, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHODS, pageHead, empty, toast, debounce, reload } from '../ui.js';
import { ORDER_TRANSITIONS } from '../../shared/constants.js';

const PAGE = 50;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
const select = (name, label, options, value) => `
  <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute">${label}
    <select name="${name}" class="adm-input min-w-[150px]">
      <option value="">All</option>
      ${Object.entries(options).map(([k, v]) => `<option value="${k}" ${k === value ? 'selected' : ''}>${esc(v)}</option>`).join('')}
    </select>
  </label>`;

export const ordersView = {
  title: 'Orders',
  load: (p) => {
    const q = new URLSearchParams();
    for (const k of ['status', 'payment', 'method', 'q', 'customer']) if (p.get(k)) q.set(k, p.get(k));
    q.set('limit', PAGE); q.set('offset', Math.max(0, (Number(p.get('page') || 1) - 1) * PAGE));
    return admin.get(`orders?${q}`);
  },
  render(data, p) {
    const page = Number(p.get('page') || 1), pages = Math.max(1, Math.ceil(data.total / PAGE));
    const qs = (over) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(over)) v ? n.set(k, v) : n.delete(k); n.delete('id'); return `#/orders?${n}`; };
    return `
    ${pageHead('Orders', `${data.total.toLocaleString('en-PH')} order${data.total === 1 ? '' : 's'}${p.get('customer') ? ' for this customer · <a class="underline" href="#/orders">show all</a>' : ''}`)}
    <form class="card p-4 flex flex-wrap items-end gap-3 mb-4" data-filters>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute flex-1 min-w-[220px]">Search
        <input name="q" type="search" value="${esc(p.get('q') || '')}" placeholder="Order no., name, mobile, email, referral" class="adm-input">
      </label>
      ${select('status', 'Order status', ORDER_STATUS, p.get('status'))}
      ${select('payment', 'Payment', PAYMENT_STATUS, p.get('payment'))}
      ${select('method', 'Method', PAYMENT_METHODS, p.get('method'))}
      ${p.get('customer') ? `<input type="hidden" name="customer" value="${esc(p.get('customer'))}">` : ''}
    </form>
    ${data.orders.length ? `
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Referral</th><th class="num">Items</th><th class="num">Total</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>
          ${data.orders.map((o) => `
          <tr class="is-link" data-href="#/orders/${esc(o.id)}">
            <td><a href="#/orders/${esc(o.id)}" class="font-bold text-brand hover:underline whitespace-nowrap">${esc(o.id)}</a>${o.type === 'mystery' ? '<span class="block text-[11.5px] text-gold-deep font-semibold">Mystery Box</span>' : ''}</td>
            <td class="whitespace-nowrap">${fmtDate(o.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</td>
            <td><span class="font-semibold">${esc(o.customerName)}</span><span class="block text-[12px] text-ink-mute whitespace-nowrap">${esc(o.customerMobile)}</span></td>
            <td class="whitespace-nowrap">${esc(o.referralCode)}</td>
            <td class="num">${o.items}</td>
            <td class="num font-bold">${peso(o.grandTotal)}</td>
            <td><span class="block text-[12px] text-ink-mute mb-1">${esc(PAYMENT_METHODS[o.paymentMethod])}</span>${payChip(o.paymentStatus)}</td>
            <td>${orderChip(o.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${pages > 1 ? `
    <nav class="flex items-center justify-between mt-4 text-[13.5px]" aria-label="Pages">
      ${page > 1 ? `<a class="btn btn-ghost btn-sm" href="${qs({ page: page - 1 })}">Previous</a>` : '<span></span>'}
      <span class="text-ink-mute">Page ${page} of ${pages}</span>
      ${page < pages ? `<a class="btn btn-ghost btn-sm" href="${qs({ page: page + 1 })}">Next</a>` : '<span></span>'}
    </nav>` : ''}` : empty('No orders match these filters.')}`;
  },
  mount(root, p) {
    const form = root.querySelector('[data-filters]');
    const apply = () => {
      const n = new URLSearchParams();
      for (const el of form.elements) if (el.name && el.value) n.set(el.name, el.value.trim());
      location.hash = `#/orders${n.toString() ? `?${n}` : ''}`;
    };
    form.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') apply(); });
    form.q.addEventListener('input', debounce(apply, 450));
    form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
    if (p.get('q')) { form.q.focus(); form.q.setSelectionRange(form.q.value.length, form.q.value.length); }
    root.querySelector('tbody')?.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const tr = e.target.closest('tr[data-href]');
      if (tr) location.hash = tr.dataset.href;
    });
    return null;
  },
};

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------
const NEXT_LABEL = { processing: 'Mark Processing', shipped: 'Mark Shipped', delivered: 'Mark Delivered', cancelled: 'Cancel Order' };

const history = (title, rows) => `
  <section class="card p-5">
    <h2 class="font-bold text-[15px]">${title}</h2>
    <ol class="mt-3 space-y-3">
      ${rows.map((h, i) => `
        <li class="flex gap-3">
          <span class="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${i === rows.length - 1 ? 'bg-brand ring-4 ring-brand/15' : 'bg-[#C9CCC9]'}"></span>
          <div class="text-[13px]"><p class="font-semibold">${esc(h.label)}</p><p class="text-ink-mute">${fmtDate(h.at)}${h.note ? ` · ${esc(h.note)}` : ''}</p></div>
        </li>`).join('')}
    </ol>
  </section>`;

function paymentActions(o) {
  const s = o.payment.status;
  if (o.payment.method === 'cod') {
    return s === 'cod_pending'
      ? `<button type="button" class="btn btn-green btn-sm" data-pay="confirmed">${icon('check', 'w-4 h-4', 2.4)}Mark cash collected</button>`
      : `<button type="button" class="btn btn-ghost btn-sm" data-pay="cod_pending">Undo cash collected</button>`;
  }
  return [
    s !== 'confirmed' ? `<button type="button" class="btn btn-ghost btn-sm" data-pay="confirmed">Mark paid (manual)</button>` : '',
    s !== 'failed' ? `<button type="button" class="btn btn-ghost btn-sm text-[#8C1D18] border-[#8C1D18]/30" data-pay="failed">Mark payment failed / refunded</button>` : '',
  ].join('');
}

export const orderView = {
  title: (p) => `Order ${p.get('id')}`,
  load: (p) => admin.get(`orders/${encodeURIComponent(p.get('id'))}`).then((r) => r.order),
  render(o) {
    const c = o.customer, t = o.totals;
    const next = ORDER_TRANSITIONS[o.status] || [];
    return `
    <a href="#/orders" class="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink mb-3">${icon('chevronLeft', 'w-4 h-4', 2)}All orders</a>
    ${pageHead(`Order ${esc(o.id)}`, `${fmtDate(o.createdAt)} · ${o.type === 'mystery' ? 'Mystery Box' : 'Custom bundle'}`,
      `${orderChip(o.status)} ${payChip(o.payment.status)}`)}

    <div class="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div class="flex flex-col gap-4">
        <section class="card p-5">
          <h2 class="font-bold text-[15px]">Fulfilment</h2>
          ${next.length ? `
            <label class="block text-[12.5px] font-semibold text-ink-mute mt-3" for="status-note">Note (optional — included in the customer email for Shipped/Cancelled)</label>
            <input id="status-note" class="adm-input mt-1" maxlength="300" placeholder="e.g. Courier: LBC, tracking 123456789" data-status-note>
            <div class="flex flex-wrap gap-2 mt-3">
              ${next.map((s) => `<button type="button" class="btn btn-sm ${s === 'cancelled' ? 'btn-ghost text-[#8C1D18] border-[#8C1D18]/30' : 'btn-green'}" data-status="${s}">${NEXT_LABEL[s]}</button>`).join('')}
            </div>
            <div class="mt-3 rounded-xl bg-[#FCEDEB] p-3 text-[13px]" data-cancel-confirm hidden>
              <p class="font-semibold text-[#8C1D18]">Cancel this order? The customer will be emailed.</p>
              <div class="flex gap-2 mt-2"><button type="button" class="btn btn-danger btn-sm" data-cancel-yes>Yes, cancel order</button><button type="button" class="btn btn-ghost btn-sm" data-cancel-no>Keep order</button></div>
            </div>`
          : `<p class="text-[13.5px] text-ink-mute mt-2">This order is ${esc(o.statusLabel.toLowerCase())}. No further steps.</p>`}
        </section>

        <section class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-bold text-[15px]">Payment · ${esc(o.payment.label)}</h2>${payChip(o.payment.status)}
          </div>
          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
            <dt class="text-ink-mute">Amount</dt><dd class="font-bold">${peso(o.payment.amountDue)}</dd>
            ${o.payment.paidAt ? `<dt class="text-ink-mute">Paid</dt><dd>${fmtDate(o.payment.paidAt)}</dd>` : ''}
            ${o.payment.paymentId ? `<dt class="text-ink-mute">PayMongo</dt><dd class="break-all">${esc(o.payment.paymentId)}</dd>` : ''}
            ${o.payment.proof ? `<dt class="text-ink-mute">GCash ref.</dt><dd>${esc(o.payment.proof.reference)} (${esc(o.payment.proof.senderName)})</dd>` : ''}
          </dl>
          <p class="text-[12.5px] text-ink-mute mt-3">${o.payment.method === 'gcash' ? 'GCash payments are confirmed automatically by PayMongo. Use these only for exceptions.' : 'Mark cash collected when the rider remits the payment.'}</p>
          <div class="flex flex-wrap gap-2 mt-3">${paymentActions(o)}</div>
        </section>

        <section class="card p-5">
          <h2 class="font-bold text-[15px]">Items</h2>
          <div class="adm-table-wrap shadow-none mt-3 border border-line">
            <table class="adm-table">
              <thead><tr><th>Product</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th></tr></thead>
              <tbody>${o.items.map((i) => `<tr><td><span class="font-semibold">${esc(i.name)}</span><span class="block text-[12px] text-ink-mute">${esc(i.code)}${i.size ? ` · ${esc(i.size)}` : ''}</span></td><td class="num">${peso(i.price)}</td><td class="num">${i.qty}</td><td class="num font-bold">${peso(i.lineTotal)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
          <dl class="mt-4 ml-auto max-w-[280px] space-y-1.5 text-[13.5px]">
            <div class="flex justify-between"><dt class="text-ink-mute">Subtotal</dt><dd>${peso(t.subtotal)}</dd></div>
            <div class="flex justify-between"><dt class="text-ink-mute">Delivery</dt><dd>${t.deliveryFee ? peso(t.deliveryFee) : 'FREE'}</dd></div>
            ${t.paymentFee ? `<div class="flex justify-between"><dt class="text-ink-mute">GCash fee</dt><dd>${peso(t.paymentFee)}</dd></div>` : ''}
            <div class="flex justify-between border-t border-line pt-2 font-bold text-[15px]"><dt>Total</dt><dd>${peso(t.grandTotal)}</dd></div>
          </dl>
        </section>
      </div>

      <div class="flex flex-col gap-4">
        <section class="card p-5 text-[13.5px]">
          <h2 class="font-bold text-[15px]">Customer</h2>
          <p class="font-semibold mt-2">${esc(c.name)}</p>
          <p><a class="text-brand hover:underline" href="tel:${esc(c.mobile.replace(/\s/g, ''))}">${esc(c.mobile)}</a></p>
          <p><a class="text-brand hover:underline break-all" href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
          <h3 class="font-bold mt-4">Deliver to</h3>
          <p class="text-ink-soft mt-1">${esc(c.addressText)}</p>
          ${c.notes ? `<p class="mt-2 rounded-lg bg-sand p-2.5"><span class="font-semibold">Note:</span> ${esc(c.notes)}</p>` : ''}
          <h3 class="font-bold mt-4">Referral</h3>
          <p class="text-ink-soft mt-1">${esc(o.referral.code)} · ${esc(o.referral.referrer)}</p>
        </section>
        ${history('Order status', o.statusHistory)}
        ${history('Payment history', o.payment.history)}
      </div>
    </div>`;
  },
  mount(root, p, o) {
    const id = p.get('id');
    const busy = (btn, on) => { btn.disabled = on; if (on) btn.dataset.text = btn.innerHTML, btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Saving…'; else if (btn.dataset.text) btn.innerHTML = btn.dataset.text; };
    async function setStatus(status, btn) {
      busy(btn, true);
      try {
        await admin.post(`orders/${encodeURIComponent(id)}/status`, { status, note: root.querySelector('[data-status-note]')?.value || '' });
        toast(`Order marked ${ORDER_STATUS[status]}${['shipped', 'cancelled'].includes(status) ? ' · customer emailed' : ''}`);
        reload();
      } catch (err) { busy(btn, false); toast(err.message, 'error'); }
    }
    const onClick = async (e) => {
      const s = e.target.closest('[data-status]');
      if (s) {
        if (s.dataset.status === 'cancelled') { root.querySelector('[data-cancel-confirm]').hidden = false; root.querySelector('[data-cancel-yes]').focus(); return; }
        return setStatus(s.dataset.status, s);
      }
      if (e.target.closest('[data-cancel-no]')) { root.querySelector('[data-cancel-confirm]').hidden = true; return; }
      const yes = e.target.closest('[data-cancel-yes]');
      if (yes) return setStatus('cancelled', yes);
      const pay = e.target.closest('[data-pay]');
      if (pay) {
        const status = pay.dataset.pay;
        const note = o.payment.method === 'cod'
          ? (status === 'confirmed' ? 'Cash collected on delivery.' : 'Cash collection undone.')
          : (status === 'failed' ? 'Marked failed/refunded by admin.' : 'Marked paid manually by admin.');
        busy(pay, true);
        try {
          await admin.post(`orders/${encodeURIComponent(id)}/payment-status`, { status, note });
          toast(PAYMENT_STATUS[status]);
          reload();
        } catch (err) { busy(pay, false); toast(err.message, 'error'); }
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  },
};
