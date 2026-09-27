// Mystery Box quantity for the Mystery Box → Review → Checkout flow (per browser session).
import { mysteryBox } from '../data/products.js';

const KEY = 'dxn.mystery.qty';
export const MAX_BOXES = 10;

export function getQty() {
  try { const n = parseInt(sessionStorage.getItem(KEY), 10); return n > 0 ? Math.min(n, MAX_BOXES) : 0; } catch { return 0; }
}
export function setQty(n) {
  const q = Math.max(0, Math.min(MAX_BOXES, Math.floor(Number(n) || 0)));
  try { q ? sessionStorage.setItem(KEY, String(q)) : sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  return q;
}

/** Order lines in the same shape as bundle lines. */
export function lines() {
  const qty = getQty();
  return qty ? [{ product: { ...mysteryBox, code: 'MYSTERY', size: 'Curated DXN selection', category: 'bundles' }, qty, lineTotal: mysteryBox.price * qty }] : [];
}
