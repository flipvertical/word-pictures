import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";

// Two drivers, selected by environment:
// - Vercel Blob in production — filePath is an absolute URL. The SDK authenticates
//   via BLOB_READ_WRITE_TOKEN (classic / local dev) or the deployment's OIDC
//   identity + BLOB_STORE_ID (what Vercel injects when a store is connected).
// - local filesystem under public/uploads otherwise (dev) — filePath is /uploads/<name>

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
export const blobConfigured = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const useBlob = blobConfigured;

export async function saveUpload(
  buf: Buffer,
  ext: string,
  mediaType: string,
): Promise<string> {
  const name = `${crypto.randomUUID()}${ext}`;
  if (useBlob()) {
    const blob = await put(`uploads/${name}`, buf, {
      access: "public",
      contentType: mediaType,
    });
    return blob.url;
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, name), buf);
  return `/uploads/${name}`;
}

export async function deleteUpload(filePath: string): Promise<void> {
  try {
    if (filePath.startsWith("http")) {
      await del(filePath);
    } else if (filePath.startsWith("/uploads/")) {
      await unlink(path.join(UPLOADS_DIR, path.basename(filePath)));
    }
  } catch {
    // already gone — fine
  }
}

export async function readUpload(filePath: string): Promise<Buffer> {
  if (filePath.startsWith("http")) {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`Could not fetch stored image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(path.join(UPLOADS_DIR, path.basename(filePath)));
}
