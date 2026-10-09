// npm run db:setup — create/upgrade tables and seed categories, products (CP) and sample referral codes.
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

console.log(`Database: ${await dbKind()}`);
await exec(readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
console.log('✓ schema applied');

await tx(async (q) => {
  for (const [i, c] of categories.entries()) {
    await q(`INSERT INTO categories (id, name, image, sort) VALUES ($1,$2,$3,$4)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, image = EXCLUDED.image, sort = EXCLUDED.sort`,
      [c.id, c.name, c.image || null, i]);
  }
  for (const [i, p] of catalog.entries()) {
    const rank = FEATURED_ORDER.indexOf(p.code);
    await q(`INSERT INTO products (id, code, name, size, category_id, price, image, featured_rank, sort, active, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now())
             ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, size = EXCLUDED.size,
               category_id = EXCLUDED.category_id, price = EXCLUDED.price, image = EXCLUDED.image,
               featured_rank = EXCLUDED.featured_rank, sort = EXCLUDED.sort, updated_at = now()`,
      [p.id, p.code, p.name, p.size, p.category, p.price, p.image, rank >= 0 ? rank : null, i]);
  }
  for (const [code, name] of SAMPLE_REFERRALS) {
    await q('INSERT INTO referral_codes (code, referrer_name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING', [code, name]);
  }
});
console.log(`✓ seeded ${categories.length} categories, ${catalog.length} products, ${SAMPLE_REFERRALS.length} sample referral codes`);
process.exit(0);
