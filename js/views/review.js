// Review (step 2) for both flows:
//   #/review               → custom bundle (edit quantities, remove items)
//   #/review?type=mystery  → Mystery Box order (choose number of boxes)
// Checkout is allowed at ANY total; ₱7,999 is only a featured reference.
import { icon, formatPeso, esc, steps, referenceNote, rerender, announce, productImage } from '../components.js';
import { categoryName as catName } from '../data/products.js';
import { getDeliveryFee } from '../config.js';
import * as bundle from '../store/bundle.js';
import * as mystery from '../store/mystery.js';

const feeLabel = (fee) => (fee ? formatPeso(fee) : '<span class="font-bold text-brand">FREE</span>');

const line = ({ product: p, qty, lineTotal }) => `
  <li class="card p-3 sm:p-4 flex gap-3 sm:gap-4">
    <div class="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] rounded-xl bg-white overflow-hidden shrink-0">${productImage(p)}</div>
    <div class="flex-1 min-w-0 grid sm:grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-2">
      <div class="min-w-0">
        <p class="text-[11.5px] uppercase tracking-wider text-ink-mute">${esc(catName(p.category))}</p>
        <h3 class="text-[15px] sm:text-[16px] font-semibold leading-snug">${esc(p.name)}</h3>
        <p class="text-[13px] text-ink-mute">${p.size ? `${esc(p.size)} · ` : ''}${formatPeso(p.price)} each</p>
      </div>
      <div class="flex items-center justify-between sm:justify-start gap-3">
        <div class="stepper" role="group" aria-label="Quantity for ${esc(p.name)}">
          <button type="button" data-action="dec" data-id="${p.id}" aria-label="${qty === 1 ? 'Remove' : 'Decrease'} ${esc(p.name)}">${icon('minus', 'w-4 h-4', 2.2)}</button>
          <output>${qty}</output>
          <button type="button" data-action="add" data-id="${p.id}" class="stepper-plus" aria-label="Increase ${esc(p.name)}" ${qty >= bundle.MAX_QTY ? 'disabled' : ''}>${icon('plus', 'w-4 h-4', 2.4)}</button>
        </div>
        <span class="sm:hidden font-price font-extrabold text-[17px]">${formatPeso(lineTotal)}</span>
      </div>
      <span class="hidden sm:block font-price font-extrabold text-[18px] text-right min-w-[92px]">${formatPeso(lineTotal)}</span>
    </div>
    <button type="button" data-action="remove" data-id="${p.id}" class="icon-btn w-9 h-9 -mr-1 -mt-1 self-start text-ink-mute" aria-label="Remove ${esc(p.name)}">${icon('plus', 'w-5 h-5 rotate-45', 2)}</button>
  </li>`;

const mysteryLine = ({ product: p, qty, lineTotal }) => `
  <li class="rounded-[16px] bg-gold-soft shadow-[var(--shadow-1)] p-3 sm:p-4 flex gap-3 sm:gap-4">
    <img src="${p.image}" alt="" class="w-[96px] h-[84px] sm:w-[128px] sm:h-[96px] rounded-xl object-cover shrink-0">
    <div class="flex-1 min-w-0 grid sm:grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-2">
      <div class="min-w-0">
        <h3 class="text-[16px] font-bold text-[#6B4423]">${esc(p.name)}</h3>
        <p class="text-[13px] text-gold-deep">A curated mix of DXN bestsellers and new products</p>
        <p class="text-[13px] text-ink-mute">${formatPeso(p.price)} per box</p>
      </div>
      <div class="flex items-center justify-between sm:justify-start gap-3">
        <div class="stepper" role="group" aria-label="Number of Mystery Boxes">
          <button type="button" data-mystery="dec" aria-label="${qty === 1 ? 'Remove Mystery Box' : 'One fewer box'}">${icon('minus', 'w-4 h-4', 2.2)}</button>
          <output>${qty}</output>
          <button type="button" data-mystery="inc" class="stepper-plus" aria-label="One more box" ${qty >= mystery.MAX_BOXES ? 'disabled' : ''}>${icon('plus', 'w-4 h-4', 2.4)}</button>
        </div>
        <span class="sm:hidden font-price font-extrabold text-[17px]">${formatPeso(lineTotal)}</span>
      </div>
      <span class="hidden sm:block font-price font-extrabold text-[18px] text-right min-w-[92px]">${formatPeso(lineTotal)}</span>
    </div>
  </li>`;

