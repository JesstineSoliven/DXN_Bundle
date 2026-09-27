// Order confirmation: #/order/DXN-YYMMDD-NNNN
import { icon, formatPeso, esc } from '../components.js';
import { getOrder, setPaymentStatus } from '../store/orders.js';

const TONE = {
  cod_pending: 'bg-gold-soft text-gold-deep',
  pending: 'bg-gold-soft text-gold-deep',
  submitted: 'bg-[#E8F0FB] text-[#1D4E89]',
  confirmed: 'bg-brand-soft text-brand',
  failed: 'bg-[#FCEDEB] text-[#8C1D18]',
};

const timeline = (history) => `
  <div class="card p-5">
    <h2 class="font-serif text-[16px]">Payment status</h2>
    <ol class="mt-3 space-y-3">
      ${history.map((h, i) => `
        <li class="flex gap-3">
          <span class="mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${i === history.length - 1 ? 'bg-brand ring-4 ring-brand/15' : 'bg-[#C9CCC9]'}"></span>
          <div class="text-[13px]">
            <p class="font-semibold">${esc(h.label)}</p>
            <p class="text-ink-mute">${new Date(h.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}${h.note ? ` · ${esc(h.note)}` : ''}</p>
          </div>
        </li>`).join('')}
    </ol>
  </div>`;

// Stand-in for the Phase 6 admin dashboard: #/order/ID?demo=1 lets you confirm/fail a submitted GCash payment.
const demoPanel = (order) => `
  <div class="mt-4 rounded-[14px] border-2 border-dashed border-[#C9CCC9] p-4 sm:p-5">
    <p class="text-[12px] font-bold uppercase tracking-wider text-ink-mute">Demo · admin verification (Phase 6 moves this to the dashboard)</p>
    ${order.payment.status === 'submitted' ? `
      <p class="text-[13.5px] mt-2">Check reference <strong>${esc(order.payment.proof.reference)}</strong> in the GCash app, then:</p>
      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" class="btn btn-green h-10 px-4 text-[13.5px]" data-demo-status="confirmed">Mark Payment Confirmed</button>
        <button type="button" class="btn h-10 px-4 text-[13.5px] bg-[#B3261E] text-white hover:opacity-90" data-demo-status="failed">Mark Payment Failed</button>
      </div>` : `<p class="text-[13.5px] mt-2 text-ink-mute">Nothing to verify — payment status is “${esc(order.payment.statusLabel)}”.</p>`}
  </div>`;

const statusChip = (label, tone) => `<span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ${tone}">${label}</span>`;

export function renderConfirmation(params) {
  const order = getOrder(params.get('id'));
  if (!order) {
    return `
    <section class="mx-auto max-w-lg px-4 py-16 text-center">
      <div class="card p-8">
        ${icon('receipt', 'w-12 h-12 mx-auto text-ink-mute', 1.4)}
        <h1 class="font-serif text-[22px] mt-4">Order not found</h1>
        <p class="text-[14px] text-ink-mute mt-2">We couldn’t find order <strong>${esc(params.get('id') || '')}</strong> on this device.</p>
        <a href="#/" class="btn btn-green h-11 px-6 mt-6 text-[14px]">Back to Home</a>
      </div>
    </section>`;
  }
  const c = order.customer, t = order.totals, isCod = order.payment.method === 'cod';
  const ps = order.payment.status, needsPay = ps === 'pending' || ps === 'failed';
  const first = c.name.split(/\s+/)[0];
  const placed = new Date(order.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

  return `
  <section class="mx-auto max-w-[980px] px-3 sm:px-6 pt-8 pb-14">
    <div class="text-center">
      <span class="mx-auto w-16 h-16 rounded-full bg-brand text-white grid place-items-center shadow-[var(--shadow-2)] confirm-pop">${icon('check', 'w-8 h-8', 3)}</span>
      <h1 class="font-serif text-[24px] sm:text-[30px] mt-5">Thank you, ${esc(first)}!</h1>
      <p class="text-[15px] text-ink-soft mt-2">Your order has been placed. We’ll contact you at <strong class="text-ink">${esc(c.mobile)}</strong> to confirm delivery.</p>
    </div>

    <div class="card mt-7 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div class="flex-1">
        <p class="text-[12.5px] uppercase tracking-wider text-ink-mute">Order number</p>
        <div class="flex items-center gap-2 mt-0.5">
          <p class="font-price font-extrabold text-[22px] sm:text-[26px] tracking-wide" data-order-id>${esc(order.id)}</p>
          <button type="button" class="icon-btn w-9 h-9 text-ink-soft" data-copy aria-label="Copy order number">${icon('receipt', 'w-5 h-5', 1.6)}</button>
        </div>
        <p class="text-[12.5px] text-ink-mute">Placed ${placed}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        ${statusChip(`${icon('check', 'w-3.5 h-3.5', 3)}Order placed`, 'bg-brand-soft text-brand')}
        <span data-pay-status>${statusChip(`${icon(isCod ? 'truck' : 'wallet', 'w-3.5 h-3.5', 2)}${esc(order.payment.statusLabel)}`, TONE[ps])}</span>
      </div>
    </div>

    ${isCod ? `
    <div class="mt-4 rounded-[16px] bg-gold-soft p-5 sm:p-6 flex items-start gap-4">
      ${icon('truck', 'w-9 h-9 text-gold-deep shrink-0', 1.4)}
      <div>
        <p class="font-bold text-[15px] text-[#6B4423]">Cash on Delivery — please prepare ${formatPeso(t.grandTotal)}</p>
        <p class="text-[13.5px] text-ink-soft mt-1">Pay the rider in cash when your order arrives. Keep your order number handy.</p>
      </div>
    </div>` : needsPay ? `
    <div class="mt-4 rounded-[16px] ${ps === 'failed' ? 'bg-[#FCEDEB]' : 'bg-gold-soft'} p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      ${icon(ps === 'failed' ? 'shield' : 'wallet', `w-9 h-9 shrink-0 ${ps === 'failed' ? 'text-[#8C1D18]' : 'text-gold-deep'}`, 1.4)}
      <div class="flex-1">
        <p class="font-bold text-[15px] ${ps === 'failed' ? 'text-[#8C1D18]' : 'text-[#6B4423]'}">${ps === 'failed' ? 'We couldn’t verify your GCash payment' : `Complete your GCash payment of ${formatPeso(t.grandTotal)}`}</p>
        <p class="text-[13.5px] text-ink-soft mt-1">${ps === 'failed' ? 'Please check your reference number and submit it again.' : 'Scan our QR or send to our GCash number, then enter your reference no.'}</p>
      </div>
      <a href="#/pay/${esc(order.id)}" class="btn btn-green h-12 px-6 text-[14.5px] shrink-0">${ps === 'failed' ? 'Resubmit Payment' : 'Pay with GCash'}${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}</a>
    </div>` : ps === 'submitted' ? `
    <div class="mt-4 rounded-[16px] bg-[#E8F0FB] p-5 sm:p-6 flex items-start gap-4">
      ${icon('receipt', 'w-9 h-9 text-[#1D4E89] shrink-0', 1.4)}
      <div>
        <p class="font-bold text-[15px] text-[#1D4E89]">Payment submitted — we’re verifying it</p>
        <p class="text-[13.5px] text-ink-soft mt-1">GCash reference <strong>${esc(order.payment.proof.reference)}</strong>. We’ll email <strong>${esc(c.email)}</strong> once it’s confirmed.</p>
      </div>
    </div>` : `
    <div class="mt-4 rounded-[16px] bg-brand-soft p-5 sm:p-6 flex items-start gap-4">
      ${icon('check', 'w-9 h-9 text-brand shrink-0', 2)}
      <div>
        <p class="font-bold text-[15px] text-brand-band">Payment confirmed — thank you!</p>
        <p class="text-[13.5px] text-ink-soft mt-1">We received ${formatPeso(t.grandTotal)} via GCash (ref. ${esc(order.payment.proof.reference)}). Your order is being prepared.</p>
      </div>
    </div>`}

    <div class="grid md:grid-cols-[1fr_320px] gap-4 mt-4 items-start">
      <div class="card p-5 sm:p-6">
        <h2 class="font-serif text-[18px]">Items</h2>
        <ul class="mt-4 divide-y divide-line">
          ${order.items.map((i) => `
            <li class="py-3 flex items-start justify-between gap-4 text-[14px]">
              <div class="min-w-0">
                <p class="font-semibold leading-snug">${esc(i.name)}</p>
                <p class="text-[12.5px] text-ink-mute">${i.qty} × ${formatPeso(i.price)}${i.size ? ` · ${esc(i.size)}` : ''}${i.code && i.code !== 'MYSTERY' ? ` · ${esc(i.code)}` : ''}</p>
              </div>
              <span class="font-price font-bold whitespace-nowrap">${formatPeso(i.lineTotal)}</span>
            </li>`).join('')}
        </ul>
        <dl class="mt-2 pt-4 border-t border-line space-y-2 text-[14px]">
          <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd>${formatPeso(t.subtotal)}</dd></div>
          <div class="flex justify-between"><dt class="text-ink-soft">Delivery fee</dt><dd>${t.deliveryFee ? formatPeso(t.deliveryFee) : '<span class="font-bold text-brand">FREE</span>'}</dd></div>
          <div class="flex justify-between items-end pt-2"><dt class="font-semibold">Grand Total</dt><dd class="font-price font-black text-[24px] text-brand leading-none">${formatPeso(t.grandTotal)}</dd></div>
        </dl>
      </div>

      <div class="flex flex-col gap-4">
        <div class="card p-5">
          <h2 class="font-serif text-[16px]">Delivery to</h2>
          <p class="text-[14px] font-semibold mt-2">${esc(c.name)}</p>
          <p class="text-[13.5px] text-ink-soft leading-snug">${esc(c.addressText)}</p>
          ${c.notes ? `<p class="text-[12.5px] text-ink-mute mt-1">Note: ${esc(c.notes)}</p>` : ''}
          <p class="text-[13px] text-ink-soft mt-2">${esc(c.mobile)}<br>${esc(c.email)}</p>
        </div>
        <div class="card p-5">
          <h2 class="font-serif text-[16px]">Payment & referral</h2>
          <p class="text-[13.5px] mt-2"><span class="text-ink-mute">Payment:</span> ${esc(order.payment.label)}</p>
          <p class="text-[13.5px]"><span class="text-ink-mute">Referral:</span> ${esc(order.referral.code)} <span class="text-ink-mute">(${esc(order.referral.referrer)})</span></p>
          ${order.payment.proof ? `<p class="text-[13.5px]"><span class="text-ink-mute">GCash ref.:</span> ${esc(order.payment.proof.reference)}</p>` : ''}
        </div>
        ${isCod ? '' : timeline(order.payment.history)}
      </div>
    </div>

    <div class="card mt-4 p-5 sm:p-6">
      <h2 class="font-serif text-[18px]">What happens next</h2>
      <ol class="mt-4 grid sm:grid-cols-3 gap-4">
        ${[['receipt', 'We confirm your order', 'Our team reviews your order and contacts you by SMS or call.'],
           ['truck', 'We deliver', 'Your DXN products are packed and sent to your address.'],
           [isCod ? 'wallet' : 'check', isCod ? 'Pay on delivery' : 'Enjoy!', isCod ? `Hand ${formatPeso(t.grandTotal)} in cash to the rider.` : 'Enjoy your DXN products.']]
          .map((s, i) => (!isCod && i === 0 ? ['wallet', 'We verify your payment', 'We check your GCash reference and confirm your order.'] : s))
          .map(([ic, h, p], i) => `
          <li class="flex gap-3">
            <span class="w-9 h-9 rounded-full bg-brand-soft text-brand grid place-items-center shrink-0">${icon(ic, 'w-5 h-5', 1.6)}</span>
            <div><p class="font-semibold text-[14px]">${i + 1}. ${h}</p><p class="text-[13px] text-ink-mute leading-snug">${p}</p></div>
          </li>`).join('')}
      </ol>
    </div>

    ${params.get('demo') === '1' && !isCod ? demoPanel(order) : ''}

    <div class="flex flex-col sm:flex-row gap-3 justify-center mt-8">
      <a href="#/products" class="btn btn-green h-12 px-7 text-[15px]">Continue Shopping${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}</a>
      <a href="#/" class="btn h-12 px-7 text-[15px] text-brand border border-brand/30 bg-white hover:bg-brand-soft">Back to Home</a>
    </div>
  </section>`;
}

export function mountConfirmation(root, params) {
  const onDemo = (e) => {
    const b = e.target.closest('[data-demo-status]');
    if (!b) return;
    const status = b.dataset.demoStatus;
    setPaymentStatus(params.get('id'), status, status === 'failed' ? 'Reference number not found in GCash.' : 'Verified in GCash app.');
    window.dispatchEvent(new HashChangeEvent('hashchange')); // re-render with the new status
  };
  root.addEventListener('click', onDemo);
  const btn = root.querySelector('[data-copy]');
  if (!btn) return () => root.removeEventListener('click', onDemo);
  const onClick = async () => {
    const id = root.querySelector('[data-order-id]').textContent.trim();
    try { await navigator.clipboard.writeText(id); btn.setAttribute('aria-label', 'Copied'); btn.classList.add('text-brand'); } catch { /* clipboard unavailable */ }
  };
  btn.addEventListener('click', onClick);
  return () => { btn.removeEventListener('click', onClick); root.removeEventListener('click', onDemo); };
}
