/**
 * crop.mjs — one-off: cut imagery out of the mockups in "brand asset/" into assets/img/.
 * Usage: node tools/crop.mjs   (requires the dev server: node serve.mjs 3001)
 * Each job: src, clip [x,y,w,h] in source pixels, optional soft {r, mask}: a blurred
 * copy of the crop, feathered in via a CSS mask, to erase baked-in mockup text; optional scale (source is rendered at width*scale).
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire('C:/Users/Jess/Desktop/Claude/Optivion/package.json');
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://localhost:3001';
const OUT = new URL('../assets/img/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const D1 = 'brand asset/Home_Desktop.png';
const D2 = 'brand asset/home_desktop2.png';
const MB = 'brand asset/mobile sample view.png';
const CO = 'brand asset/checking out.png';

const jobs = [
  // Hero scene: full strip, headline/subtitle/icons blurred away (we render real text on top).
  { out: 'hero-scene', src: D1, clip: [0, 69, 1536, 404],
    soft: { r: 26, mask: 'linear-gradient(to right,#000 0 395px,transparent 445px) no-repeat, linear-gradient(to bottom,#000 0 184px,transparent 200px) 0 0/560px 100% no-repeat, linear-gradient(to left,#000 0 468px,transparent 492px) no-repeat' } },
  // Customize banner (text on left blurred away).
  { out: 'customize-banner', src: CO, clip: [0, 86, 923, 237], soft: { r: 24, mask: 'linear-gradient(to right,#000 0 400px,transparent 460px)' } },

  // Products (from the customize screen, largest renders).
  { out: 'p-lingzhi-coffee', src: CO, clip: [37, 687, 155, 163] },
  { out: 'p-spirulina', src: CO, clip: [484, 687, 155, 163] },
  { out: 'p-morinzhi', src: CO, clip: [37, 895, 155, 156] },
  { out: 'p-ganoderma', src: CO, clip: [484, 895, 155, 156] },
  { out: 'p-cocozhi', src: CO, clip: [37, 1095, 155, 154] },
  { out: 'p-dxn-tea', src: CO, clip: [484, 1095, 155, 154] },
  { out: 'p-ganozhi-soap', src: CO, clip: [37, 1294, 155, 152] },
  { out: 'p-aloe-lotion', src: CO, clip: [484, 1294, 155, 152] },

  // Categories (Home_Desktop "Shop by Category").
  { out: 'c-beverages', src: D1, clip: [44, 756, 136, 100] },
  { out: 'c-supplements', src: D1, clip: [318, 756, 134, 100] },
  { out: 'c-personal-care', src: D1, clip: [604, 756, 140, 100] },
  { out: 'c-food', src: D1, clip: [890, 756, 150, 100] },
  { out: 'c-bundles', src: D1, clip: [1176, 756, 172, 100] },

  // Promo cards.
  { out: 'create-bundle', src: D1, clip: [26, 492, 272, 210] },
  { out: 'mystery-box', src: D1, clip: [838, 491, 316, 212] },
  { out: 'mystery-box-lg', src: D2, clip: [778, 588, 340, 254] },
  { out: 'customize-collage', src: D2, clip: [34, 588, 390, 254] },

  // Mobile-only sections.
  { out: 'm-natural', src: MB, clip: [560, 52, 258, 165], soft: { r: 14, mask: 'linear-gradient(to right,#000 0 160px,transparent 200px)' } },
  { out: 'm-one-world', src: MB, clip: [560, 752, 258, 308], soft: { r: 8, mask: 'linear-gradient(#000,#000)' } },
  { out: 'm-cta-package', src: MB, clip: [564, 1240, 246, 150] },
  { out: 'avatar-mariel', src: MB, clip: [591, 424, 54, 54] },
  { out: 'avatar-ramon', src: MB, clip: [591, 580, 54, 54] },
];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

for (const j of jobs) {
  const scale = j.scale || 1;
  const [x, y, w, h] = j.clip;
  const soft = j.soft
    ? `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;-webkit-mask:${j.soft.mask};mask:${j.soft.mask}"><img src="${BASE}/${encodeURI(j.src)}" style="position:absolute;left:-${x}px;top:-${y}px;filter:blur(${j.soft.r}px)"></div>`
    : '';
  await page.setViewport({ width: 2000, height: 2000, deviceScaleFactor: scale });
  await page.setContent(`<html><body style="margin:0;background:#fff">
    <div style="position:relative;display:inline-block">
      <img id="i" src="${BASE}/${encodeURI(j.src)}" style="display:block">${soft}
    </div></body></html>`, { waitUntil: 'load' });
  await page.screenshot({
    path: fileURLToPath(new URL(`${j.out}.webp`, OUT)),
    type: 'webp', quality: 90, clip: { x, y, width: w, height: h },
  });
  console.log('✓', j.out);
}

// Logo: square-ish crop of the mark from DXN_CG's dxn.png (6000x3375), rendered at 1/10.
await page.setViewport({ width: 600, height: 340, deviceScaleFactor: 2 });
await page.setContent(`<body style="margin:0;background:#fff"><img src="${BASE}/assets/src/dxn.png" style="width:600px;display:block"></body>`, { waitUntil: 'load' });
await page.screenshot({ path: fileURLToPath(new URL('logo.webp', OUT)), type: 'webp', quality: 92, clip: { x: 158, y: 34, width: 284, height: 274 }, omitBackground: false });
console.log('✓ logo');

await browser.close();
