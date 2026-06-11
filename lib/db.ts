import { createClient, type Client } from "@libsql/client";
import type { Box, Hotspot, ImageRecord, Words } from "./types";
import { emptyWords } from "./types";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

export async function db(): Promise<Client> {
  const c = getClient();
  if (!ready) {
    ready = (async () => {
      await c.execute(`CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        file_path TEXT NOT NULL,
        media_type TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        share_slug TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      await c.execute(`CREATE TABLE IF NOT EXISTS hotspots (
        id TEXT PRIMARY KEY,
        image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        box_x REAL, box_y REAL, box_w REAL, box_h REAL,
        words_json TEXT NOT NULL DEFAULT '{}',
        sort INTEGER NOT NULL DEFAULT 0
      )`);
      try {
        await c.execute(
          "ALTER TABLE hotspots ADD COLUMN dot_color TEXT NOT NULL DEFAULT 'light'",
        );
      } catch {
        // column already exists
      }
    })();
  }
  await ready;
  return c;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToImage(r: any): ImageRecord {
  return {
    id: r.id,
    title: r.title,
    filePath: r.file_path,
    mediaType: r.media_type,
    width: Number(r.width),
    height: Number(r.height),
    status: r.status,
    shareSlug: r.share_slug ?? null,
    createdAt: r.created_at,
  };
}

function rowToHotspot(r: any): Hotspot {
  let words: Words;
  try {
    const parsed = JSON.parse(r.words_json);
    words = {
      nouns: parsed.nouns ?? [],
      verbs: parsed.verbs ?? [],
      adjectives: parsed.adjectives ?? [],
    };
  } catch {
    words = emptyWords();
  }
  const box: Box | null =
    r.box_x === null || r.box_x === undefined
      ? null
      : { x: Number(r.box_x), y: Number(r.box_y), w: Number(r.box_w), h: Number(r.box_h) };
  return {
    id: r.id,
    label: r.label,
    x: Number(r.x),
    y: Number(r.y),
    box,
    words,
    sort: Number(r.sort),
    dotColor: r.dot_color === "dark" ? "dark" : "light",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listImages(): Promise<ImageRecord[]> {
  const c = await db();
  const rs = await c.execute("SELECT * FROM images ORDER BY created_at DESC");
  return rs.rows.map(rowToImage);
}

export async function listPublishedImages(): Promise<ImageRecord[]> {
  const c = await db();
  const rs = await c.execute(
    "SELECT * FROM images WHERE status = 'published' ORDER BY created_at DESC",
  );
  return rs.rows.map(rowToImage);
}

export async function getImage(id: string): Promise<ImageRecord | null> {
  const c = await db();
  const rs = await c.execute({ sql: "SELECT * FROM images WHERE id = ?", args: [id] });
  return rs.rows[0] ? rowToImage(rs.rows[0]) : null;
}

export async function getImageBySlug(slug: string): Promise<ImageRecord | null> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM images WHERE share_slug = ? AND status = 'published'",
    args: [slug],
  });
  return rs.rows[0] ? rowToImage(rs.rows[0]) : null;
}

export async function createImage(rec: {
  id: string;
  title: string;
  filePath: string;
  mediaType: string;
  width: number;
  height: number;
}): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO images (id, title, file_path, media_type, width, height) VALUES (?, ?, ?, ?, ?, ?)",
    args: [rec.id, rec.title, rec.filePath, rec.mediaType, rec.width, rec.height],
  });
}

export async function deleteImage(id: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM hotspots WHERE image_id = ?", args: [id] });
  await c.execute({ sql: "DELETE FROM images WHERE id = ?", args: [id] });
}

export async function getHotspots(imageId: string): Promise<Hotspot[]> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM hotspots WHERE image_id = ? ORDER BY sort",
    args: [imageId],
  });
  return rs.rows.map(rowToHotspot);
}

export async function replaceHotspots(imageId: string, hotspots: Hotspot[]): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM hotspots WHERE image_id = ?", args: [imageId] });
  for (const [i, h] of hotspots.entries()) {
    await c.execute({
      sql: `INSERT INTO hotspots (id, image_id, label, x, y, box_x, box_y, box_w, box_h, words_json, sort, dot_color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        h.id,
        imageId,
        h.label,
        h.x,
        h.y,
        h.box?.x ?? null,
        h.box?.y ?? null,
        h.box?.w ?? null,
        h.box?.h ?? null,
        JSON.stringify(h.words),
        i,
        h.dotColor === "dark" ? "dark" : "light",
      ],
    });
  }
}

export async function setTitle(id: string, title: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: "UPDATE images SET title = ? WHERE id = ?", args: [title, id] });
}

export async function setPublished(id: string, slug: string | null): Promise<void> {
  const c = await db();
  if (slug) {
    await c.execute({
      sql: "UPDATE images SET status = 'published', share_slug = ? WHERE id = ?",
      args: [slug, id],
    });
  } else {
    await c.execute({ sql: "UPDATE images SET status = 'draft' WHERE id = ?", args: [id] });
  }
}
