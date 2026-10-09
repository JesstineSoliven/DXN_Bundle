// Create an admin account and email them a "set your password" link (valid 3 days).
// Usage: node scripts/admin-create.mjs <email> "<name>" [owner|staff] [site-url]
// Uses DATABASE_URL from the environment / .env.local. Re-running for an existing email re-sends the link.
import './env.mjs';
import { query } from '../lib/db.js';
import { createAdminUser, issueToken } from '../lib/auth.js';
import { emailAdminAccountLink } from '../lib/emails.js';

const [email, name, role = 'owner', site = process.env.SITE_URL || 'https://dxn-bundle.vercel.app'] = process.argv.slice(2);
if (!email || !name) { console.error('Usage: node scripts/admin-create.mjs <email> "<name>" [owner|staff] [site-url]'); process.exit(1); }
let [u] = await query('SELECT * FROM admin_users WHERE email = $1', [email.trim().toLowerCase()]);
if (!u) u = await createAdminUser({ email, name, role });
const purpose = u.password_hash ? 'reset' : 'invite';
const token = await issueToken(u.id, purpose);
const status = await emailAdminAccountLink(u, token, purpose, site.replace(/\/+$/, ''));
console.log(`✓ ${u.role} account ${u.email}: ${purpose} email ${status}`);
if (status !== 'sent') console.log(`  Email not sent — open this link yourself: ${site.replace(/\/+$/, '')}/admin#/set-password?token=${token}`);
process.exit(0);
