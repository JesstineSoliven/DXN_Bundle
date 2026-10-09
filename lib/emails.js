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
  `Total: ${peso(o.totals.grandTotal)}`,
].join('\n');

const adminLink = (base, o) => `${base}/#/order/${o.id}?demo=1`;

export const emailAdminNewOrder = (o, base) => sendEmail({
  kind: 'new_order', orderId: o.id, to: adminEmail(), replyTo: o.customer.email,
  subject: `New order ${o.id} — ${peso(o.totals.grandTotal)} (${o.payment.label})`,
  text: `${o.payment.method === 'gcash' ? 'Waiting for the customer’s GCash payment.\n\n' : 'Cash on Delivery — collect payment when delivered.\n\n'}${summary(o)}\n\nManage this order: ${adminLink(base, o)}`,
});

export const emailAdminPaymentSubmitted = (o, gcash, base) => sendEmail({
  kind: 'payment_submitted', orderId: o.id, to: adminEmail(), replyTo: o.customer.email,
  subject: `GCash payment submitted — ${o.id} — ${peso(o.totals.grandTotal)} — Ref ${o.payment.proof.reference}`,
  text: [
    'Please verify this GCash payment in the GCash app, then mark the order Confirmed or Failed:',
    adminLink(base, o),
    '',
    `Reference no.: ${o.payment.proof.reference}`,
    `Sender: ${o.payment.proof.senderName} · ${o.payment.proof.senderMobile}`,
    `Amount due: ${peso(o.payment.amountDue)}`,
    `Paid to: ${gcash.accountName} · ${gcash.number}`,
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
      : `Hi ${o.customer.name},\n\nWe couldn't verify GCash reference ${o.payment.proof?.reference || ''} for order ${o.id}.${o.payment.note ? ` ${o.payment.note}` : ''}\nPlease check the reference number and submit it again from your order page.\n\nDXN Bundle Store`,
  });
};
