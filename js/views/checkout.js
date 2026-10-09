// Checkout (step 3): customer details, delivery address, required referral code, payment method,
// order summary. Works for the custom bundle (#/checkout) and Mystery Box (#/checkout?type=mystery).
import { icon, formatPeso, esc, steps, productImage } from '../components.js';
import { getDeliveryFee } from '../config.js';
import { paymentMethods, defaultPaymentMethod, getPaymentMethod } from '../payments/index.js';
import { validateReferralCode, normalizeCode } from '../services/referral.js';
import { createOrder } from '../store/orders.js';
import { CHECKOUT_RULES as RULES, normalizeMobile } from '../shared/rules.js';
import * as bundle from '../store/bundle.js';
import * as mystery from '../store/mystery.js';

const DRAFT_KEY = 'dxn.checkout.draft';

// ---------- order source ----------
function orderLines(isMystery) {
  return isMystery ? mystery.lines() : bundle.lines();
}
function totals(lines) {
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const deliveryFee = getDeliveryFee(subtotal);
  return { count: lines.reduce((a, l) => a + l.qty, 0), subtotal, deliveryFee, grandTotal: subtotal + deliveryFee };
}

// Validation rules are shared with the API: js/shared/rules.js (CHECKOUT_RULES).

// ---------- markup ----------
const field = (id, label, { type = 'text', autocomplete = '', placeholder = '', optional = false, inputmode = '', value = '', full = false, textarea = false } = {}) => `
  <div class="${full ? 'sm:col-span-2' : ''}">
    <label for="co-${id}" class="block text-[13.5px] font-semibold mb-1.5">${label}${optional ? ' <span class="font-normal text-ink-mute">(optional)</span>' : ' <span class="text-[#B3261E]" aria-hidden="true">*</span>'}</label>
    ${textarea
      ? `<textarea id="co-${id}" name="${id}" rows="2" placeholder="${placeholder}" class="field-input py-3 resize-none" aria-describedby="co-${id}-err">${esc(value)}</textarea>`
      : `<input id="co-${id}" name="${id}" type="${type}" value="${esc(value)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${placeholder}" ${optional ? '' : 'required aria-required="true"'} class="field-input" aria-describedby="co-${id}-err">`}
    <p id="co-${id}-err" class="field-error" hidden></p>
  </div>`;

const section = (n, title, body, sub = '') => `
  <section class="card p-5 sm:p-6" aria-labelledby="co-sec-${n}">
    <div class="flex items-center gap-3 mb-4">
      <span class="w-7 h-7 rounded-full bg-brand text-white grid place-items-center text-[13px] font-bold shrink-0">${n}</span>
      <div>
        <h2 id="co-sec-${n}" class="font-serif text-[18px] leading-tight">${title}</h2>
        ${sub ? `<p class="text-[12.5px] text-ink-mute">${sub}</p>` : ''}
      </div>
    </div>
    ${body}
  </section>`;

const paymentOptions = (selected) => paymentMethods.map((m) => `
  <label class="pay-option ${m.available ? '' : 'is-disabled'}">
    <input type="radio" name="payment" value="${m.id}" class="sr-only" ${m.id === selected ? 'checked' : ''} ${m.available ? '' : 'disabled'}>
    <span class="pay-radio" aria-hidden="true"></span>
    ${icon(m.icon, 'w-7 h-7 text-brand shrink-0', 1.5)}
    <span class="flex-1 min-w-0">
      <span class="block font-semibold text-[15px]">${m.label}${m.badge ? ` <span class="ml-1.5 align-middle text-[11px] font-bold uppercase tracking-wide rounded-full bg-[#EFEEEA] text-ink-mute px-2 py-0.5">${m.badge}</span>` : ''}</span>
      <span class="block text-[13px] text-ink-mute">${m.description}</span>
    </span>
  </label>`).join('');

