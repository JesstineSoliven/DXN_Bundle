// Admin: order list, customers, sales summary.
// "Revenue" = paid orders (GCash confirmed or COD cash collected) that are not cancelled.
import { query } from '../db.js';
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } from '../../js/shared/constants.js';

const PAID = `o.payment_status = 'confirmed' AND o.status <> 'cancelled'`;

/** Filters: status, payment (payment_status), method, q (order id / name / mobile / email / referral), customer, limit, offset */
export async function listOrders(f = {}) {
  const where = [], vals = [];
  const add = (sql, v) => { vals.push(v); where.push(sql.replace('?', `$${vals.length}`)); };
  if (f.status && ORDER_STATUS[f.status]) add('o.status = ?', f.status);
  if (f.payment && PAYMENT_STATUS[f.payment]) add('o.payment_status = ?', f.payment);
  if (f.method && PAYMENT_METHODS[f.method]) add('o.payment_method = ?', f.method);
  if (f.customer && /^\d+$/.test(f.customer)) add('o.customer_id = ?', Number(f.customer));
  if (f.q) {
    vals.push(`%${String(f.q).trim().toLowerCase().slice(0, 80)}%`);
    const p = `$${vals.length}`;
    where.push(`(lower(o.id) LIKE ${p} OR lower(o.customer_name) LIKE ${p} OR lower(o.customer_email) LIKE ${p}
                 OR replace(o.customer_mobile, ' ', '') LIKE replace(${p}, ' ', '') OR lower(o.referral_code) LIKE ${p})`);
  }
  const limit = Math.min(Math.max(Number(f.limit) || 50, 1), 200);
  const offset = Math.max(Number(f.offset) || 0, 0);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(`
    SELECT o.id, o.created_at AS "createdAt", o.type, o.status, o.customer_name AS "customerName", o.customer_mobile AS "customerMobile",
           o.referral_code AS "referralCode", o.grand_total AS "grandTotal", o.payment_method AS "paymentMethod",
           o.payment_status AS "paymentStatus", (SELECT COALESCE(SUM(qty), 0)::int FROM order_items i WHERE i.order_id = o.id) AS items
    FROM orders o ${w} ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit} OFFSET ${offset}`, vals);
  const [{ total }] = await query(`SELECT COUNT(*)::int AS total FROM orders o ${w}`, vals);
  return { orders: rows, total, limit, offset };
}

export async function listCustomers(f = {}) {
  const vals = [];
  let w = '';
  if (f.q) {
    vals.push(`%${String(f.q).trim().toLowerCase().slice(0, 80)}%`);
    w = `WHERE lower(c.name) LIKE $1 OR lower(c.email) LIKE $1 OR replace(c.mobile, ' ', '') LIKE replace($1, ' ', '')`;
  }
  return query(`
    SELECT c.id, c.name, c.mobile, c.email, c.created_at AS "createdAt",
           COUNT(o.id)::int AS orders,
           COALESCE(SUM(o.grand_total) FILTER (WHERE ${PAID}), 0)::int AS spent,
           MAX(o.created_at) AS "lastOrderAt"
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    ${w}
    GROUP BY c.id ORDER BY MAX(o.created_at) DESC NULLS LAST LIMIT 500`, vals);
}

/** Dashboard numbers. Days are Philippine time. */
export async function summary({ days = 30 } = {}) {
  const d = Math.min(Math.max(Number(days) || 30, 7), 365);
  const tz = `AT TIME ZONE 'Asia/Manila'`;
  const [k] = await query(`
    SELECT
      COUNT(*) FILTER (WHERE (o.created_at ${tz})::date = (now() ${tz})::date)::int AS "ordersToday",
      COUNT(*) FILTER (WHERE o.created_at >= now() - interval '7 days')::int AS "orders7d",
      COUNT(*) FILTER (WHERE o.created_at >= now() - ($1 || ' days')::interval)::int AS "ordersPeriod",
      COALESCE(SUM(o.grand_total) FILTER (WHERE ${PAID} AND (o.created_at ${tz})::date = (now() ${tz})::date), 0)::int AS "revenueToday",
      COALESCE(SUM(o.grand_total) FILTER (WHERE ${PAID} AND o.created_at >= now() - interval '7 days'), 0)::int AS "revenue7d",
      COALESCE(SUM(o.grand_total) FILTER (WHERE ${PAID} AND o.created_at >= now() - ($1 || ' days')::interval), 0)::int AS "revenuePeriod",
      COUNT(*) FILTER (WHERE ${PAID} AND o.created_at >= now() - ($1 || ' days')::interval)::int AS "paidOrdersPeriod",
      COUNT(*) FILTER (WHERE o.status <> 'cancelled' AND o.payment_status IN ('pending', 'submitted', 'cod_pending'))::int AS "unpaidOrders",
      COALESCE(SUM(o.grand_total) FILTER (WHERE o.status <> 'cancelled' AND o.payment_status IN ('pending', 'submitted', 'cod_pending')), 0)::int AS "unpaidAmount",
      COUNT(*) FILTER (WHERE o.status IN ('placed', 'processing'))::int AS "toFulfil"
    FROM orders o`, [String(d)]);

  const daily = await query(`
    WITH days AS (
      SELECT generate_series((now() ${tz})::date - ($1::int - 1), (now() ${tz})::date, interval '1 day')::date AS day
    )
    SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
           COUNT(o.id)::int AS orders,
           COALESCE(SUM(o.grand_total) FILTER (WHERE ${PAID}), 0)::int AS revenue
    FROM days LEFT JOIN orders o ON (o.created_at ${tz})::date = days.day
    GROUP BY days.day ORDER BY days.day`, [d]);

  const byStatus = await query(`SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status`);
  const byPayment = await query(`SELECT payment_method AS method, payment_status AS status, COUNT(*)::int AS n FROM orders GROUP BY 1, 2`);
  const topProducts = await query(`
    SELECT oi.code, MAX(oi.name) AS name, SUM(oi.qty)::int AS units, SUM(oi.line_total)::int AS sales
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE ${PAID} AND o.created_at >= now() - ($1 || ' days')::interval
    GROUP BY oi.code ORDER BY sales DESC LIMIT 5`, [String(d)]);
  const topReferrers = await query(`
    SELECT o.referral_code AS code, MAX(r.referrer_name) AS "referrerName", COUNT(*)::int AS orders, SUM(o.grand_total)::int AS sales
    FROM orders o JOIN referral_codes r ON r.code = o.referral_code
    WHERE ${PAID} AND o.created_at >= now() - ($1 || ' days')::interval
    GROUP BY o.referral_code ORDER BY sales DESC LIMIT 5`, [String(d)]);

  return {
    days: d,
    kpis: { ...k, avgOrderValue: k.paidOrdersPeriod ? Math.round(k.revenuePeriod / k.paidOrdersPeriod) : 0 },
    daily, byStatus, byPayment, topProducts, topReferrers,
  };
}
