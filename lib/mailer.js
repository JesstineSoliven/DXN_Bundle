// Email via Gmail SMTP (app password). Best-effort: a failed send is logged, never thrown,
// so an order is never lost because email had a hiccup. Every attempt is written to email_log.
import nodemailer from 'nodemailer';
import { query } from './db.js';

let transport;
function getTransport() {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  transport ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '') },
  });
  return transport;
}

const DEFAULT_ADMIN_EMAIL = 'jess1008soliven@gmail.com';
export const adminEmail = () => process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

/** @param {{ kind: string, orderId?: string, to: string, subject: string, text: string, replyTo?: string }} mail */
export async function sendEmail({ kind, orderId = null, to, subject, text, replyTo }) {
  const t = getTransport();
  let status = 'sent', error = null;
  if (!to) { status = 'failed'; error = 'No recipient address.'; }
  else if (!t) { status = 'skipped'; error = 'SMTP not configured (GMAIL_USER / GMAIL_APP_PASSWORD).'; }
  else {
    try {
      await t.sendMail({ from: `"DXN Bundle Store" <${process.env.GMAIL_USER}>`, to, subject, text, replyTo });
    } catch (err) {
      status = 'failed';
      error = String(err?.message || err).slice(0, 500);
      console.error('[mail] send failed:', error);
    }
  }
  if (status !== 'sent') console.info(`[mail] ${status}: ${subject} → ${to}`);
  try {
    await query('INSERT INTO email_log (order_id, kind, to_address, subject, status, error) VALUES ($1,$2,$3,$4,$5,$6)', [orderId, kind, to || '', subject, status, error]);
  } catch (err) { console.error('[mail] log failed:', err?.message); }
  return status;
}
