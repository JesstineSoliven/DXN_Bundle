// System (owner only): configuration health, recent problems (error_log), recent emails (email_log).
import { admin } from '../api.js';
import { esc, fmtDate, pageHead } from '../ui.js';

const check = (ok, label, detail) => `
  <li class="flex items-start gap-3 py-2.5">
    <span class="st ${ok === true ? 'st-confirmed' : ok === 'warn' ? 'st-pending' : 'st-failed'} shrink-0">${ok === true ? 'OK' : ok === 'warn' ? 'Check' : 'Missing'}</span>
    <span class="text-[13.5px]"><span class="font-semibold">${label}</span>${detail ? `<span class="block text-ink-mute text-[12.5px]">${detail}</span>` : ''}</span>
  </li>`;

export default {
  title: 'System',
  owner: true,
  load: () => admin.get('system'),
  render(s) {
    const c = s.config;
    return `
    ${pageHead('System', 'Health of the store’s connections, recent problems and emails. You also get an email for new problems (at most one per hour per issue).')}
    <div class="grid lg:grid-cols-2 gap-4">
      <section class="card p-5">
        <h2 class="font-bold text-[15px]">Configuration</h2>
        <ul class="mt-2 divide-y divide-line">
          ${check(c.database, 'Database', c.database ? `Connected (${esc(c.databaseKind)})` : 'Not reachable')}
          ${check(c.email, 'Email (Gmail)', c.email ? `Sending as ${esc(c.emailFrom)} · admin alerts to ${esc(c.adminEmail)}` : 'GMAIL_USER / GMAIL_APP_PASSWORD not set — emails are not sent')}
          ${check(c.paymongo ? (c.paymongoMode === 'live' ? true : 'warn') : false, 'GCash (PayMongo)', c.paymongo ? (c.paymongoMode === 'live' ? 'LIVE mode — real payments' : 'TEST mode — no real money moves. Switch to the live key before launch.') : 'PAYMONGO_SECRET_KEY not set — GCash checkout is off')}
          ${check(c.webhook, 'PayMongo webhook secret', c.webhook ? 'Set — payments confirm automatically' : 'Not set — payments only confirm when customers return to the site')}
          ${check(c.siteUrl ? true : 'warn', 'Site address', esc(c.siteUrl || 'SITE_URL not set (links use the request address)'))}
          ${check(c.adminKey ? 'warn' : true, 'Emergency admin key', c.adminKey ? 'ADMIN_API_KEY is still set. Now that you have accounts, remove it from Vercel for extra safety.' : 'Removed — only admin accounts can sign in')}
        </ul>
      </section>
      <section class="card p-5">
        <h2 class="font-bold text-[15px]">Emails · last 7 days</h2>
        <div class="grid grid-cols-3 gap-3 mt-3 text-center">
          ${['sent', 'failed', 'skipped'].map((k) => `<div class="rounded-xl bg-sand p-3"><p class="text-[22px] font-extrabold">${s.emailCounts[k] || 0}</p><p class="text-[12px] text-ink-mute capitalize">${k}</p></div>`).join('')}
        </div>
        <ul class="mt-4 divide-y divide-line max-h-[260px] overflow-y-auto">
          ${s.emails.map((e) => `<li class="py-2 text-[12.5px] flex items-start gap-2"><span class="st ${e.status === 'sent' ? 'st-confirmed' : e.status === 'failed' ? 'st-failed' : 'st-off'} shrink-0">${esc(e.status)}</span>
            <span class="min-w-0"><span class="block truncate font-semibold">${esc(e.subject)}</span><span class="text-ink-mute">${esc(e.to)} · ${fmtDate(e.at)}${e.error ? ` · ${esc(e.error)}` : ''}</span></span></li>`).join('') || '<li class="py-3 text-ink-mute text-[13px]">No emails yet.</li>'}
        </ul>
      </section>
    </div>
    <section class="card p-5 mt-4">
      <h2 class="font-bold text-[15px]">Recent problems</h2>
      ${s.errors.length ? `
      <div class="adm-table-wrap shadow-none border border-line mt-3">
        <table class="adm-table">
          <thead><tr><th>When</th><th>Area</th><th>Problem</th><th>Details</th></tr></thead>
          <tbody>${s.errors.map((e) => `<tr><td class="whitespace-nowrap">${fmtDate(e.at)}</td><td><span class="st st-failed">${esc(e.source)}</span></td>
            <td class="text-[13px]">${esc(e.message)}</td><td class="text-[12px] text-ink-mute">${esc(Object.entries(e.detail || {}).filter(([k, v]) => k !== 'stack' && v != null).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '))}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : '<p class="text-[13.5px] text-ink-mute mt-2">No problems recorded. 🎉</p>'}
    </section>`;
  },
};
