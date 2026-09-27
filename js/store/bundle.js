// Bundle state: { productId: qty }. Single source of truth for the builder, review and cart badge.
// Persists to localStorage (best-effort). No minimum total — ₱7,999 is only a reference point.
import { products, getProduct, FEATURED_PACKAGE_PRICE } from '../data/products.js';

const KEY = 'dxn.bundle.v1';
export const MAX_QTY = 99;

let items = load();
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Drop unknown products / bad quantities (catalog may change between visits).
    return Object.fromEntries(Object.entries(raw)
      .filter(([id, q]) => getProduct(id) && Number.isInteger(q) && q > 0)
      .map(([id, q]) => [id, Math.min(q, MAX_QTY)]));
  } catch { return {}; }
}

function commit(change) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn(change));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const getQty = (id) => items[id] || 0;

export function setQty(id, qty) {
  if (!getProduct(id)) return;
  const prev = getQty(id);
  const next = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(qty) || 0)));
  if (next === prev) return;
  if (next) items = { ...items, [id]: next };
  else { const { [id]: _, ...rest } = items; items = rest; }
  commit({ id, prev, qty: next });
}

export const add = (id, n = 1) => setQty(id, getQty(id) + n);
export const decrement = (id) => setQty(id, getQty(id) - 1);
export const remove = (id) => setQty(id, 0);
export const toggle = (id) => setQty(id, getQty(id) ? 0 : 1);
export function clear() { items = {}; commit({ cleared: true }); }

/** Selected lines in catalog order. */
export const lines = () => products
  .filter((p) => items[p.id])
  .map((p) => ({ product: p, qty: items[p.id], lineTotal: p.price * items[p.id] }));

export function summary() {
  const ls = lines();
  const count = ls.reduce((a, l) => a + l.qty, 0);
  const subtotal = ls.reduce((a, l) => a + l.lineTotal, 0);
  const ratio = subtotal / FEATURED_PACKAGE_PRICE;
  return {
    count,
    subtotal,
    products: ls.length,
    reference: FEATURED_PACKAGE_PRICE,
    pct: Math.round(ratio * 100),
    fill: Math.min(1, ratio),
    diff: FEATURED_PACKAGE_PRICE - subtotal, // >0 below reference, <0 above
    canCheckout: count > 0, // any amount — only an empty bundle has nothing to check out
  };
}
