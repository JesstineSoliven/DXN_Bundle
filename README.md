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
   npm run db:setup                   # schema + 154 products + sample referral codes (re-runnable; keeps admin edits)
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

## Admin dashboard

Open **`/admin`** (e.g. https://dxn-bundle.vercel.app/admin) and sign in with **your email and password**.

- **First owner account:** run `node scripts/admin-create.mjs you@example.com "Your Name" owner`. You get a "set your password" email; the link is valid for 3 days.
- **Staff:** the owner invites them from **Team**. Everyone has their own login and can use **Forgot password**.
- **Security:**
  - After 8 wrong passwords, the account locks for 15 minutes.
  - Sessions last 7 days and are stored in an HttpOnly, SameSite=Strict cookie.
  - Switching a person off signs them out everywhere.
- **Emergency key:** `ADMIN_API_KEY` still works for scripts. Remove it from Vercel once your account works; the System page reminds you.

| Page | What you can do |
|---|---|
| Dashboard | Paid revenue, orders today, 7 days and 30/90 days, awaiting payment, to fulfil, daily revenue chart, top products, top referrers |
| Orders | Search and filter. Move orders Placed → Processing → Shipped → Delivered (or Cancel). Mark COD cash collected, and override GCash payments for refunds |
| Products | Add, edit and archive products. Inline price edits, category, image URL, featured position (1–6) |
| Categories | Add, rename, reorder, and delete empty categories |
| Referral codes | Add codes, rename referrers, turn codes on or off, see orders and sales per code |
| Customers | Search. Orders count, total paid, last order |
| Team *(owner)* | Invite staff or owners, change roles, switch access off, resend links |
| System *(owner)* | Database, email and PayMongo status (test/live), recent problems, recent emails |

Customers are emailed when an order is **Shipped** (including your note, e.g. the courier and tracking number) or **Cancelled**. Price and product changes appear in the store within about a minute.

## Production safeguards

- **Rate limits** (stored in the database): checkout, referral checks, GCash start, login and password reset.
- **Security headers** (`vercel.json`): a strict Content-Security-Policy (no inline scripts), HSTS, no framing, nosniff, Referrer-Policy and Permissions-Policy.
- **Error alerts:** server errors, failed emails, PayMongo errors and payment mismatches go to `error_log`, and the admin is emailed at most once per hour per issue (Admin → System).
- **Styles:** Tailwind is pre-built (`npm run build` → `css/tailwind.css`; Vercel runs it on deploy). There is no CDN script.
- **Product photos:** uploaded from the product form, resized and compressed in the browser, and stored in Vercel Blob (`BLOB_READ_WRITE_TOKEN`).

## Tests

```bash
# start the local server in mock mode (local database, no real email or PayMongo):
DATABASE_URL= GMAIL_USER= GMAIL_APP_PASSWORD= PAYMONGO_MOCK=1 PAYMONGO_WEBHOOK_SECRET=whsk_mock_dev_secret BLOB_MOCK=1 ALERTS=off RATE_LIMITS=off ADMIN_API_KEY=<key> npm run dev
# (RATE_LIMITS=off is local-only; run scripts/auth-test.mjs with limits on)

DATABASE_URL= ADMIN_API_KEY=<key> npm run test:api                # pricing, tokens, PayMongo webhook, admin
DATABASE_URL= ADMIN_API_KEY=<key> node tests/e2e.mjs [--mobile]    # browser flows incl. GCash checkout
DATABASE_URL= ADMIN_API_KEY=<key> node scripts/admin-test.mjs     # admin API
ADMIN_API_KEY=<key> node tests/admin-e2e.mjs [--mobile]             # admin dashboard UI (incl. sign-in + photo upload)
DATABASE_URL= ADMIN_API_KEY=<key> node scripts/auth-test.mjs      # accounts, sessions, CSRF, lockout, rate limits
```

## Layout

| Path | Contents |
|---|---|
| `api/` | Serverless endpoints: catalog, referral check, orders, PayMongo webhook, admin (`api/admin.js`, all admin routes) |
| `lib/` | Server code: database, order logic, PayMongo, email, admin queries (`lib/admin/`) |
| `js/shared/` | Rules and constants used by both the browser and the API |
| `sql/schema.sql` | Database schema |
| `scripts/` | Database setup and API tests |
