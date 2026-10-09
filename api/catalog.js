// GET /api/catalog → { categories, products } (active products, price-list order)
import { query } from '../lib/db.js';
import { handler, send } from '../lib/http.js';

export default handler(['GET'], async (req, res) => {
  const categories = await query('SELECT id, name, image FROM categories ORDER BY sort');
  const rows = await query(
    `SELECT id, code, name, size, category_id, price, image, featured_rank FROM products WHERE active ORDER BY sort`);
  const products = rows.map((p) => ({
    id: p.id, code: p.code, name: p.name, size: p.size, category: p.category_id, price: p.price,
    image: p.image, ...(p.featured_rank != null ? { featured: true, featuredRank: p.featured_rank } : {}),
  }));
  send(res, 200, { categories, products }, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' });
});
