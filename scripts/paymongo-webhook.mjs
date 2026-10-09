// One-off: register the PayMongo webhook and print its signing secret.
// Usage: PAYMONGO_SECRET_KEY=sk_test_… node scripts/paymongo-webhook.mjs [https://dxn-bundle.vercel.app]
// Then store the printed secret:  vercel env add PAYMONGO_WEBHOOK_SECRET production,preview --sensitive
// Run once for test keys and again (with sk_live_…) when going live — each mode has its own webhook + secret.
import './env.mjs';
import { createWebhook } from '../lib/paymongo.js';

const site = (process.argv[2] || process.env.SITE_URL || 'https://dxn-bundle.vercel.app').replace(/\/+$/, '');
if (!process.env.PAYMONGO_SECRET_KEY) { console.error('Set PAYMONGO_SECRET_KEY first.'); process.exit(1); }
const mode = process.env.PAYMONGO_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';
const w = await createWebhook(`${site}/api/webhooks/paymongo`);
console.log(`✓ ${mode} webhook ${w.id} → ${site}/api/webhooks/paymongo`);
console.log(`PAYMONGO_WEBHOOK_SECRET=${w.secret}`);