/** Order summary card; shared with checkout. `s` = { count, subtotal, ...bundle summary fields }. */
export const summaryCard = (s, { cta = null, reference = true, title = 'Order Summary', extra = '' } = {}) => {
  const fee = getDeliveryFee(s.subtotal);
  return `
  <aside class="card p-5 sm:p-6 lg:sticky lg:top-[96px]">
    <h2 class="font-serif text-[19px]">${title}</h2>
    ${extra}
    <dl class="mt-4 space-y-2.5 text-[14px]">
      <div class="flex justify-between"><dt class="text-ink-soft">Items</dt><dd>${s.count}</dd></div>
      <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd class="font-semibold">${formatPeso(s.subtotal)}</dd></div>
      <div class="flex justify-between"><dt class="text-ink-soft">Delivery fee</dt><dd>${feeLabel(fee)}</dd></div>
    </dl>
    <div class="border-t border-line mt-4 pt-4 flex items-end justify-between">
      <span class="font-semibold">Grand Total</span>
      <span class="font-price font-black text-[28px] leading-none text-brand">${formatPeso(s.subtotal + fee)}</span>
    </div>
    ${reference ? `
    <div class="mt-5 rounded-xl bg-brand-soft p-3.5">
      <div class="flex items-center gap-3">
        <div class="progress-track flex-1 bg-white" role="progressbar" aria-valuenow="${Math.min(s.pct, 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress toward the featured ${formatPeso(s.reference)} package">
          <div class="progress-fill" style="transform:scaleX(${s.fill})"></div>
        </div>
        <span class="text-[12.5px] text-ink-soft whitespace-nowrap">${s.pct}%</span>
      </div>
      <p class="text-[12.5px] text-ink-soft mt-2 leading-snug">${referenceNote(s)}. <strong class="text-brand-band">Any amount can check out.</strong></p>
    </div>` : ''}
    ${cta || ''}
  </aside>`;
};

const mobileBar = (count, total, href) => `
  <div class="lg:hidden fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-30 bg-white border-t border-line shadow-[0_-10px_30px_-18px_rgba(20,45,28,.35)]">
    <div class="px-4 py-3 flex items-center gap-4">
      <div class="shrink-0">
        <p class="text-[12.5px] text-ink-soft">Total (${count} item${count === 1 ? '' : 's'})</p>
        <p class="font-price font-extrabold text-[22px] leading-tight">${formatPeso(total)}</p>
      </div>
      <a href="${href}" class="btn btn-green flex-1 h-12 text-[14.5px] whitespace-nowrap">Continue to Checkout${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}</a>
    </div>
  </div>`;

const emptyState = (isMystery) => `
  <div class="card max-w-lg mx-auto p-8 sm:p-10 text-center">
    ${icon('box', 'w-12 h-12 mx-auto text-brand', 1.4)}
    <h2 class="font-serif text-[21px] mt-4">${isMystery ? 'No Mystery Box selected' : 'Your bundle is empty'}</h2>
    <p class="text-[14px] text-ink-mute mt-2">Pick the DXN products you want — any amount works — or let us surprise you with a Mystery Box.</p>
    <div class="flex flex-col sm:flex-row gap-3 justify-center mt-6">
      <a href="#/customize" class="btn btn-green h-12 px-6 text-[14.5px]">${icon('gear', 'w-5 h-5', 1.6)}Customize Your Bundle</a>
      <a href="#/mystery-box" class="btn btn-gold h-12 px-6 text-[14.5px]">${icon('box', 'w-5 h-5', 1.5)}Mystery Box</a>
    </div>
  </div>`;

const checkoutCta = (href, back) => `
  <a href="${href}" class="btn btn-green w-full h-[52px] mt-5 text-[15.5px]">Continue to Checkout${icon('arrowRight', 'w-5 h-5 btn-arrow', 2)}</a>
  <a href="${back.href}" class="btn w-full h-11 mt-2.5 text-[14px] text-brand border border-brand/30 bg-white hover:bg-brand-soft">${icon('plus', 'w-4 h-4', 2.4)}${back.label}</a>`;

