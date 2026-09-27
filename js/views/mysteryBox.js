// Mystery Box — uses the warm Mystery Box card language from the mockups.
import { icon, checkItem, formatPeso, esc } from '../components.js';
import { mysteryBox as box } from '../data/products.js';
import * as mystery from '../store/mystery.js';

export function mountMysteryBox(root) {
  // Picking the box starts the Mystery Box order with 1 box (keeps an existing quantity).
  const onClick = (e) => { if (e.target.closest('[data-get-mystery]') && !mystery.getQty()) mystery.setQty(1); };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}

export function renderMysteryBox() {
  return `
  <section class="mx-auto max-w-[1180px] px-3 lg:px-10 pt-5 lg:pt-10 pb-12">
    <a href="#/" class="inline-flex items-center gap-1.5 text-[15px] mb-4 px-1 hover:opacity-70 active:opacity-50">${icon('chevronLeft', 'w-5 h-5', 2)}Back</a>

    <article class="rounded-[18px] bg-gold-soft shadow-[var(--shadow-2)] overflow-hidden grid lg:grid-cols-[1.05fr_1fr]">
      <img src="${box.image}" alt="DXN Mystery Box" class="w-full h-[260px] sm:h-[340px] lg:h-full object-cover">
      <div class="p-6 lg:p-10 flex flex-col">
        <h1 class="font-extrabold lg:font-bold lg:font-serif text-[26px] lg:text-[34px] text-[#6B4423]">Mystery Box</h1>
        <p class="text-[16px] lg:text-[18px] text-gold-deep mt-1">${esc(box.tagline)}</p>
        <p class="text-[14px] lg:text-[15px] text-ink-soft mt-3 max-w-[420px]">${esc(box.description)}</p>
        <ul class="flex flex-col gap-3 mt-5 text-ink">${box.highlights.map((h) => checkItem(h, { gold: true, cls: 'text-[14.5px]' })).join('')}</ul>

        <div class="mt-7 pt-6 border-t border-gold/25 flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <p class="text-[13px] text-ink-mute">Package price</p>
            <p class="font-price font-black text-[40px] leading-none tracking-[-0.02em] text-[#6B4423]">${formatPeso(box.price)}</p>
          </div>
          <a href="#/review?type=mystery" data-get-mystery class="btn btn-gold sm:ml-auto h-14 px-8 text-[16px]">${icon('box', 'w-6 h-6', 1.5)}Get Mystery Box${icon('chevronRight', 'w-5 h-5 btn-arrow', 2)}</a>
        </div>
      </div>
    </article>

    <div class="mt-5 rounded-[16px] bg-brand-soft px-5 py-5 lg:px-8 flex flex-col sm:flex-row sm:items-center gap-4">
      ${icon('leaf', 'w-8 h-8 text-brand shrink-0', 1.6)}
      <div>
        <p class="font-bold text-[15px] text-brand-band">Prefer to pick your own?</p>
        <p class="text-[13.5px] text-ink-soft">Same great DXN products. You choose the experience.</p>
      </div>
      <a href="#/customize" class="btn btn-green sm:ml-auto h-11 px-6 text-[14px]">${icon('gear', 'w-5 h-5', 1.6)}Customize Your Bundle${icon('chevronRight', 'w-4 h-4 btn-arrow', 2)}</a>
    </div>
  </section>`;
}
