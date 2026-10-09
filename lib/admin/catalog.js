// Admin: products, categories, referral codes. All inputs validated here (the API is the trust boundary).
import { query, tx } from '../db.js';
import { HttpError } from '../http.js';
import { normalizeCode, referralFormatError } from '../../js/shared/rules.js';

const str = (v, max, field, { required = true } = {}) => {
  const s = String(v ?? '').trim();
  if (required && !s) throw new HttpError(422, `${field} is required.`, { fields: { [field]: `${field} is required.` } });
  if (s.length > max) throw new HttpError(422, `${field} is too long (max ${max}).`, { fields: { [field]: 'Too long.' } });
  return s;
};
const int = (v, field, { min = 0, max = 10_000_000, nullable = false } = {}) => {
  if (nullable && (v === null || v === '' || v === undefined)) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(422, `${field} must be a whole number between ${min} and ${max}.`, { fields: { [field]: 'Invalid number.' } });
  return n;
};
const imageUrl = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.length > 500 || !/^(https:\/\/|assets\/img\/)[^\s"'<>]+$/.test(s)) {
    throw new HttpError(422, 'Image must be an https:// URL or an assets/img/ path.', { fields: { image: 'Invalid image URL.' } });
  }
  return s;
};
const slug = (v) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export async function listProducts() {
  return query(`
    SELECT p.id, p.code, p.name, p.size, p.category_id AS category, p.price, p.image, p.featured_rank AS "featuredRank",
           p.active, p.sort, p.updated_at AS "updatedAt",
           COALESCE(s.qty, 0)::int AS "unitsSold", COALESCE(s.sales, 0)::int AS sales
    FROM products p
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.qty) AS qty, SUM(oi.line_total) AS sales
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'cancelled' GROUP BY oi.product_id
    ) s ON s.product_id = p.id
    ORDER BY p.active DESC, p.sort, p.code`);
}

async function categoryExists(q, id) {
  return (await q('SELECT 1 FROM categories WHERE id = $1', [id])).length > 0;
}

export async function createProduct(b) {
  const code = str(b.code, 20, 'code').toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) throw new HttpError(422, 'Code uses letters, numbers and dashes.', { fields: { code: 'Invalid code.' } });
  const p = {
    id: code.toLowerCase(), code,
    name: str(b.name, 160, 'name'), size: str(b.size, 80, 'size', { required: false }),
    category: str(b.category, 40, 'category'), price: int(b.price, 'price', { min: 1, max: 1_000_000 }),
    image: imageUrl(b.image), featuredRank: int(b.featuredRank, 'featuredRank', { min: 0, max: 99, nullable: true }),
  };
  return tx(async (q) => {
    if (!(await categoryExists(q, p.category))) throw new HttpError(422, 'Unknown category.', { fields: { category: 'Unknown category.' } });
    if ((await q('SELECT 1 FROM products WHERE id = $1 OR code = $2', [p.id, p.code])).length) {
      throw new HttpError(409, `Product code ${p.code} already exists.`, { fields: { code: 'Already exists.' } });
    }
    const [{ next }] = await q('SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM products');
    await q(`INSERT INTO products (id, code, name, size, category_id, price, image, featured_rank, sort, active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`, [p.id, p.code, p.name, p.size, p.category, p.price, p.image, p.featuredRank, next]);
    return (await q('SELECT * FROM products WHERE id = $1', [p.id]))[0];
  });
}

