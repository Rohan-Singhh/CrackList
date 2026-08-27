import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Storage interface for uploaded PDFs. v1 writes to local disk.
 * Swap this implementation for S3/GCS later without touching any route —
 * the routes only depend on `savePdf`'s signature.
 */
export interface PdfStorage {
  save(filename: string, data: Buffer): Promise<{ key: string; url: string }>;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

class LocalDiskStorage implements PdfStorage {
  async save(filename: string, data: Buffer) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    // Prefix with a timestamp-free unique-ish key; caller supplies createdAt separately.
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${cuidish()}-${safe}`;
    const dest = path.join(UPLOAD_DIR, key);
    await writeFile(dest, data);
    return { key, url: `/uploads/${key}` };
  }
}

// Small collision-resistant id without pulling a dep (avoids Math.random determinism concerns).
let counter = 0;
function cuidish() {
  counter = (counter + 1) % 1_000_000;
  return `${process.hrtime.bigint().toString(36)}${counter.toString(36)}`;
}

export const pdfStorage: PdfStorage = new LocalDiskStorage();

export async function savePdf(filename: string, data: Buffer) {
  return pdfStorage.save(filename, data);
}
