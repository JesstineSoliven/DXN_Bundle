// GCash payment hand-off: #/pay/DXN-YYMMDD-NNNN?t=TOKEN[&cancelled=1]
// Sends the customer to PayMongo → GCash with the exact amount. Payment is confirmed automatically
// (PayMongo webhook + re-check when the customer returns), so there is no QR or reference number.
import { icon, formatPeso, esc } from '../components.js';
import { startGcashPayment, orderLink } from '../store/orders.js';

const card = (inner) => `
  <section class="mx-auto max-w-lg px-4 py-14 text-center">
    <div class="card p-8 sm:p-10">${inner}</div>
  </section>`;

export function renderPayment(params, order) {
  if (!order || order.payment.method !== 'gcash') {
    return card(`
      ${icon('receipt', 'w-12 h-12 mx-auto text-ink-mute', 1.4)}
      <h1 class="font-serif text-[22px] mt-4">${order ? 'No GCash payment needed' : 'Order not found'}</h1>
      <p class="text-[14px] text-ink-mute mt-2">${order ? 'This order is paid by Cash on Delivery.' : 'We couldn’t find that order on this device.'}</p>
      <a href="${order ? esc(orderLink(order.id)) : '#/'}" class="btn btn-green h-11 px-6 mt-6 text-[14px]">${order ? 'View order' : 'Back to Home'}</a>`);
  }

  const amount = formatPeso(order.totals.grandTotal);
  if (order.payment.status === 'confirmed') {
    return card(`
      <span class="mx-auto w-14 h-14 rounded-full bg-brand text-white grid place-items-center">${icon('check', 'w-7 h-7', 3)}</span>
      <h1 class="font-serif text-[22px] mt-4">Already paid</h1>
      <p class="text-[14px] text-ink-mute mt-2">We received ${amount} for order ${esc(order.id)}.</p>
      <a href="${esc(orderLink(order.id))}" class="btn btn-green h-11 px-6 mt-6 text-[14px]">View Order</a>`);
  }

  const cancelled = params.get('cancelled') === '1';
  const failed = order.payment.status === 'failed';
  return card(`
    <p class="text-[12.5px] uppercase tracking-wider text-ink-mute">Order ${esc(order.id)}</p>
    <h1 class="font-serif text-[24px] mt-1">Pay with GCash</h1>
    <p class="font-price font-black text-[40px] leading-none text-brand mt-3">${amount}</p>
    ${order.totals.paymentFee ? `<p class="text-[12.5px] text-ink-mute mt-1">includes ${formatPeso(order.totals.paymentFee)} GCash convenience fee</p>` : ''}

    <div data-pay-state class="mt-6">
      ${cancelled || failed ? `
        <div class="rounded-xl ${failed ? 'bg-[#FCEDEB] text-[#8C1D18]' : 'bg-gold-soft text-[#6B4423]'} p-4 text-left text-[13.5px]" role="status">
          <p class="font-bold">${failed ? 'Payment not completed' : 'Payment cancelled'}</p>
          <p class="mt-0.5 opacity-90">${failed && order.payment.note ? `${esc(order.payment.note)} ` : ''}Your order is saved. You can try again whenever you’re ready.</p>
        </div>` : `
        <p class="text-[14px] text-ink-soft flex items-center justify-center gap-2" data-redirecting><span class="spinner" aria-hidden="true"></span>Taking you to GCash…</p>`}
    </div>
    <p class="field-error mt-3" data-pay-error role="alert" hidden></p>

    <button type="button" class="btn btn-green w-full h-[52px] mt-5 text-[15.5px]" data-start-pay>
      <span data-label>${cancelled || failed ? 'Try Again with GCash' : 'Continue to GCash'}</span>${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}
    </button>
    <p class="text-[12px] text-ink-mute mt-3 flex items-center justify-center gap-1.5">${icon('shield', 'w-4 h-4', 1.8)}Secure payment by PayMongo · the amount is filled in for you</p>
    <a href="${esc(orderLink(order.id))}" class="inline-block mt-5 text-[13px] text-ink-mute underline underline-offset-2 hover:text-ink active:opacity-60">I’ll pay later — view my order</a>`);
}

export function mountPayment(root, params, order) {
  const btn = root.querySelector('[data-start-pay]');
  if (!btn || !order) return null;
  const errEl = root.querySelector('[data-pay-error]');
  let leaving = false;

  async function go() {
    if (leaving) return;
    leaving = true;
    btn.disabled = true;
    btn.querySelector('[data-label]').innerHTML = '<span class="spinner" aria-hidden="true"></span>Opening GCash…';
    errEl.hidden = true;
    try {
      window.location.href = await startGcashPayment(order.id);
    } catch (err) {
      leaving = false;
      if (err.status === 409 && /already paid/i.test(err.message)) { location.hash = orderLink(order.id); return; }
      root.querySelector('[data-redirecting]')?.remove();
      errEl.textContent = err.message;
      errEl.hidden = false;
      btn.disabled = false;
      btn.querySelector('[data-label]').textContent = 'Try Again with GCash';
    }
  }
  btn.addEventListener('click', go);
  // Fresh from checkout → go straight to GCash. After a cancel/failure, wait for the customer.
  if (params.get('cancelled') !== '1' && order.payment.status === 'pending') go();
  return () => btn.removeEventListener('click', go);
}