const bundleContent = (confirmClear = false) => {
  const s = bundle.summary();
  if (!s.count) return emptyState(false);
  const fee = getDeliveryFee(s.subtotal);
  return `
  <div class="grid lg:grid-cols-[1fr_360px] gap-5 lg:gap-8 items-start">
    <div>
      <div class="flex items-center justify-between mb-3">
        <p class="text-[14px] text-ink-soft">${s.products} product${s.products === 1 ? '' : 's'} · ${s.count} item${s.count === 1 ? '' : 's'}</p>
        ${confirmClear
          ? `<span class="flex items-center gap-3 text-[13px]"><span class="text-ink-soft">Remove everything?</span>
               <button type="button" data-clear-confirm class="font-bold text-[#B3261E] hover:opacity-75 active:opacity-50">Yes, clear</button>
               <button type="button" data-clear-cancel class="font-semibold hover:opacity-75 active:opacity-50">Cancel</button></span>`
          : `<button type="button" data-clear class="text-[13px] font-semibold text-ink-mute underline underline-offset-2 hover:text-ink active:opacity-60">Clear bundle</button>`}
      </div>
      <ul class="flex flex-col gap-3">${bundle.lines().map(line).join('')}</ul>
    </div>
    ${summaryCard(s, { title: 'Bundle Summary', cta: checkoutCta('#/checkout', { href: '#/customize', label: 'Add More Products' }) })}
  </div>
  ${mobileBar(s.count, s.subtotal + fee, '#/checkout')}`;
};

const mysteryContent = () => {
  const ls = mystery.lines();
  if (!ls.length) return emptyState(true);
  const s = { count: ls[0].qty, subtotal: ls[0].lineTotal };
  const fee = getDeliveryFee(s.subtotal);
  return `
  <div class="grid lg:grid-cols-[1fr_360px] gap-5 lg:gap-8 items-start">
    <ul class="flex flex-col gap-3">${ls.map(mysteryLine).join('')}</ul>
    ${summaryCard(s, { reference: false, cta: checkoutCta('#/checkout?type=mystery', { href: '#/customize', label: 'Build Your Own Bundle Instead' }) })}
  </div>
  ${mobileBar(s.count, s.subtotal + fee, '#/checkout?type=mystery')}`;
};

export function renderReview(params) {
  const isMystery = params.get('type') === 'mystery';
  return `
  <div class="bg-[#F3F3F1] border-b border-line py-4">${steps(2, { mystery: isMystery })}</div>
  <section class="mx-auto max-w-[1180px] px-3 sm:px-6 pt-5 pb-32 lg:pb-12">
    <div class="relative text-center mb-6">
      <a href="${isMystery ? '#/mystery-box' : '#/customize'}" class="absolute left-0 top-0.5 sm:left-1 sm:top-1 inline-flex items-center gap-1.5 text-[15px] hover:opacity-70 active:opacity-50" aria-label="Back">${icon('chevronLeft', 'w-5 h-5', 2)}<span class="hidden sm:inline">Back</span></a>
      <h1 class="font-serif text-[20px] sm:text-[26px]">${isMystery ? 'Review Your Order' : 'Review Your Bundle'}</h1>
      <p class="text-[14px] sm:text-[15px] text-ink-soft mt-1">${isMystery ? 'Choose how many Mystery Boxes you’d like.' : 'Adjust quantities or remove items before checkout.'}</p>
    </div>
    <div data-review>${isMystery ? mysteryContent() : bundleContent()}</div>
  </section>`;
}

export function mountReview(root, params) {
  const isMystery = params.get('type') === 'mystery';
  const box = root.querySelector('[data-review]');
  let confirming = false;
  const draw = () => rerender(box, isMystery ? mysteryContent() : bundleContent(confirming));
  document.body.classList.add('has-bundle-bar');

  const onClick = (e) => {
    const m = e.target.closest('[data-mystery]');
    if (m && isMystery) {
      const q = mystery.setQty(mystery.getQty() + (m.dataset.mystery === 'inc' ? 1 : -1));
      draw();
      box.querySelector(`[data-mystery="${m.dataset.mystery}"]`)?.focus({ preventScroll: true });
      announce(q ? `${q} Mystery Box${q === 1 ? '' : 'es'}.` : 'Mystery Box removed.');
      return;
    }
    if (e.target.closest('[data-clear]')) { confirming = true; draw(); box.querySelector('[data-clear-cancel]')?.focus(); }
    else if (e.target.closest('[data-clear-cancel]')) { confirming = false; draw(); box.querySelector('[data-clear]')?.focus(); }
    else if (e.target.closest('[data-clear-confirm]')) { confirming = false; bundle.clear(); announce('Bundle cleared.'); }
  };
  root.addEventListener('click', onClick);
  const unsub = isMystery ? () => {} : bundle.subscribe((change) => {
    draw();
    if (change.id && !change.qty) announce('Item removed from bundle.');
    if (!box.contains(document.activeElement)) box.querySelector('[data-action], a')?.focus({ preventScroll: true });
  });
  return () => { unsub(); root.removeEventListener('click', onClick); document.body.classList.remove('has-bundle-bar'); };
}