/** Partial update. Archive/restore via { active }. Code is immutable (orders reference it). */
export async function updateProduct(id, b) {
  const sets = [], vals = [id];
  const set = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if ('name' in b) set('name', str(b.name, 160, 'name'));
  if ('size' in b) set('size', str(b.size, 80, 'size', { required: false }));
  if ('price' in b) set('price', int(b.price, 'price', { min: 1, max: 1_000_000 }));
  if ('image' in b) set('image', imageUrl(b.image));
  if ('featuredRank' in b) set('featured_rank', int(b.featuredRank, 'featuredRank', { min: 0, max: 99, nullable: true }));
  if ('active' in b) set('active', Boolean(b.active));
  if ('category' in b) {
    const c = str(b.category, 40, 'category');
    if (!(await query('SELECT 1 FROM categories WHERE id = $1', [c])).length) throw new HttpError(422, 'Unknown category.', { fields: { category: 'Unknown category.' } });
    set('category_id', c);
  }
  if (!sets.length) throw new HttpError(400, 'Nothing to update.');
  const rows = await query(`UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, vals);
  if (!rows.length) throw new HttpError(404, 'Product not found.');
  return rows[0];
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function listCategories() {
  return query(`
    SELECT c.id, c.name, c.image, c.sort,
           COUNT(p.id) FILTER (WHERE p.active)::int AS "activeProducts", COUNT(p.id)::int AS "totalProducts"
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY c.sort, c.name`);
}

export async function createCategory(b) {
  const name = str(b.name, 60, 'name');
  const id = slug(b.id || name);
  if (!id) throw new HttpError(422, 'Invalid category name.', { fields: { name: 'Invalid name.' } });
  return tx(async (q) => {
    if (await categoryExists(q, id)) throw new HttpError(409, 'A category with that name already exists.', { fields: { name: 'Already exists.' } });
    const [{ next }] = await q('SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM categories');
    await q('INSERT INTO categories (id, name, image, sort) VALUES ($1, $2, $3, $4)', [id, name, imageUrl(b.image), next]);
    return (await q('SELECT * FROM categories WHERE id = $1', [id]))[0];
  });
}

export async function updateCategory(id, b) {
  const sets = [], vals = [id];
  const set = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if ('name' in b) set('name', str(b.name, 60, 'name'));
  if ('image' in b) set('image', imageUrl(b.image));
  if ('sort' in b) set('sort', int(b.sort, 'sort', { min: 0, max: 999 }));
  if (!sets.length) throw new HttpError(400, 'Nothing to update.');
  const rows = await query(`UPDATE categories SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals);
  if (!rows.length) throw new HttpError(404, 'Category not found.');
  return rows[0];
}

export async function deleteCategory(id) {
  return tx(async (q) => {
    const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM products WHERE category_id = $1', [id]);
    if (n) throw new HttpError(409, `This category still has ${n} product${n === 1 ? '' : 's'}. Move or archive them first.`);
    const rows = await q('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) throw new HttpError(404, 'Category not found.');
    return { deleted: id };
  });
}

// ---------------------------------------------------------------------------
// Referral codes
// ---------------------------------------------------------------------------
export async function listReferrals() {
  return query(`
    SELECT r.code, r.referrer_name AS "referrerName", r.active, r.created_at AS "createdAt",
           COUNT(o.id)::int AS orders,
           COUNT(o.id) FILTER (WHERE o.payment_status = 'confirmed' AND o.status <> 'cancelled')::int AS "paidOrders",
           COALESCE(SUM(o.grand_total) FILTER (WHERE o.payment_status = 'confirmed' AND o.status <> 'cancelled'), 0)::int AS sales
    FROM referral_codes r LEFT JOIN orders o ON o.referral_code = r.code
    GROUP BY r.code ORDER BY r.created_at, r.code`);
}

export async function createReferral(b) {
  const code = normalizeCode(b.code);
  const fmt = referralFormatError(code);
  if (fmt) throw new HttpError(422, fmt, { fields: { code: fmt } });
  const name = str(b.referrerName, 120, 'referrerName');
  const rows = await query(`INSERT INTO referral_codes (code, referrer_name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING RETURNING *`, [code, name]);
  if (!rows.length) throw new HttpError(409, `Referral code ${code} already exists.`, { fields: { code: 'Already exists.' } });
  return rows[0];
}

export async function updateReferral(code, b) {
  const sets = [], vals = [normalizeCode(code)];
  const set = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if ('referrerName' in b) set('referrer_name', str(b.referrerName, 120, 'referrerName'));
  if ('active' in b) set('active', Boolean(b.active));
  if (!sets.length) throw new HttpError(400, 'Nothing to update.');
  const rows = await query(`UPDATE referral_codes SET ${sets.join(', ')} WHERE code = $1 RETURNING *`, vals);
  if (!rows.length) throw new HttpError(404, 'Referral code not found.');
  return rows[0];
}
