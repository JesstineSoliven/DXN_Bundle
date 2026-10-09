// GCash payment page: #/pay/DXN-YYMMDD-NNNN
// Shows the store's GCash QR/number and collects the customer's reference number.
import { icon, formatPeso, esc } from '../components.js';
import { getPaymentMethod } from '../payments/index.js';
import { submitPaymentProof, orderLink } from '../store/orders.js';

const fmtNumber = (n) => n.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3');

const copyBtn = (value, label) => `
  <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 h-8 text-[12.5px] font-semibold text-brand hover:bg-brand-soft active:scale-95 transition-transform" data-copy="${esc(value)}" aria-label="Copy ${label}">
    ${icon('receipt', 'w-4 h-4', 1.6)}<span>Copy</span>
  </button>`;

const field = (id, label, { value = '', placeholder = '', inputmode = '', autocomplete = 'off', hint = '' } = {}) => `
  <div>
    <label for="pay-${id}" class="block text-[13.5px] font-semibold mb-1.5">${label} <span class="text-[#B3261E]" aria-hidden="true">*</span></label>
    <input id="pay-${id}" name="${id}" value="${esc(value)}" placeholder="${placeholder}" ${inputmode ? `inputmode="${inputmode}"` : ''} autocomplete="${autocomplete}" required aria-required="true" class="field-input" aria-describedby="pay-${id}-err${hint ? ` pay-${id}-hint` : ''}">
    ${hint ? `<p id="pay-${id}-hint" class="mt-1.5 text-[12px] text-ink-mute">${hint}</p>` : ''}
    <p id="pay-${id}-err" class="field-error" hidden></p>
  </div>`;

export function renderPayment(params, order) {
  if (!order || order.payment.method !== 'gcash') {
    return `
    <section class="mx-auto max-w-lg px-4 py-16 text-center">
      <div class="card p-8">
        ${icon('receipt', 'w-12 h-12 mx-auto text-ink-mute', 1.4)}
        <h1 class="font-serif text-[22px] mt-4">${order ? 'No GCash payment needed' : 'Order not found'}</h1>
        <p class="text-[14px] text-ink-mute mt-2">${order ? 'This order is paid by Cash on Delivery.' : 'We couldn’t find that order on this device.'}</p>
        <a href="${order ? esc(orderLink(order.id)) : '#/'}" class="btn btn-green h-11 px-6 mt-6 text-[14px]">${order ? 'View order' : 'Back to Home'}</a>
      </div>
    </section>`;
  }

  const acct = getPaymentMethod('gcash').account;
  const amount = order.payment.amountDue;
  const { status } = order.payment;
  const canSubmit = status === 'pending' || status === 'failed';
  const failedNote = status === 'failed' ? order.payment.history.filter((h) => h.status === 'failed').at(-1)?.note : '';

  const banner = {
    pending: ['bg-gold-soft text-[#6B4423]', 'wallet', 'Pending Payment', `Send ${formatPeso(amount)} via GCash, then enter your reference number below to complete your order.`],
    failed: ['bg-[#FCEDEB] text-[#8C1D18]', 'shield', 'Payment Failed', `We couldn’t verify reference ${esc(order.payment.proof?.reference || '')}.${failedNote ? ` ${esc(failedNote)}` : ''} Please check it and submit again.`],
    submitted: ['bg-brand-soft text-brand-band', 'receipt', 'Payment Submitted', `Thanks! We’re verifying reference ${esc(order.payment.proof?.reference || '')}. You’ll get an email at ${esc(order.customer.email)} once it’s confirmed.`],
    confirmed: ['bg-brand-soft text-brand-band', 'check', 'Payment Confirmed', 'We received your GCash payment. Your order is being prepared.'],
  }[status];

  return `
  <section class="mx-auto max-w-[1080px] px-3 sm:px-6 pt-6 pb-14">
    <div class="text-center">
      <p class="text-[12.5px] uppercase tracking-wider text-ink-mute">Order ${esc(order.id)}</p>
      <h1 class="font-serif text-[24px] sm:text-[30px] mt-1">Pay with GCash</h1>
      <p class="text-[14px] text-ink-soft mt-1">Amount due</p>
      <div class="flex items-center justify-center gap-3 mt-1">
        <p class="font-price font-black text-[38px] sm:text-[44px] leading-none text-brand">${formatPeso(amount)}</p>
        ${copyBtn(String(amount), 'amount')}
      </div>
    </div>

    <div class="mt-6 rounded-[14px] ${banner[0]} p-4 sm:p-5 flex items-start gap-3" role="status" data-pay-banner>
      ${icon(banner[1], 'w-6 h-6 shrink-0 mt-0.5', 1.8)}
      <div><p class="font-bold text-[15px]">${banner[2]}</p><p class="text-[13.5px] mt-0.5 opacity-90">${banner[3]}</p></div>
    </div>

    <div class="grid md:grid-cols-[minmax(0,400px)_1fr] gap-5 mt-5 items-start">
      <!-- QR + account -->
      <div class="card p-5 sm:p-6 text-center">
        <img src="${acct.qrImage}" alt="GCash QR code for ${esc(acct.accountName)}" class="mx-auto w-full max-w-[300px] rounded-xl shadow-[var(--shadow-1)]">
        <a href="${acct.qrImage}" download="DXN-Bundle-GCash-QR.webp" class="inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold text-brand underline underline-offset-2 hover:opacity-75 active:opacity-50">Save QR to phone</a>
        <dl class="mt-5 text-left space-y-3 text-[14px] border-t border-line pt-4">
          <div class="flex items-center justify-between gap-3"><dt class="text-ink-mute">Account name</dt><dd class="font-semibold text-right">${esc(acct.accountName)}</dd></div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-mute">GCash number</dt>
            <dd class="flex items-center gap-2"><span class="font-price font-bold tracking-wide">${fmtNumber(acct.number)}</span>${copyBtn(acct.number, 'GCash number')}</dd>
          </div>
        </dl>
      </div>

      <div class="flex flex-col gap-4">
        <div class="card p-5 sm:p-6">
          <h2 class="font-serif text-[18px]">How to pay</h2>
          <ol class="mt-4 space-y-3.5 text-[14px]">
            ${[
              `Open your <strong>GCash</strong> app and tap <strong>Pay QR</strong> (scan the QR) or <strong>Send Money</strong>.`,
              `Send exactly <strong>${formatPeso(amount)}</strong> to <strong>${esc(acct.accountName)}</strong> · ${fmtNumber(acct.number)}.`,
              `On the receipt, copy the <strong>13-digit Reference No.</strong>`,
              `Enter it below and tap <strong>Submit Payment</strong>.`,
            ].map((t, i) => `<li class="flex gap-3"><span class="w-6 h-6 rounded-full bg-brand text-white grid place-items-center text-[12px] font-bold shrink-0">${i + 1}</span><span class="leading-snug pt-0.5">${t}</span></li>`).join('')}
          </ol>
        </div>

        ${canSubmit ? `
        <form class="card p-5 sm:p-6 flex flex-col gap-4" data-proof-form novalidate>
          <h2 class="font-serif text-[18px]">${status === 'failed' ? 'Resubmit payment details' : 'Confirm your payment'}</h2>
          ${field('reference', 'GCash reference no.', { placeholder: '1234 567 890123', inputmode: 'numeric', hint: '13 digits — found on your GCash receipt / transaction history.' })}
          <div class="grid sm:grid-cols-2 gap-4">
            ${field('senderName', 'Sender name', { value: order.payment.proof?.senderName || order.customer.name, autocomplete: 'name' })}
            ${field('senderMobile', 'Sender GCash number', { value: order.payment.proof?.senderMobile || order.customer.mobile.replace('+63 ', '0'), inputmode: 'tel', autocomplete: 'tel' })}
          </div>
          <p class="field-error" data-proof-error role="alert" hidden></p>
          <button type="submit" class="btn btn-green h-[52px] text-[15.5px]" data-submit-proof><span data-label>Submit Payment</span>${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}</button>
          <a href="${esc(orderLink(order.id))}" class="text-center text-[13px] text-ink-mute underline underline-offset-2 hover:text-ink active:opacity-60">I’ll pay later — view my order</a>
        </form>` : `
        <a href="${esc(orderLink(order.id))}" class="btn btn-green h-[52px] text-[15.5px]">View Order Status${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}</a>`}
      </div>
    </div>
  </section>`;
}

