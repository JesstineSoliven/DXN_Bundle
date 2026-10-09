// Dashboard: KPIs, daily revenue chart (single series, hover tooltip + table view), status mix, top lists.
import { admin } from '../api.js';
import { icon, esc, peso, compact, orderChip, ORDER_STATUS, pageHead } from '../ui.js';

const PERIODS = [7, 30, 90];

const tile = (label, value, sub = '', hero = false) => `
  <div class="kpi ${hero ? 'kpi-hero col-span-2' : ''}">
    <p class="kpi-label">${label}</p>
    <p class="kpi-value">${value}</p>
    ${sub ? `<p class="text-[12.5px] text-ink-mute mt-1">${sub}</p>` : ''}
  </div>`;

/** Daily revenue columns. ≤24px bars, 4px rounded tops square at the baseline, 2px surface gap, hairline grid. */
function revenueChart(daily) {
  const W = 760, H = 240, padL = 56, padR = 8, padT = 12, padB = 26;
  const max = Math.max(...daily.map((d) => d.revenue), 0);
  const niceStep = (m) => { const raw = m / 4 || 1; const p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw); };
  const step = niceStep(max), top = Math.max(step * 4, step);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / daily.length, bw = Math.min(24, Math.max(2, slot - 2));
  const y = (v) => padT + plotH - (v / top) * plotH;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step).filter((v) => v <= top);
  const labelEvery = Math.ceil(daily.length / 8);
  const r = Math.min(4, bw / 2);
  const bar = (x, v) => {
    const h = Math.max(0, (v / top) * plotH);
    if (!h) return '';
    const rr = Math.min(r, h);
    const yt = padT + plotH - h, yb = padT + plotH;
    return `<path class="bar" d="M${x},${yb} V${yt + rr} Q${x},${yt} ${x + rr},${yt} H${x + bw - rr} Q${x + bw},${yt} ${x + bw},${yt + rr} V${yb} Z"/>`;
  };
  return `
  <div class="chart" data-chart>
    <div class="overflow-x-auto -mx-1 px-1"><svg class="min-w-[560px]" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily paid revenue, last ${daily.length} days">
      <g class="grid">${ticks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
      <g class="axis">
        ${ticks.map((v) => `<text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${v ? '₱' + compact(v) : '₱0'}</text>`).join('')}
        ${daily.map((d, i) => ((i % labelEvery === 0 && daily.length - 1 - i >= labelEvery / 2) || i === daily.length - 1)
          ? `<text x="${padL + i * slot + slot / 2}" y="${H - 6}" text-anchor="middle">${new Date(d.day + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</text>` : '').join('')}
      </g>
      ${daily.map((d, i) => {
        const x = padL + i * slot + (slot - bw) / 2;
        return `<g><rect class="hit" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" data-i="${i}"/>${bar(x, d.revenue)}</g>`;
      }).join('')}
    </svg></div>
    <div class="chart-tip" data-tip></div>
  </div>`;
}

const chartTable = (daily) => `
  <div class="adm-table-wrap mt-3 max-h-[280px] overflow-y-auto">
    <table class="adm-table"><thead><tr><th>Day</th><th class="num">Orders</th><th class="num">Paid revenue</th></tr></thead>
      <tbody>${[...daily].reverse().map((d) => `<tr><td>${d.day}</td><td class="num">${d.orders}</td><td class="num">${peso(d.revenue)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;

const list = (title, rows, empty) => `
  <section class="card p-5">
    <h2 class="font-bold text-[15px] mb-3">${title}</h2>
    ${rows.length ? `<ol class="flex flex-col divide-y divide-line">${rows.join('')}</ol>` : `<p class="text-[13.5px] text-ink-mute">${empty}</p>`}
  </section>`;

export default {
  title: 'Dashboard',
  load: (params) => admin.get(`summary?days=${PERIODS.includes(+params.get('days')) ? params.get('days') : 30}`),
  render(s) {
    const k = s.kpis;
    const statusCount = Object.fromEntries(s.byStatus.map((r) => [r.status, r.n]));
    return `
    ${pageHead('Dashboard', `Paid revenue counts GCash payments confirmed and COD cash collected, excluding cancelled orders.`,
      `<div class="flex gap-1.5" role="group" aria-label="Period">${PERIODS.map((d) => `<a href="#/dashboard?days=${d}" class="chip ${d === s.days ? 'is-active' : ''} inline-flex items-center">${d} days</a>`).join('')}</div>`)}

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${tile(`Paid revenue · ${s.days} days`, peso(k.revenuePeriod), `${k.paidOrdersPeriod} paid order${k.paidOrdersPeriod === 1 ? '' : 's'} · avg ${peso(k.avgOrderValue)}`, true)}
      ${tile('Orders today', k.ordersToday.toLocaleString('en-PH'), `${peso(k.revenueToday)} paid`)}
      ${tile('Orders · 7 days', k.orders7d.toLocaleString('en-PH'), `${peso(k.revenue7d)} paid`)}
      ${tile('To fulfil', k.toFulfil, '<a class="underline hover:text-ink" href="#/orders?status=placed">Placed</a> or processing')}
      ${tile('Awaiting payment', k.unpaidOrders, `${peso(k.unpaidAmount)} unpaid (incl. COD)`)}
      ${tile(`Orders · ${s.days} days`, k.ordersPeriod.toLocaleString('en-PH'))}
    </div>

    <section class="card p-5 mt-4">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div><h2 class="font-bold text-[15px]">Paid revenue per day</h2><p class="text-[12.5px] text-ink-mute">Last ${s.days} days · hover a day for details</p></div>
        <button type="button" class="btn btn-ghost btn-sm whitespace-nowrap shrink-0" data-toggle-table aria-expanded="false">View as table</button>
      </div>
      ${revenueChart(s.daily)}
      <div data-table hidden>${chartTable(s.daily)}</div>
    </section>

    <div class="grid lg:grid-cols-3 gap-4 mt-4">
      ${list('Orders by status', Object.keys(ORDER_STATUS).map((st) => `
        <li class="flex items-center justify-between py-2.5"><a href="#/orders?status=${st}" class="hover:underline">${orderChip(st)}</a><span class="font-bold tabular-nums">${statusCount[st] || 0}</span></li>`), '')}
      ${list(`Top products · ${s.days} days`, s.topProducts.map((p) => `
        <li class="flex items-center justify-between gap-3 py-2.5 text-[13.5px]"><span class="min-w-0"><span class="block truncate font-semibold">${esc(p.name)}</span><span class="text-ink-mute text-[12px]">${esc(p.code)} · ${p.units} sold</span></span><span class="font-bold tabular-nums">${peso(p.sales)}</span></li>`), 'No paid orders yet.')}
      ${list(`Top referrers · ${s.days} days`, s.topReferrers.map((r) => `
        <li class="flex items-center justify-between gap-3 py-2.5 text-[13.5px]"><span class="min-w-0"><span class="block truncate font-semibold">${esc(r.referrerName)}</span><span class="text-ink-mute text-[12px]">${esc(r.code)} · ${r.orders} order${r.orders === 1 ? '' : 's'}</span></span><span class="font-bold tabular-nums">${peso(r.sales)}</span></li>`), 'No paid orders yet.')}
    </div>`;
  },
  mount(root, _params, s) {
    const chart = root.querySelector('[data-chart]'), tip = root.querySelector('[data-tip]');
    const bars = chart.querySelectorAll('.hit');
    const show = (e) => {
      const i = +e.target.dataset.i, d = s.daily[i];
      tip.innerHTML = `<strong>${new Date(d.day + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</strong><br>${peso(d.revenue)} paid · ${d.orders} order${d.orders === 1 ? '' : 's'}`;
      const box = chart.getBoundingClientRect(), r = e.target.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(r.left - box.left + r.width / 2, 70), box.width - 70)}px`;
      tip.style.top = `${r.top - box.top + 20}px`;
      tip.classList.add('is-visible');
      e.target.nextElementSibling?.classList.add('is-hover');
    };
    const hide = (e) => { tip.classList.remove('is-visible'); e.target.nextElementSibling?.classList.remove('is-hover'); };
    bars.forEach((b) => { b.addEventListener('mouseenter', show); b.addEventListener('mouseleave', hide); });
    const btn = root.querySelector('[data-toggle-table]'), table = root.querySelector('[data-table]');
    btn.addEventListener('click', () => {
      table.hidden = !table.hidden;
      btn.setAttribute('aria-expanded', String(!table.hidden));
      btn.textContent = table.hidden ? 'View as table' : 'Hide table';
    });
    return null;
  },
};
