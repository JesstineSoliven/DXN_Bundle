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

## Admin (until the Phase 6 dashboard)

- Order and GCash emails go to `ADMIN_EMAIL`.
- To confirm or fail a GCash payment, open the order link from the email and add `&demo=1`, then enter your `ADMIN_API_KEY`.

## Tests

```bash
ADMIN_API_KEY=<key> npm run test:api                # API: pricing, tokens, payments, admin
ADMIN_API_KEY=<key> node tests/e2e.mjs [--mobile]    # browser flows (needs npm run dev running)
```

## Layout

| Path | Contents |
|---|---|
| `api/` | Serverless endpoints: catalog, referral check, orders, GCash proof, admin payment status |
| `lib/` | Server code: database, order logic, email |
| `js/shared/` | Rules and constants used by both the browser and the API |
| `sql/schema.sql` | Database schema |
| `scripts/` | Database setup and API tests |
