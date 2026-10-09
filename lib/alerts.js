// Operational alerts: every problem is written to error_log; the admin gets an email at most once per hour
// per kind of problem (fingerprint). Never throws — reporting must not break the request that hit the error.
import { createHash } from 'node:crypto';
import { query } from './db.js';

const fp = (source, message) => createHash('sha256').update(`${source}|${String(message).replace(/\d+/g, '#').slice(0, 200)}`).digest('hex').slice(0, 24);

/**
 * @param {string} source  api | mail | paymongo | webhook | sync | …
 * @param {Error|string} err
 * @param {object} detail  extra context (no secrets, no card data)
 */
export async function reportError(source, err, detail = {}) {
  const message = String(err?.message || err || 'Unknown error').slice(0, 500);
  const fingerprint = fp(source, message);
  try {
    const recent = await query(
      `SELECT 1 FROM error_log WHERE fingerprint = $1 AND emailed AND created_at > now() - interval '1 hour' LIMIT 1`, [fingerprint]);
    const shouldEmail = !recent.length && process.env.ALERTS !== 'off';
    const safeDetail = JSON.parse(JSON.stringify({ ...detail, stack: err?.stack?.split('\n').slice(0, 6).join('\n') }));
    await query('INSERT INTO error_log (source, message, detail, fingerprint, emailed) VALUES ($1, $2, $3::jsonb, $4, $5)',
      [source, message, JSON.stringify(safeDetail), fingerprint, shouldEmail]);
    if (shouldEmail) {
      const { sendEmail, adminEmail } = await import('./mailer.js'); // lazy: avoids a cycle (mailer reports its own failures)
      await sendEmail({
        kind: 'alert', to: adminEmail(), noAlert: true,
        subject: `⚠ DXN Bundle Store: ${source} problem — ${message.slice(0, 80)}`,
        text: [
          `Something needs attention on the store (${source}).`, '', `Problem: ${message}`,
          ...Object.entries(detail).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => `${k}: ${v}`),
          '', 'Similar problems are grouped: you get at most one email per hour for this issue.',
          'See all recent problems in Admin → System.',
        ].join('\n'),
      });
    }
  } catch (e) {
    console.error('[alerts] could not record error:', e?.message, '| original:', message);
  }
}
