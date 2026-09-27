// Notifications. Until the Phase 5 backend exists, emails are queued in a local outbox
// (localStorage "dxn.outbox") so the flow can be tested; the backend will send them for real.
import { config } from '../config.js';
import { formatPeso } from '../data/products.js';

function queue(email) {
  const entry = { ...email, queuedAt: new Date().toISOString(), status: 'queued' };
  try {
    const box = JSON.parse(localStorage.getItem('dxn.outbox') || '[]');
    box.push(entry);
    localStorage.setItem('dxn.outbox', JSON.stringify(box));
  } catch { /* storage unavailable */ }
  console.info('[notify] email queued:', entry.to, '—', entry.subject);
  return entry;
}

const orderLines = (order) => [
  `Order: ${order.id}`,
  `Placed: ${new Date(order.createdAt).toLocaleString('en-PH')}`,
  `Customer: ${order.customer.name} · ${order.customer.mobile} · ${order.customer.email}`,
  `Address: ${order.customer.addressText}`,
  `Referral: ${order.referral.code} (${order.referral.referrer})`,
  `Payment: ${order.payment.label} — ${order.payment.statusLabel}`,
  '',
  ...order.items.map((i) => `${i.qty} × ${i.name}${i.size ? ` (${i.size})` : ''} — ${formatPeso(i.lineTotal)}`),
  '',
  `Subtotal: ${formatPeso(order.totals.subtotal)}`,
  `Delivery: ${order.totals.deliveryFee ? formatPeso(order.totals.deliveryFee) : 'FREE'}`,
  `Total: ${formatPeso(order.totals.grandTotal)}`,
];

/** Admin: a new order was placed (COD or GCash). */
export function notifyAdminNewOrder(order) {
  return queue({
    to: config.adminEmail,
    subject: `New order ${order.id} — ${formatPeso(order.totals.grandTotal)} (${order.payment.label})`,
    body: orderLines(order).join('\n'),
  });
}

/** Admin: customer submitted a GCash reference — verify it in the GCash app, then confirm or fail. */
export function notifyAdminPaymentSubmitted(order) {
  const p = order.payment.proof;
  return queue({
    to: config.adminEmail,
    subject: `GCash payment submitted — ${order.id} — ${formatPeso(order.totals.grandTotal)} — Ref ${p.reference}`,
    body: [
      `Please verify this GCash payment in the GCash app, then mark the order Confirmed or Failed.`,
      '',
      `Reference no.: ${p.reference}`,
      `Sender: ${p.senderName} · ${p.senderMobile}`,
      `Amount due: ${formatPeso(order.payment.amountDue)}`,
      `Paid to: ${config.gcash.accountName} · ${config.gcash.number}`,
      '',
      ...orderLines(order),
    ].join('\n'),
  });
}

/** Customer: payment confirmed / failed. */
export function notifyPaymentStatus(order) {
  const ok = order.payment.status === 'confirmed';
  return queue({
    to: order.customer.email,
    subject: ok ? `Payment confirmed — order ${order.id}` : `Payment not verified — order ${order.id}`,
    body: ok
      ? `Hi ${order.customer.name}, we received your GCash payment of ${formatPeso(order.payment.amountDue)}. We’re preparing your order.`
      : `Hi ${order.customer.name}, we couldn’t verify GCash reference ${order.payment.proof?.reference}. ${order.payment.note || ''} Please check the reference number and resubmit on your order page.`,
  });
}
