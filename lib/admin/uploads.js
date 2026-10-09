// Product photo upload → Vercel Blob (public). The admin browser resizes/compresses first (≤1000px WebP/JPEG),
// so uploads stay small. BLOB_MOCK=1 (local dev/tests only) writes to assets/img/uploads/ instead.
import { randomBytes } from 'node:crypto';
import { HttpError } from '../http.js';

const MAX_BYTES = 2.5 * 1024 * 1024;
const TYPES = {
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b.subarray(1, 4).toString('ascii') === 'PNG' },
};

/** body: { filename, contentType, data (base64) } → { url } */
export async function uploadProductImage(body) {
  const t = TYPES[body?.contentType];
  if (!t) throw new HttpError(422, 'Upload a JPEG, PNG or WebP image.');
  const buf = Buffer.from(String(body.data || ''), 'base64');
  if (!buf.length) throw new HttpError(422, 'The image is empty.');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'Image is too large (max 2.5 MB after compression).');
  if (!t.magic(buf)) throw new HttpError(422, 'That file is not a valid image.');
  const base = String(body.filename || 'product').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product';
  const name = `products/${base}-${randomBytes(4).toString('hex')}.${t.ext}`;

  if (process.env.BLOB_MOCK === '1' && !process.env.VERCEL) {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync('assets/img/uploads', { recursive: true });
    const file = name.replace('products/', '');
    writeFileSync(`assets/img/uploads/${file}`, buf);
    return { url: `assets/img/uploads/${file}` };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, 'Photo storage is not configured (BLOB_READ_WRITE_TOKEN).');
  const { put } = await import('@vercel/blob');
  const blob = await put(name, buf, { access: 'public', contentType: body.contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
  return { url: blob.url };
}
