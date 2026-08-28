import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Storage interface for uploaded PDFs. Two implementations:
 *
 *   - SupabaseStorage: writes to a Supabase Storage bucket. Persistent —
 *     survives redeploys/restarts. Preferred in production.
 *   - LocalDiskStorage: writes to backend/uploads/. Fine for local dev.
 *     WARNING on Render's free tier the filesystem is ephemeral, so
 *     any file saved here vanishes on the next redeploy or spin-down.
 *
 * Picks Supabase if SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 * SUPABASE_PDF_BUCKET are all set; else falls back to disk (with a
 * warning on startup so it's visible in Render's logs).
 */
export interface PdfStorage {
  save(filename: string, data: Buffer): Promise<{ key: string; url: string }>;
  /** Read a previously-saved file back out. Throws if the key doesn't resolve. */
  read(key: string): Promise<Buffer>;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

class LocalDiskStorage implements PdfStorage {
  async save(filename: string, data: Buffer) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${cuidish()}-${safe}`;
    const dest = path.join(UPLOAD_DIR, key);
    await writeFile(dest, data);
    return { key, url: `/uploads/${key}` };
  }
  async read(key: string) {
    // Reject any key that tries to escape UPLOAD_DIR via path traversal.
    if (key.includes('..') || key.includes('/') || key.includes('\\')) {
      throw new Error('Invalid key');
    }
    return readFile(path.join(UPLOAD_DIR, key));
  }
}

class SupabaseStorage implements PdfStorage {
  constructor(
    private readonly projectUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
  ) {}

  async save(filename: string, data: Buffer) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${cuidish()}-${safe}`;
    const url = `${this.projectUrl}/storage/v1/object/${this.bucket}/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/pdf',
        // Fail loudly if the same key somehow collides instead of silently overwriting.
        'x-upsert': 'false',
      },
      // Buffer works as fetch body at runtime; TS's BodyInit doesn't recognize
      // Node Buffer/Uint8Array, so cast — this is a pure type gap, not unsafe.
      body: data as unknown as BodyInit,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase upload failed (${res.status}): ${text}`);
    }
    // Return a moderator-only path — the actual /uploads route on the
    // backend still gates on the moderator cookie, but for Supabase we just
    // stash the object key; moderators can fetch it via the Supabase console
    // or by hitting /storage/v1/object/<bucket>/<key> with the service key.
    return { key, url: `${this.projectUrl}/storage/v1/object/${this.bucket}/${key}` };
  }
  async read(key: string) {
    const url = `${this.projectUrl}/storage/v1/object/${this.bucket}/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.serviceRoleKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase read failed (${res.status}): ${text}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

let counter = 0;
function cuidish() {
  counter = (counter + 1) % 1_000_000;
  return `${process.hrtime.bigint().toString(36)}${counter.toString(36)}`;
}

function pickStorage(): PdfStorage {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PDF_BUCKET;
  if (url && key && bucket) {
    console.log(`PDF storage: Supabase bucket "${bucket}"`);
    return new SupabaseStorage(url.replace(/\/$/, ''), key, bucket);
  }
  console.warn(
    'PDF storage: local disk (ephemeral on Render free tier — set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PDF_BUCKET to persist uploads)',
  );
  return new LocalDiskStorage();
}

export const pdfStorage: PdfStorage = pickStorage();

export async function savePdf(filename: string, data: Buffer) {
  return pdfStorage.save(filename, data);
}

export async function readPdf(key: string) {
  return pdfStorage.read(key);
}
