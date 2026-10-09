// npm run db:setup — create/upgrade tables and seed categories, products (CP) and sample referral codes.
// Safe to re-run: by default it only ADDS missing rows, so edits made in the admin dashboard are kept.
// Price-list updates (overwrite names/prices from js/data/catalog.js): use tools/import-pricelist.mjs --db,
// which sets DB_SETUP_UPDATE_PRODUCTS=1.
// Target: DATABASE_URL (Neon) from the environment or .env.local; otherwise local PGlite (.data/pglite).
import './env.mjs';
import { readFileSync } from 'node:fs';
import { exec, tx, dbKind } from '../lib/db.js';
import { catalog } from '../js/data/catalog.js';
import { categories, FEATURED_ORDER } from '../js/data/products.js';

const SAMPLE_REFERRALS = [
  ['DXN-JS001', 'Sample Referrer A'],
  ['DXN-JS002', 'Sample Referrer B'],
  ['DXNPH2026', 'DXN Bundle Store'],
];

const UPDATE = process.env.DB_SETUP_UPDATE_PRODUCTS === '1';
console.log(`Database: ${await dbKind()}${UPDATE ? ' (updating products from the price list)' : ''}`);
await exec(readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
console.log('✓ schema applied');

await tx(async (q) => {
  for (const [i, c] of categories.entries()) {
    await q(`INSERT INTO categories (id, name, image, sort) VALUES ($1,$2,$3,$4)
             ON CONFLICT (id) DO NOTHING`,
      [c.id, c.name, c.image || null, i]);
  }
  for (const [i, p] of catalog.entries()) {
    const rank = FEATURED_ORDER.indexOf(p.code);
    await q(`INSERT INTO products (id, code, name, size, category_id, price, image, featured_rank, sort, active, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now())
             ON CONFLICT (id) DO ${UPDATE ? `UPDATE SET name = EXCLUDED.name, size = EXCLUDED.size,
               category_id = EXCLUDED.category_id, price = EXCLUDED.price, updated_at = now()` : 'NOTHING'}`,
      [p.id, p.code, p.name, p.size, p.category, p.price, p.image, rank >= 0 ? rank : null, i]);
  }
  for (const [code, name] of SAMPLE_REFERRALS) {
    await q('INSERT INTO referral_codes (code, referrer_name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING', [code, name]);
  }
});
console.log(`✓ ${UPDATE ? 'updated' : 'checked'} ${categories.length} categories, ${catalog.length} products${UPDATE ? ' (names/prices from the price list)' : ' (missing ones added; existing kept)'}, ${SAMPLE_REFERRALS.length} sample referral codes`);
process.exit(0);
