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

const adminLink = (base, o) => `${base}/admin#/orders/${o.id}`;

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

/** Customer: fulfilment updates worth an email (shipped, cancelled). */
export const emailCustomerOrderStatus = (o) => {
  if (!['shipped', 'cancelled'].includes(o.status)) return null;
  const note = o.statusHistory.at(-1)?.note;
  const shipped = o.status === 'shipped';
  return sendEmail({
    kind: `order_${o.status}`, orderId: o.id, to: o.customer.email, replyTo: adminEmail(),
    subject: shipped ? `Your order ${o.id} is on its way` : `Order ${o.id} was cancelled`,
    text: shipped
      ? `Hi ${o.customer.name},\n\nGood news — your DXN order ${o.id} has been shipped to:\n${o.customer.addressText}\n${note ? `\n${note}\n` : ''}${o.payment.method === 'cod' && o.payment.status !== 'confirmed' ? `\nPlease prepare ${peso(o.totals.grandTotal)} in cash for the rider.\n` : ''}\nThank you!\nDXN Bundle Store`
      : `Hi ${o.customer.name},\n\nYour order ${o.id} has been cancelled.${note ? `\nReason: ${note}` : ''}\nIf you have questions, just reply to this email.\n\nDXN Bundle Store`,
  });
};

/** Admin account emails: invite (set your password) and password reset. */
export const emailAdminAccountLink = (user, token, purpose, base) => {
  const link = `${base}/admin#/set-password?token=${encodeURIComponent(token)}`;
  const invite = purpose === 'invite';
  return sendEmail({
    kind: invite ? 'admin_invite' : 'admin_reset', to: user.email, noAlert: false,
    subject: invite ? 'You’ve been added to DXN Bundle Store admin' : 'Reset your DXN Bundle Store admin password',
    text: invite
      ? `Hi ${user.name},\n\nYou now have ${user.role === 'owner' ? 'owner' : 'staff'} access to the DXN Bundle Store admin.\nSet your password here (link valid for 3 days):\n\n${link}\n\nThen sign in at ${base}/admin with ${user.email}.\n`
      : `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset the password for ${user.email}.\nChoose a new password here (link valid for 1 hour):\n\n${link}\n\nIf you didn’t ask for this, you can ignore this email — your password stays the same.\n`,
  });
};
