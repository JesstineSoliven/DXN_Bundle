// Side effects when a GCash payment is confirmed (shared by the webhook and sync-on-return).
import { emailAdminPaymentReceived, emailCustomerPaymentStatus } from './emails.js';

export async function onGcashPaid(order, baseUrl) {
  await emailAdminPaymentReceived(order, baseUrl); // best-effort; never throws
  await emailCustomerPaymentStatus(order);
}
