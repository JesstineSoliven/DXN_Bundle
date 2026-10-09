/**
 * import-pricelist.mjs — turn the DXN price list (.xlsx) into js/data/catalog.js.
 * Usage: node tools/import-pricelist.mjs ["PRICELIST-WITH-NEW-PRODUCTS (1).xlsx"] [--db]
 *   --db  also push the new prices/products to the database (DATABASE_URL or .env.local; else local PGlite)
 *
 * Only CP (Consumer Price) is used. DP, PV and SV are distributor prices/points and are ignored.
 * Rows without a CP (e.g. registration kits) are skipped and listed in the console output.
 * Phase 5 moves this data into the database; until then re-run this script whenever prices change.
 */
import { readFileSync, writeFileSync } from 'fs';
import { inflateRawSync } from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--')) || 'PRICELIST-WITH-NEW-PRODUCTS (1).xlsx';
const OUT = ROOT + 'js/data/catalog.js';

// ---------- minimal .xlsx (zip) reader ----------
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + size);
    files[name] = method === 8 ? inflateRawSync(raw) : raw;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function readRows(file) {
  const z = unzip(readFileSync(file));
  const strings = [...(z['xl/sharedStrings.xml']?.toString('utf8') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  const sheet = z['xl/worksheets/sheet1.xml'].toString('utf8');
  return [...sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const row = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] || '')?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] || '')?.[1];
      if (v == null) continue;
      row[c[1]] = /t="s"/.test(c[2]) ? strings[+v] : decode(v);
    }
    return row;
  });
}

// ---------- mapping ----------
const SECTION_CATEGORY = {
  'APPARELS': 'apparel',
  'FOOD AND BEVERAGES': 'beverages', // split into beverages / food below
  'APPLIANCE': 'appliance',
  'HEALTH FOOD SUPPLEMENTS': 'supplements',
  'HOUSEHOLD PRODUCTS': 'household',
  'PERSONAL CARE': 'personal-care',
  'SKINCARE AND COSMETICS': 'skincare',
};
const FOOD = /candy|cake|noodle|spirudle|cereal|seasoning|jam\b|salt|jujube|zhi mint|spirunanas/i;

// Photos we have (cropped from the mockups). Everything else renders a branded placeholder tile.
const IMAGES = [
  [/lingzhi coffee 3\sin\s1/i,'assets/img/p-lingzhi-coffee.webp'],
  [/spirulina tablet/i, 'assets/img/p-spirulina.webp'],
  [/morinzhi/i, 'assets/img/p-morinzhi.webp'],
  [/^(reishi gano|ganocelium) \((rg|gl)\) \d+'s/i, 'assets/img/p-ganoderma.webp'],
  [/cocozhi/i, 'assets/img/p-cocozhi.webp'],
  [/ganozhi soap/i, 'assets/img/p-ganozhi-soap.webp'],
  [/hand & body lotion/i, 'assets/img/p-aloe-lotion.webp'],
];
// Featured on the home page, in display order (mirrors the mockup's featured row).
const FEATURED = ['FB096', 'HF127', 'FB007', 'HF001', 'FB205', 'PC036'];

const PACK = /\s(Box|Bag|Btl|Bottle|Pack|Packet|Set|Bundle|Tube|Unit|Cup|Bar)\s+(.+)$/;
function splitName(raw, code) {
  let name = raw.replace(new RegExp(`^${code}\\s+`), '').replace(/\s+/g, ' ').trim();
  let size = '';
  const m = PACK.exec(name);
  if (m) { size = m[2].trim(); name = name.slice(0, m.index).trim(); }
  else if (/\sSet$/.test(name)) { name = name.replace(/\sSet$/, ''); size = 'Set'; }
  const count = !size && /\s(\d+\s+(?:packs?|sachets?|capsules?|tablets?)\s+x\s+\S+)$/i.exec(name);
  if (count) { size = count[1]; name = name.slice(0, count.index); }
  // "Morinzhi Juice 285ml" + "285ml" → keep the size once; a trailing size with no pack word becomes the size.
  const tail = /\s(\d+(?:\.\d+)?\s?(?:ml|g|kg|liter))$/i.exec(name);
  if (tail && (!size || size.toLowerCase().includes(tail[1].toLowerCase().replace(/\s/, '')))) {
    size = size || tail[1];
    name = name.slice(0, tail.index);
  }
  name = name.replace(/(\d) in (\d)/g, '$1\u00a0in\u00a0$2'); // keep "3 in 1" on one line
  return { name, size };
}

const rows = readRows(ROOT + src);
const products = [], skipped = [], seen = new Map();
let section = null;
for (const r of rows) {
  const code = r.B?.trim(), label = r.C?.trim();
  if (!code && label && SECTION_CATEGORY[label.toUpperCase()] !== undefined) { section = label.toUpperCase(); continue; }
  if (!code && label) { section = null; continue; } // e.g. REGISTRATION KITS — not consumer products
  if (!code || code === 'CODE' || !label) continue;
  const cp = Number(r.D);
  if (!section || !Number.isFinite(cp) || cp <= 0) { skipped.push(`${code} ${label}${section ? ' (no CP)' : ''}`); continue; }

  const { name, size } = splitName(label, code);
  let category = SECTION_CATEGORY[section];
  if (category === 'beverages' && FOOD.test(name)) category = 'food';

  // Same product listed twice under different codes (e.g. kimono sizes) → keep the first.
  const dupKey = `${name}|${size}|${cp}`;
  if (seen.has(dupKey)) { skipped.push(`${code} ${label} (duplicate of ${seen.get(dupKey)})`); continue; }
  seen.set(dupKey, code);

  products.push({
    id: code.toLowerCase(),
    code,
    name,
    size,
    category,
    price: cp,
    image: IMAGES.find(([re]) => re.test(name))?.[1] || null,
    ...(FEATURED.includes(code) ? { featured: true } : {}),
  });
}

const banner = `// GENERATED by tools/import-pricelist.mjs from "${src}" — do not edit by hand.\n// Prices are CP (Consumer Price) only. Re-run the script when the price list changes.\n`;
writeFileSync(OUT, `${banner}export const catalog = ${JSON.stringify(products, null, 2)};\n`);

const byCat = products.reduce((a, p) => ((a[p.category] = (a[p.category] || 0) + 1), a), {});
console.log(`✓ ${products.length} products → js/data/catalog.js`, byCat);
console.log(`  with photos: ${products.filter((p) => p.image).length}; featured: ${products.filter((p) => p.featured).map((p) => p.code).join(', ')}`);
if (skipped.length) console.log(`  skipped ${skipped.length}:\n   - ${skipped.join('\n   - ')}`);

if (args.includes('--db')) {
  console.log('→ updating the database…');
  await import('../scripts/db-setup.mjs'); // reads the catalog.js just written
}
