/**
 * screenshot.mjs — Puppeteer screenshot tool for DXN Bundle.
 * Usage: node screenshot.mjs <url> [label] [--mobile]
 * Output: ./temporary screenshots/screenshot-N[-label].png (auto-incremented)
 */

import { createRequire } from 'module';
const require = createRequire('C:/Users/Jess/Desktop/Claude/Optivion/package.json');
const puppeteer = require('puppeteer');
import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const positional = args.filter(a => !a.startsWith('--'));
const url = positional[0] || 'http://localhost:3000';
const label = positional[1];

const screenshotsDir = join(__dirname, 'temporary screenshots');
mkdirSync(screenshotsDir, { recursive: true });

// Find next screenshot number
const existing = readdirSync(screenshotsDir).filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
const nums = existing.map(f => parseInt(f.replace('screenshot-', '').split('-')[0])).filter(n => !isNaN(n));
const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;

const filename = label ? `screenshot-${nextNum}-${label}.png` : `screenshot-${nextNum}.png`;
const filepath = join(screenshotsDir, filename);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport(
  mobile
    ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { width: 1440, height: 900, deviceScaleFactor: 1 }
);

console.log(`Navigating to ${url}…`);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

// Scroll to trigger IntersectionObserver animations.
// scroll-behavior:smooth makes scrollBy lag behind a naive counter, so disable it
// and drive the scroll by real scrollY, waiting until the position actually settles.
await page.evaluate(async () => {
  const prev = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const maxY = () => Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  ) - window.innerHeight;

  for (let y = 0; y <= maxY(); y += Math.round(window.innerHeight * 0.6)) {
    window.scrollTo(0, y);
    await sleep(120);
  }
  window.scrollTo(0, maxY());
  await sleep(400);
  window.scrollTo(0, 0);
  await sleep(300);

  document.documentElement.style.scrollBehavior = prev;
});

// Let the last reveal transitions finish (0.7s + up to 0.3s stagger).
await new Promise(r => setTimeout(r, 1200));

await page.screenshot({ path: filepath, fullPage: true });
await browser.close();

console.log(`Screenshot saved: ${filepath}`);
