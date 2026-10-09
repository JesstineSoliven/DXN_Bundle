# DXN Bundle Store

Storefront for building a custom DXN product bundle (any amount; ₱7,999 is the featured reference
package) or ordering a Mystery Box, paid by Cash on Delivery or GCash.

- **Frontend:** static HTML/JS (Tailwind CDN), hash routing, no build step.
- **Backend:** Vercel serverless functions in `api/`, with a Neon Postgres database and Gmail SMTP email.

## Deploy (Vercel + Neon + Gmail)

1. **Vercel → Add New → Project**, then import this repo. Set Framework Preset to **Other** and leave the build command empty.
2. **Vercel → Storage → Create Database → Neon**, and connect it to the project. This adds `DATABASE_URL`.
3. **Gmail:** Google Account → Security → turn on 2-Step Verification, then **App passwords**. Create one and copy the 16 characters.
4. **Vercel → Settings → Environment Variables:**

   | Variable | Value |
   |---|---|
   | `GMAIL_USER` | the Gmail address that sends emails |
   | `GMAIL_APP_PASSWORD` | the app password from step 3 |
   | `ADMIN_EMAIL` | where order emails go (default `jess1008soliven@gmail.com`) |
   | `ADMIN_API_KEY` | a long random secret (at least 16 characters) for the admin payment controls |
   | `PAYMONGO_SECRET_KEY` | PayMongo secret key (`sk_test_…` for testing, `sk_live_…` when live) |
   | `PAYMONGO_WEBHOOK_SECRET` | printed by `node scripts/paymongo-webhook.mjs` |
   | `SITE_URL` | `https://dxn-bundle.vercel.app` (production only; used in GCash return links and emails) |

5. **Create the tables and load the products** (once, from your computer):

   ```bash
   npm install
   npx vercel link
   npx vercel env pull .env.local     # downloads DATABASE_URL etc.
   npm run db:setup                   # schema + 154 products + sample referral codes
   ```

6. **Redeploy** in Vercel.

## Run locally

```bash
npm install
npm run db:setup     # local database (PGlite in .data/) unless .env.local has DATABASE_URL
npm run dev          # → http://localhost:3001  (site + API)
```

Without Gmail settings, emails are logged as `skipped` instead of sent. `node serve.mjs` serves the static site only, using the bundled price list and no API.

## Update prices

Prices are **CP (Consumer Price)** from the DXN price list. Put the `.xlsx` in the project root (it is git-ignored), then run:

```bash
node tools/import-pricelist.mjs "PRICELIST-WITH-NEW-PRODUCTS (1).xlsx" --db
```

This regenerates `js/data/catalog.js` and, with `--db`, updates the database.

## GCash payments (PayMongo)

GCash goes through PayMongo's hosted checkout:
- The customer is sent to GCash with the exact amount (including the GCash convenience fee, `GCASH_FEE_BPS` in `js/shared/constants.js`).
- The order is confirmed automatically by the PayMongo webhook. The order page also re-checks with PayMongo when the customer returns.
- No QR code or reference numbers.

Setup:
- Add `PAYMONGO_SECRET_KEY` to Vercel.
- Run `node scripts/paymongo-webhook.mjs` once per mode (test, then live) and add the printed `PAYMONGO_WEBHOOK_SECRET`.
- Locally, `PAYMONGO_MOCK=1 npm run dev` uses a fake checkout page instead of PayMongo.

## Admin (until the Phase 6 dashboard)

- Order and GCash emails go to `ADMIN_EMAIL`.
- GCash payments confirm themselves. For exceptions (refunds, disputes), open the **Manage this order** link in the email and enter your `ADMIN_API_KEY` to mark a payment Failed or Confirmed.

## Tests

```bash
# start the local server in mock mode (local database, no real email or PayMongo):
DATABASE_URL= GMAIL_USER= GMAIL_APP_PASSWORD= PAYMONGO_MOCK=1 ADMIN_API_KEY=<key> npm run dev

DATABASE_URL= ADMIN_API_KEY=<key> npm run test:api                # pricing, tokens, PayMongo webhook, admin
DATABASE_URL= ADMIN_API_KEY=<key> node tests/e2e.mjs [--mobile]    # browser flows incl. GCash checkout
```

## Layout

| Path | Contents |
|---|---|
| `api/` | Serverless endpoints: catalog, referral check, orders, GCash proof, admin payment status |
| `lib/` | Server code: database, order logic, email |
| `js/shared/` | Rules and constants used by both the browser and the API |
| `sql/schema.sql` | Database schema |
| `scripts/` | Database setup and API tests |
