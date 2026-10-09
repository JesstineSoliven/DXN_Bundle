-- DXN Bundle Store schema (Postgres / Neon). Idempotent: safe to run repeatedly.
-- Money is stored as whole pesos (integer); the price list has no centavos.

CREATE TABLE IF NOT EXISTS categories (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  image       text,
  sort        integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id            text PRIMARY KEY,               -- product code, lowercase (e.g. fb096)
  code          text NOT NULL UNIQUE,           -- product code as on the price list (FB096)
  name          text NOT NULL,
  size          text NOT NULL DEFAULT '',
  category_id   text NOT NULL REFERENCES categories(id),
  price         integer NOT NULL CHECK (price > 0), -- CP (Consumer Price), ₱
  image         text,
  featured_rank integer,                        -- NULL = not featured; lower = earlier
  sort          integer NOT NULL DEFAULT 0,     -- price-list order
  active        boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id) WHERE active;

CREATE TABLE IF NOT EXISTS referral_codes (
  code          text PRIMARY KEY,               -- stored normalised (uppercase, no spaces)
  referrer_name text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  mobile      text NOT NULL,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, mobile)
);

-- Per-day counter → sequential order numbers DXN-YYMMDD-0001
CREATE TABLE IF NOT EXISTS order_counters (
  day   text PRIMARY KEY,                       -- YYMMDD (Asia/Manila)
  n     integer NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id                 text PRIMARY KEY,          -- DXN-YYMMDD-NNNN
  access_token_hash  text NOT NULL,             -- sha256 of the customer's order link token
  type               text NOT NULL CHECK (type IN ('custom', 'mystery')),
  status             text NOT NULL DEFAULT 'placed',
  customer_id        integer NOT NULL REFERENCES customers(id),
  customer_name      text NOT NULL,
  customer_mobile    text NOT NULL,
  customer_email     text NOT NULL,
  address            jsonb NOT NULL,
  address_text       text NOT NULL,
  notes              text NOT NULL DEFAULT '',
  referral_code      text NOT NULL REFERENCES referral_codes(code),
  subtotal           integer NOT NULL,
  delivery_fee       integer NOT NULL,
  grand_total        integer NOT NULL,
  payment_method     text NOT NULL CHECK (payment_method IN ('cod', 'gcash')),
  payment_status     text NOT NULL CHECK (payment_status IN ('cod_pending', 'pending', 'submitted', 'confirmed', 'failed')),
  gcash_reference    text UNIQUE,
  sender_name        text,
  sender_mobile      text,
  submitted_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);

CREATE TABLE IF NOT EXISTS order_items (
  id          serial PRIMARY KEY,
  order_id    text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  text REFERENCES products(id),      -- NULL for the Mystery Box
  code        text NOT NULL,
  name        text NOT NULL,
  size        text NOT NULL DEFAULT '',
  unit_price  integer NOT NULL,
  qty         integer NOT NULL CHECK (qty > 0),
  line_total  integer NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id          serial PRIMARY KEY,
  order_id    text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      text NOT NULL,
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events(order_id, id);

CREATE TABLE IF NOT EXISTS email_log (
  id          serial PRIMARY KEY,
  order_id    text,
  kind        text NOT NULL,                    -- new_order | payment_submitted | payment_status
  to_address  text NOT NULL,
  subject     text NOT NULL,
  status      text NOT NULL,                    -- sent | failed | skipped (no SMTP configured)
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- PayMongo GCash (replaces the manual QR + reference-number flow; old gcash_* columns kept for history)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_fee integer NOT NULL DEFAULT 0;   -- GCash convenience fee, ₱
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paymongo_checkout_id text UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paymongo_payment_id text UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Phase 6: order fulfilment status history (placed → processing → shipped → delivered | cancelled)
CREATE TABLE IF NOT EXISTS order_events (
  id          serial PRIMARY KEY,
  order_id    text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      text NOT NULL,
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_referral_idx ON orders(referral_code);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);