const summary = (lines, t) => `
  <aside class="card p-5 sm:p-6 lg:sticky lg:top-[96px]" aria-labelledby="co-summary">
    <div class="flex items-center justify-between">
      <h2 id="co-summary" class="font-serif text-[19px]">Order Summary</h2>
      <a href="${lines[0]?.product.id === 'mystery-box' ? '#/review?type=mystery' : '#/review'}" class="text-[13px] font-semibold text-brand underline underline-offset-2 hover:opacity-75 active:opacity-50">Edit</a>
    </div>
    <ul class="mt-4 flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
      ${lines.map(({ product: p, qty, lineTotal }) => `
        <li class="flex items-center gap-3">
          <div class="relative w-14 h-14 rounded-lg bg-white border border-line overflow-hidden shrink-0">
            ${p.id === 'mystery-box' ? `<img src="${p.image}" alt="" class="w-full h-full object-cover">` : productImage(p)}
            <span class="absolute -top-0 -right-0 min-w-[20px] h-5 px-1 rounded-bl-lg bg-brand text-white text-[11px] font-bold grid place-items-center">${qty}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13.5px] font-semibold leading-snug line-clamp-2">${esc(p.name)}</p>
            <p class="text-[12px] text-ink-mute">${qty} × ${formatPeso(p.price)}${p.size ? ` · ${esc(p.size)}` : ''}</p>
          </div>
          <span class="font-price font-bold text-[14px]">${formatPeso(lineTotal)}</span>
        </li>`).join('')}
    </ul>
    <dl class="mt-5 pt-4 border-t border-line space-y-2.5 text-[14px]">
      <div class="flex justify-between"><dt class="text-ink-soft">Subtotal (${t.count} item${t.count === 1 ? '' : 's'})</dt><dd class="font-semibold">${formatPeso(t.subtotal)}</dd></div>
      <div class="flex justify-between"><dt class="text-ink-soft">Delivery fee</dt><dd>${t.deliveryFee ? formatPeso(t.deliveryFee) : '<span class="font-bold text-brand">FREE</span>'}</dd></div>
    </dl>
    <div class="border-t border-line mt-4 pt-4 flex items-end justify-between">
      <span class="font-semibold">Grand Total</span>
      <span class="font-price font-black text-[28px] leading-none text-brand">${formatPeso(t.grandTotal)}</span>
    </div>
    <p class="field-error mt-4" data-form-error role="alert" hidden></p>
    <button type="submit" form="checkout-form" class="btn btn-green w-full h-[54px] mt-4 text-[16px]" data-place-order>
      <span data-label>Place Order</span>${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}
    </button>
    <p class="text-[12px] text-ink-mute text-center mt-3" data-pay-note></p>
  </aside>`;

