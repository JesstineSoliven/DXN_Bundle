// Email templates (plain text). `order` is the public order shape from lib/orders.js.
import { sendEmail, adminEmail } from './mailer.js';

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH');

const summary = (o) => [
  `Order: ${o.id}`,
  `Placed: ${new Date(o.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`,
  `Customer: ${o.customer.name} · ${o.customer.mobile} · ${o.customer.email}`,
  `Address: ${o.customer.addressText}`,
  ...(o.customer.notes ? [`Notes: ${o.customer.notes}`] : []),
  `Referral: ${o.referral.code} (${o.referral.referrer})`,
  `Payment: ${o.payment.label} — ${o.payment.statusLabel}`,
  '',
  ...o.items.map((i) => `${i.qty} × ${i.name}${i.size ? ` (${i.size})` : ''}${i.code !== 'MYSTERY' ? ` [${i.code}]` : ''} — ${peso(i.lineTotal)}`),
  '',
  `Subtotal: ${peso(o.totals.subtotal)}`,
  `Delivery: ${o.totals.deliveryFee ? peso(o.totals.deliveryFee) : 'FREE'}`,
  ...(o.totals.paymentFee ? [`GCash convenience fee: ${peso(o.totals.paymentFee)}`] : []),
  `Total: ${peso(o.totals.grandTotal)}`,
].join('\n');

const adminLink = (base, o) => `${base}/#/order/${o.id}?demo=1`;

export const emailAdminNewOrder = (o, base) => sendEmail({
  kind: 'new_order', orderId: o.id, to: adminEmail(), replyTo: o.customer.email,
  subject: `New order ${o.id} — ${peso(o.totals.grandTotal)} (${o.payment.label})`,
  text: `${o.payment.method === 'gcash' ? 'Waiting for the customer’s GCash payment (you’ll get a “Payment received” email once it’s paid).\n\n' : 'Cash on Delivery — collect payment when delivered.\n\n'}${summary(o)}\n\nManage this order: ${adminLink(base, o)}`,
});

/** Admin: GCash payment received and verified by PayMongo (exact amount). */
export const emailAdminPaymentReceived = (o, base) => sendEmail({
  kind: 'payment_received', orderId: o.id, to: adminEmail(), replyTo: o.customer.email,
  subject: `Payment received — ${o.id} — ${peso(o.totals.grandTotal)} (GCash)`,
  text: [
    `GCash payment of ${peso(o.totals.grandTotal)} received via PayMongo. The order is ready to prepare.`,
    `PayMongo payment: ${o.payment.paymentId || '—'}`,
    adminLink(base, o),
    '',
    summary(o),
  ].join('\n'),
});

export const emailCustomerPaymentStatus = (o) => {
  const ok = o.payment.status === 'confirmed';
  return sendEmail({
    kind: 'payment_status', orderId: o.id, to: o.customer.email, replyTo: adminEmail(),
    subject: ok ? `Payment confirmed — order ${o.id}` : `Payment not verified — order ${o.id}`,
    text: ok
      ? `Hi ${o.customer.name},\n\nWe received your GCash payment of ${peso(o.payment.amountDue)} for order ${o.id}. We're preparing your order.\n\nThank you!\nDXN Bundle Store`
      : `Hi ${o.customer.name},\n\nThere is a problem with the GCash payment for order ${o.id}.${o.payment.note ? ` ${o.payment.note}` : ''}\nPlease reply to this email and we'll help you sort it out.\n\nDXN Bundle Store`,
  });
};
