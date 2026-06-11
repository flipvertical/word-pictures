import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// v1 stores uploads on the local filesystem under public/uploads (gitignored).
// For Vercel deployment this moves to Vercel Blob — see DESIGN.md.

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUpload(buf: Buffer, ext: string): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}${ext}`;
  await writeFile(path.join(UPLOADS_DIR, name), buf);
  return `/uploads/${name}`;
}

export async function deleteUpload(publicPath: string): Promise<void> {
  if (!publicPath.startsWith("/uploads/")) return;
  try {
    await unlink(path.join(UPLOADS_DIR, path.basename(publicPath)));
  } catch {
    // already gone — fine
  }
}

export function uploadAbsolutePath(publicPath: string): string {
  return path.join(UPLOADS_DIR, path.basename(publicPath));
}