export function renderCheckout(params) {
  const isMystery = params.get('type') === 'mystery';
  const lines = orderLines(isMystery);
  const head = `<div class="bg-[#F3F3F1] border-b border-line py-4">${steps(3, { mystery: isMystery })}</div>`;

  if (!lines.length) {
    return `${head}
    <section class="mx-auto max-w-[1180px] px-3 sm:px-6 py-10">
      <div class="card max-w-lg mx-auto p-8 sm:p-10 text-center">
        ${icon('box', 'w-12 h-12 mx-auto text-brand', 1.4)}
        <h1 class="font-serif text-[21px] mt-4">Nothing to check out yet</h1>
        <p class="text-[14px] text-ink-mute mt-2">Add DXN products to your bundle or pick a Mystery Box first.</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <a href="#/customize" class="btn btn-green h-12 px-6 text-[14.5px]">${icon('gear', 'w-5 h-5', 1.6)}Customize Your Bundle</a>
          <a href="#/mystery-box" class="btn btn-gold h-12 px-6 text-[14.5px]">${icon('box', 'w-5 h-5', 1.5)}Mystery Box</a>
        </div>
      </div>
    </section>`;
  }

  let d = {};
  try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'); } catch { /* ignore */ }
  const t = totals(lines);

  return `${head}
  <section class="mx-auto max-w-[1180px] px-3 sm:px-6 pt-5 pb-12">
    <div class="relative text-center mb-6">
      <a href="${isMystery ? '#/review?type=mystery' : '#/review'}" class="absolute left-0 top-0.5 sm:left-1 sm:top-1 inline-flex items-center gap-1.5 text-[15px] hover:opacity-70 active:opacity-50" aria-label="Back to review">${icon('chevronLeft', 'w-5 h-5', 2)}<span class="hidden sm:inline">Back</span></a>
      <h1 class="font-serif text-[20px] sm:text-[26px]">Checkout</h1>
      <p class="text-[14px] sm:text-[15px] text-ink-soft mt-1">Fields marked <span class="text-[#B3261E]">*</span> are required.</p>
    </div>

    <div class="grid lg:grid-cols-[1fr_380px] gap-5 lg:gap-8 items-start">
      <form id="checkout-form" class="flex flex-col gap-4" novalidate>
        ${section(1, 'Contact Details', `
          <div class="grid sm:grid-cols-2 gap-4">
            ${field('name', 'Full name', { autocomplete: 'name', placeholder: 'Juan Dela Cruz', value: d.name, full: true })}
            ${field('mobile', 'Mobile number', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '0917 123 4567', value: d.mobile })}
            ${field('email', 'Email', { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'you@example.com', value: d.email })}
          </div>`, 'We’ll use these to confirm your order.')}

        ${section(2, 'Delivery Address', `
          <div class="grid sm:grid-cols-2 gap-4">
            ${field('street', 'House no., street, building', { autocomplete: 'address-line1', placeholder: 'Unit 4B, 123 Rizal St.', value: d.street, full: true })}
            ${field('barangay', 'Barangay', { autocomplete: 'address-line2', placeholder: 'Brgy. San Antonio', value: d.barangay })}
            ${field('city', 'City / Municipality', { autocomplete: 'address-level2', placeholder: 'Quezon City', value: d.city })}
            ${field('province', 'Province', { autocomplete: 'address-level1', placeholder: 'Metro Manila', value: d.province })}
            ${field('zip', 'ZIP code', { autocomplete: 'postal-code', inputmode: 'numeric', placeholder: '1100', value: d.zip, optional: true })}
            ${field('notes', 'Delivery notes', { placeholder: 'Landmark, gate code, best time to deliver…', value: d.notes, optional: true, full: true, textarea: true })}
          </div>`)}

        ${section(3, 'Referral Code', `
          <label for="co-referral" class="block text-[13.5px] font-semibold mb-1.5">Referral code <span class="text-[#B3261E]" aria-hidden="true">*</span></label>
          <div class="flex gap-2.5">
            <input id="co-referral" name="referral" type="text" value="${esc(d.referral || '')}" autocomplete="off" autocapitalize="characters" spellcheck="false" required aria-required="true" placeholder="e.g. DXN-JS001" class="field-input flex-1 uppercase tracking-wide" aria-describedby="co-referral-err co-referral-ok">
            <button type="button" class="btn btn-green h-12 px-5 text-[14px] shrink-0" data-verify>Verify</button>
          </div>
          <p id="co-referral-err" class="field-error" hidden></p>
          <p id="co-referral-ok" class="mt-2 text-[13px] text-brand font-semibold flex items-center gap-1.5" role="status" hidden></p>`,
          'Required. Ask the DXN member who referred you.')}

        ${section(4, 'Payment Method', `
          <fieldset>
            <legend class="sr-only">Payment method</legend>
            <div class="flex flex-col gap-3" data-payments>${paymentOptions(d.payment && paymentMethods.find((m) => m.id === d.payment && m.available) ? d.payment : defaultPaymentMethod().id)}</div>
          </fieldset>`)}
      </form>

      ${summary(lines, t)}
    </div>
  </section>`;
}

