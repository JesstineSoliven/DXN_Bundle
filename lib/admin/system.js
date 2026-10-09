// System health for the owner's System page. Reports which settings exist — never their values.
import { query, dbKind } from '../db.js';
import { adminEmail } from '../mailer.js';

export async function systemStatus() {
  let database = false, databaseKind = '';
  try { await query('SELECT 1'); database = true; databaseKind = await dbKind(); } catch { /* reported as not reachable */ }
  const key = process.env.PAYMONGO_SECRET_KEY || '';
  const config = {
    database, databaseKind,
    email: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    emailFrom: process.env.GMAIL_USER || '',
    adminEmail: adminEmail(),
    paymongo: Boolean(key),
    paymongoMode: key.startsWith('sk_live_') ? 'live' : key ? 'test' : '',
    webhook: Boolean(process.env.PAYMONGO_WEBHOOK_SECRET),
    siteUrl: process.env.SITE_URL || '',
    adminKey: Boolean(process.env.ADMIN_API_KEY),
  };
  if (!database) return { config, errors: [], emails: [], emailCounts: {} };
  const errors = await query(`SELECT source, message, detail, created_at AS at FROM error_log ORDER BY id DESC LIMIT 50`);
  const emails = await query(`SELECT kind, to_address AS "to", subject, status, error, created_at AS at FROM email_log ORDER BY id DESC LIMIT 30`);
  const counts = await query(`SELECT status, COUNT(*)::int AS n FROM email_log WHERE created_at > now() - interval '7 days' GROUP BY status`);
  return { config, errors, emails, emailCounts: Object.fromEntries(counts.map((r) => [r.status, r.n])) };
}
