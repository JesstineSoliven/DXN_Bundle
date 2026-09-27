# DXN Bundle Store

Static storefront for building a custom DXN product bundle (any amount; ₱7,999 is the featured
reference package) or ordering a Mystery Box, with Cash on Delivery or GCash payment.

## Run locally

```bash
node serve.mjs 3001   # → http://localhost:3001
```

## Deploy

Vercel, as a static site (no build step). `.vercelignore` keeps mockups, tools and dev scripts out of the deployment.

## Update prices

Prices are **CP (Consumer Price)** from the DXN price list. Put the `.xlsx` in the project root (it is git-ignored), then run:

```bash
node tools/import-pricelist.mjs "PRICELIST-WITH-NEW-PRODUCTS (1).xlsx"
```

This regenerates `js/data/catalog.js`.

## Settings

`js/config.js` holds the delivery fee (currently free), the admin email, and the GCash account.

## Status

Phases 1–4 are done: UI, bundle builder, checkout with referral code, COD and GCash payment.
Orders and emails are stored in the browser (`localStorage`) until the Phase 5 backend is built.
