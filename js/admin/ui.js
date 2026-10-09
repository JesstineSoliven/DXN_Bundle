// Small UI helpers shared by the admin views.
import { icon } from '../icons.js';
import { esc } from '../components.js';
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } from '../shared/constants.js';

export { icon, esc, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHODS };

export const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH');
export const fmtDate = (iso, opts = { dateStyle: 'medium', timeStyle: 'short' }) => (iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', ...opts }) : '—');
const trim = (x) => x.toFixed(1).replace(/.0$/, '');
export const compact = (n) => (n >= 1e6 ? `${trim(n / 1e6)}M` : n >= 1e4 ? `${trim(n / 1e3)}K` : Number(n).toLocaleString('en-PH'));

export const orderChip = (s) => `<span class="st st-${esc(s)}">${esc(ORDER_STATUS[s] || s)}</span>`;
export const payChip = (s) => `<span class="st st-${esc(s)}">${esc(PAYMENT_STATUS[s] || s)}</span>`;
export const activeChip = (on) => `<span class="st ${on ? 'st-confirmed' : 'st-off'}">${on ? 'Active' : 'Archived'}</span>`;

let toastTimer;
export function toast(msg, tone = 'ok') {
  const el = document.getElementById('toast');
  el.innerHTML = `${icon(tone === 'ok' ? 'check' : 'shield', 'w-4 h-4', 2.4)}<span>${msg}</span>`;
  el.style.background = tone === 'ok' ? '#16261C' : '#8C1D18';
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const pageHead = (title, sub = '', actions = '') => `
  <div class="flex flex-col sm:flex-row sm:items-end gap-3 mb-5">
    <div class="flex-1 min-w-0">
      <h1 class="font-serif text-[24px] lg:text-[28px] leading-tight">${title}</h1>
      ${sub ? `<p class="text-[13.5px] text-ink-mute mt-1">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ''}
  </div>`;

export const empty = (text) => `<div class="card p-10 text-center text-ink-mute text-[14px]">${text}</div>`;
export const loading = () => `<div class="py-20 text-center text-ink-mute" aria-busy="true"><span class="spinner inline-block text-brand" aria-hidden="true"></span><p class="mt-3 text-[13.5px]">Loading…</p></div>`;

/** Show field errors from an ApiError (err.fields) on [name] inputs inside root. */
export function fieldErrors(root, err) {
  root.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  for (const [name, msg] of Object.entries(err?.fields || {})) {
    const el = root.querySelector(`[name="${name}"]`);
    if (el) { el.classList.add('is-invalid'); el.title = msg; }
  }
}

/** Re-run the current route (after a change). */
export const reload = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
