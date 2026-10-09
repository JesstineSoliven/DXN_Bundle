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

-- Phase 7: admin accounts, sessions, password setup/reset tokens
CREATE TABLE IF NOT EXISTS admin_users (
  id              serial PRIMARY KEY,
  email           text NOT NULL UNIQUE,                 -- stored lowercase
  name            text NOT NULL,
  role            text NOT NULL CHECK (role IN ('owner', 'staff')),
  password_hash   text,                                 -- NULL until the invite/reset link is used
  active          boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id           serial PRIMARY KEY,
  token_hash   text NOT NULL UNIQUE,                    -- sha256 of the cookie value
  user_id      integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  ip           text,
  user_agent   text
);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions(user_id);

CREATE TABLE IF NOT EXISTS admin_tokens (                -- invite + password reset links
  token_hash  text PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('invite', 'reset')),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Fixed-window rate limiting (key = bucket:ip or bucket:email)
CREATE TABLE IF NOT EXISTS rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Server-side errors and operational alerts
CREATE TABLE IF NOT EXISTS error_log (
  id           serial PRIMARY KEY,
  source       text NOT NULL,                           -- api | mail | paymongo | webhook | sync …
  message      text NOT NULL,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint  text NOT NULL,                           -- groups repeats for alert throttling
  emailed      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_log_created_idx ON error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS error_log_fp_idx ON error_log(fingerprint, created_at DESC);
