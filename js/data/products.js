// Catalog data. Products + CP prices come from the database via GET /api/catalog (loadCatalog()).
// The bundled catalog.js (generated from the price list) is the offline fallback and the DB seed source.
import { catalog as bundled } from './catalog.js';
import { FEATURED_PACKAGE_PRICE } from '../shared/constants.js';

export { FEATURED_PACKAGE_PRICE };

// `image` = category photo used by the "Shop by Category" cards (mockup categories only).
export const categories = [
  { id: 'beverages', name: 'Beverages', image: 'assets/img/c-beverages.webp' },
  { id: 'supplements', name: 'Supplements', image: 'assets/img/c-supplements.webp' },
  { id: 'personal-care', name: 'Personal Care', image: 'assets/img/c-personal-care.webp' },
  { id: 'food', name: 'Food', image: 'assets/img/c-food.webp' },
  { id: 'bundles', name: 'Bundle Packages', image: 'assets/img/c-bundles.webp' },
  { id: 'skincare', name: 'Skincare & Cosmetics' },
  { id: 'household', name: 'Household' },
  { id: 'apparel', name: 'Apparel' },
  { id: 'appliance', name: 'Appliance' },
];

/** Categories with a photo card (Shop by Category). */
export const showcaseCategories = categories.filter((c) => c.image);

// Filter chips shown above product lists (Bundle Packages is a landing category, not a chip).
export const filterCategories = categories.filter((c) => c.id !== 'bundles');

// Featured products (mockup order). Used for the bundled fallback and to seed featured_rank in the DB.
export const FEATURED_ORDER = ['FB096', 'HF127', 'FB007', 'HF001', 'FB205', 'PC036'];

function sortProducts(list) {
  const rank = (p) => (p.featured ? (p.featuredRank ?? FEATURED_ORDER.indexOf(p.code)) : Infinity);
  return list.map((p, i) => [p, i]).sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[1] - b[1])).map(([p]) => p);
}

/** Live binding: importers always see the latest catalog. */
export let products = sortProducts(bundled);
export let catalogSource = 'bundled';

/** Fetch the live catalog. Falls back to the bundled list (e.g. static preview without the API). */
export async function loadCatalog({ timeoutMs = 5000 } = {}) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch('/api/catalog', { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.products) || !data.products.length) throw new Error('empty catalog');
    products = sortProducts(data.products);
    catalogSource = 'api';
  } catch (err) {
    console.warn('[catalog] using bundled price list:', err.message);
  }
  return products;
}

export const mysteryBox = {
  id: 'mystery-box',
  name: 'DXN Mystery Box',
  price: FEATURED_PACKAGE_PRICE,
  tagline: 'A surprise worth sharing',
  description: 'Let us surprise you with a curated selection of DXN bestsellers and new products!',
  highlights: ['A curated mix of DXN bestsellers', 'Discover new products', 'Exciting and unique experience', 'Same package price: ₱7,999'],
  image: 'assets/img/mystery-box-lg.webp',
};

export const testimonials = [
  { name: 'Mariel S.', avatar: 'assets/img/avatar-mariel.webp', rating: 5,
    quote: '“Ang sarap ng Lingzhi Coffee! Nakaka-boost ng energy ko araw-araw.”' },
  { name: 'Ramon C.', avatar: 'assets/img/avatar-ramon.webp', rating: 5,
    quote: '“Complete at sulit ang bundle package. Authentic DXN products at mabilis ang delivery!”' },
];

export const formatPeso = (n) => '₱' + n.toLocaleString('en-PH');
export const getProduct = (id) => products.find((p) => p.id === id);
export const categoryName = (id) => categories.find((c) => c.id === id)?.name || '';