export function mountCheckout(root, params) {
  const form = root.querySelector('#checkout-form');
  if (!form) return null;
  const isMystery = params.get('type') === 'mystery';
  const $ = (s) => root.querySelector(s);
  const refInput = $('#co-referral'), verifyBtn = $('[data-verify]'), refErr = $('#co-referral-err'), refOk = $('#co-referral-ok');
  const placeBtn = $('[data-place-order]'), formErr = $('[data-form-error]'), payNote = $('[data-pay-note]');
  const touched = new Set();
  let referral = null; // verified result for the current input
  let submitting = false;

  const t = totals(orderLines(isMystery));
  const updatePayNote = () => {
    const id = form.payment.value;
    payNote.textContent = id === 'cod' ? `You’ll pay ${formatPeso(t.grandTotal)} in cash when your order arrives.`
      : id === 'gcash' ? 'Next, you’ll scan our GCash QR and enter your reference no.' : '';
  };
  updatePayNote();

  const saveDraft = () => {
    const data = Object.fromEntries(new FormData(form));
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  };

  function showError(input, msg, errEl = root.querySelector(`#co-${input.name}-err`)) {
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    input.classList.toggle('is-invalid', !!msg);
    errEl.textContent = msg;
    errEl.hidden = !msg;
  }
  const check = (input) => { const msg = RULES[input.name]?.(input.value) ?? ''; showError(input, msg); return !msg; };

  // Field validation: on blur once, then live while fixing.
  form.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!RULES[el.name]) return;
    touched.add(el.name);
    check(el);
    if (el.name === 'mobile' && normalizeMobile(el.value)) el.value = normalizeMobile(el.value).replace('+63 ', '0');
  });
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (RULES[el.name] && touched.has(el.name)) check(el);
    if (el === refInput) resetReferral();
    if (el.name === 'payment') updatePayNote();
    saveDraft();
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'payment') { updatePayNote(); saveDraft(); } });

  // ---------- referral ----------
  function resetReferral() {
    referral = null;
    refOk.hidden = true;
    refInput.classList.remove('is-valid');
    showError(refInput, '', refErr);
  }
  async function verify() {
    const code = normalizeCode(refInput.value);
    if (referral?.valid && referral.code === code) return true;
    refInput.value = code;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span>Checking`;
    showError(refInput, '', refErr);
    refOk.hidden = true;
    const res = await validateReferralCode(code);
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
    if (normalizeCode(refInput.value) !== code) return false; // input changed while checking
    if (res.valid) {
      referral = res;
      refInput.classList.add('is-valid');
      refOk.innerHTML = `${icon('check', 'w-4 h-4', 3)}Verified — referred by ${esc(res.referrer)}`;
      refOk.hidden = false;
      saveDraft();
      return true;
    }
    showError(refInput, res.reason, refErr);
    return false;
  }
  verifyBtn.addEventListener('click', () => verify());
  refInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verify(); } });
  if (refInput.value) verify(); // re-verify a saved draft code

  // ---------- submit ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    formErr.hidden = true;

    const inputs = [...form.querySelectorAll('input, textarea')].filter((el) => RULES[el.name]);
    inputs.forEach((el) => touched.add(el.name));
    const bad = inputs.filter((el) => !check(el));
    const refOkNow = refInput.value.trim() ? await verify() : (showError(refInput, 'A referral code is required to place your order.', refErr), false);
    if (bad.length || !refOkNow) {
      const first = bad[0] || refInput;
      first.focus();
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      formErr.textContent = `Please fix ${bad.length + (refOkNow ? 0 : 1)} field${bad.length + (refOkNow ? 0 : 1) === 1 ? '' : 's'} above.`;
      formErr.hidden = false;
      return;
    }

    submitting = true;
    placeBtn.disabled = true;
    placeBtn.querySelector('[data-label]').innerHTML = `<span class="spinner" aria-hidden="true"></span>Placing order…`;
    const v = Object.fromEntries(new FormData(form));
    const lines = orderLines(isMystery);
    try {
      // Only ids + quantities are sent: the server prices everything from the database.
      const { order, token } = await createOrder({
        type: isMystery ? 'mystery' : 'custom',
        items: isMystery ? [] : lines.map(({ product, qty }) => ({ id: product.id, qty })),
        mysteryQty: isMystery ? lines[0]?.qty : undefined,
        paymentMethod: v.payment,
        referralCode: referral.code,
        customer: {
          name: v.name, mobile: v.mobile, email: v.email,
          street: v.street, barangay: v.barangay, city: v.city, province: v.province, zip: v.zip, notes: v.notes,
        },
      });
      if (isMystery) mystery.setQty(0); else bundle.clear();
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      const page = getPaymentMethod(order.payment.method).requiresProof ? 'pay' : 'order';
      location.hash = `#/${page}/${order.id}?t=${encodeURIComponent(token)}`;
    } catch (err) {
      submitting = false;
      placeBtn.disabled = false;
      placeBtn.querySelector('[data-label]').textContent = 'Place Order';
      // Server-side field errors (same rules as the form) go next to their fields.
      if (err.fields) {
        for (const [name, msg] of Object.entries(err.fields)) {
          if (name === 'referral') { resetReferral(); showError(refInput, msg, refErr); }
          else if (form[name]) showError(form[name], msg);
        }
        (form.querySelector('[aria-invalid="true"]') || refInput).focus();
      }
      formErr.textContent = err.message || 'Something went wrong. Please try again.';
      formErr.hidden = false;
    }
  });

  return null;
}
