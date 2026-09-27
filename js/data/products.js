// Catalog data. Products + CP prices come from the official price list via tools/import-pricelist.mjs
// (→ catalog.js). Phase 5 replaces these exports with API calls; views only import from here.
import { catalog } from './catalog.js';

export const FEATURED_PACKAGE_PRICE = 7999; // featured/reference package — NOT a checkout minimum

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

// Featured products first (mockup order), then price-list order.
const FEATURED_ORDER = ['FB096', 'HF127', 'FB007', 'HF001', 'FB205', 'PC036'];
const rank = (p) => (p.featured ? FEATURED_ORDER.indexOf(p.code) : FEATURED_ORDER.length);
export const products = [...catalog].sort((a, b) => rank(a) - rank(b)); // stable: non-featured keep list order

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
export const getProduct = (id) => catalog.find((p) => p.id === id);
export const categoryName = (id) => categories.find((c) => c.id === id)?.name || '';
