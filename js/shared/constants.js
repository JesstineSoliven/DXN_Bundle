// Constants shared by the browser and the API (/api, lib/). Keep free of DOM and Node APIs.

export const FEATURED_PACKAGE_PRICE = 7999; // featured/reference package — NOT a checkout minimum
export const DELIVERY_FEE = 0;              // ₱ — free delivery for now
export const MAX_QTY = 99;                  // per product line
export const MAX_BOXES = 10;                // Mystery Boxes per order

export const MYSTERY_BOX = {
  id: 'mystery-box',
  code: 'MYSTERY',
  name: 'DXN Mystery Box',
  size: 'Curated DXN selection',
  price: FEATURED_PACKAGE_PRICE,
};

export const PAYMENT_METHODS = { cod: 'Cash on Delivery', gcash: 'GCash' };

export const PAYMENT_STATUS = {
  cod_pending: 'To pay on delivery',
  pending: 'Pending Payment',
  submitted: 'Payment Submitted',
  confirmed: 'Payment Confirmed',
  failed: 'Payment Failed',
};

/**
 * GCash convenience fee charged to the customer (covers the PayMongo e-wallet fee).
 * CONFIRM against PayMongo's current pricing (Dashboard → Settings → Fees) before going live.
 */
export const GCASH_FEE_BPS = 250; // basis points: 250 = 2.5%

/** Payment fee for a method, in whole pesos (rounded up). COD has no fee. */
// Integer math (basis points) avoids float rounding: ₱400 × 2.5% = exactly ₱10, not ₱11.
export const getPaymentFee = (method, subtotal) => (method === 'gcash' ? Math.ceil((subtotal * GCASH_FEE_BPS) / 10000) : 0);

/** Delivery fee for an order. A function so region/amount rules can be added later. */
export const getDeliveryFee = (/* subtotal, address */) => DELIVERY_FEE;


/** Order fulfilment status (separate from payment status). */
export const ORDER_STATUS = {
  placed: 'Order placed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Allowed admin transitions between fulfilment statuses. */
export const ORDER_TRANSITIONS = {
  placed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};
