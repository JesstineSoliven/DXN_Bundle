// Store-wide settings. Change here; Phase 6 moves these into the admin dashboard.
export const config = {
  deliveryFee: 0,                        // ₱ — free delivery for now
  adminEmail: 'jess1008soliven@gmail.com', // receives order + payment emails (sent by the Phase 5 backend)
  currency: 'PHP',
  gcash: {
    accountName: 'Jesstine Soliven',
    number: '09267503411',
    qrImage: 'assets/img/gcash-qr.webp',
  },
};

/** Delivery fee for an order. Kept as a function so region/amount rules can be added later. */
export const getDeliveryFee = (/* subtotal, address */) => config.deliveryFee;
