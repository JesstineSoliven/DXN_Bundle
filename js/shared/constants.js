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

/** Delivery fee for an order. A function so region/amount rules can be added later. */
export const getDeliveryFee = (/* subtotal, address */) => DELIVERY_FEE;

/** Store GCash account shown on the payment page and in admin emails. */
export const GCASH_ACCOUNT = {
  accountName: 'Jesstine Soliven',
  number: '09267503411',
  qrImage: 'assets/img/gcash-qr.webp',
};