export function mountPayment(root, params) {
  const id = params.get('id');
  const onCopy = async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const span = btn.querySelector('span');
      span.textContent = 'Copied';
      setTimeout(() => { span.textContent = 'Copy'; }, 1500);
    } catch { /* clipboard unavailable */ }
  };
  root.addEventListener('click', onCopy);

  const form = root.querySelector('[data-proof-form]');
  if (form) {
    const ref = form.reference;
    // Format reference as the customer types: 1234 567 890123 (GCash receipt style).
    ref.addEventListener('input', () => {
      const d = ref.value.replace(/\D/g, '').slice(0, 13);
      ref.value = [d.slice(0, 4), d.slice(4, 7), d.slice(7)].filter(Boolean).join(' ');
    });
    const btn = form.querySelector('[data-submit-proof]'), formErr = form.querySelector('[data-proof-error]');
    const setErr = (name, msg) => {
      const input = form[name], el = form.querySelector(`#pay-${name}-err`);
      input.classList.toggle('is-invalid', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      el.textContent = msg || ''; el.hidden = !msg;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formErr.hidden = true;
      ['reference', 'senderName', 'senderMobile'].forEach((n) => setErr(n, ''));
      btn.disabled = true;
      btn.querySelector('[data-label]').innerHTML = '<span class="spinner" aria-hidden="true"></span>Submitting…';
      try {
        const res = await submitPaymentProof(id, { reference: form.reference.value, senderName: form.senderName.value, senderMobile: form.senderMobile.value });
        if (!res.ok) {
          Object.entries(res.errors).forEach(([n, m]) => setErr(n, m));
          form[Object.keys(res.errors)[0]]?.focus();
          throw null;
        }
        location.hash = orderLink(id);
      } catch (err) {
        if (err) { formErr.textContent = err.message; formErr.hidden = false; }
        btn.disabled = false;
        btn.querySelector('[data-label]').textContent = 'Submit Payment';
      }
    });
  }
  return () => root.removeEventListener('click', onCopy);
}
