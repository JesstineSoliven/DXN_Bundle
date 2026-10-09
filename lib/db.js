// Database access. Production: Neon Postgres (DATABASE_URL). Local dev/tests without DATABASE_URL:
// PGlite — real Postgres compiled to WASM, persisted under .data/pglite (git-ignored).
//
//   query(text, params) → rows
//   tx(async (q) => …)  → runs q(text, params) calls inside one transaction
//   exec(sql)           → multi-statement SQL (schema)

let impl;

async function neonImpl(url) {
  const { neon, Pool, neonConfig } = await import('@neondatabase/serverless');
  const { default: ws } = await import('ws');
  neonConfig.webSocketConstructor = ws;
  const http = neon(url);
  return {
    kind: 'neon',
    query: (text, params = []) => http(text, params),
    async tx(fn) {
      // A short-lived pool per transaction is the recommended pattern for serverless functions.
      const pool = new Pool({ connectionString: url });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn((text, params = []) => client.query(text, params).then((r) => r.rows));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
        await pool.end();
      }
    },
    async exec(sql) {
      const pool = new Pool({ connectionString: url });
      try { await pool.query(sql); } finally { await pool.end(); }
    },
  };
}

async function pgliteImpl() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { mkdirSync } = await import('node:fs');
  const dir = process.env.PGLITE_DIR || '.data/pglite';
  if (dir !== 'memory://') mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    kind: 'pglite',
    query: (text, params = []) => db.query(text, params).then((r) => r.rows),
    tx: (fn) => db.transaction((t) => fn((text, params = []) => t.query(text, params).then((r) => r.rows))),
    exec: (sql) => db.exec(sql),
  };
}

async function getImpl() {
  if (impl) return impl;
  const url = process.env.DATABASE_URL;
  if (url) impl = await neonImpl(url);
  else if (process.env.VERCEL) throw new Error('DATABASE_URL is not configured.');
  else impl = await pgliteImpl();
  return impl;
}

export const query = async (text, params) => (await getImpl()).query(text, params);
export const tx = async (fn) => (await getImpl()).tx(fn);
export const exec = async (sql) => (await getImpl()).exec(sql);
export const dbKind = async () => (await getImpl()).kind;
