import { NextRequest, NextResponse } from "next/server";
import { isTeacher } from "@/lib/auth";
import { createImage } from "@/lib/db";
import { blobConfigured, saveUpload } from "@/lib/storage";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function POST(req: NextRequest) {
  if (!(await isTeacher())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (process.env.VERCEL && !blobConfigured()) {
    return NextResponse.json(
      { error: "Blob storage isn't connected — in Vercel, open the project's Storage tab, create a Blob store, connect it to this project, then redeploy." },
      { status: 500 },
    );
  }
  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "Untitled");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use a JPEG, PNG, WebP or GIF image" }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (max 4MB)" }, { status: 400 });
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return NextResponse.json({ error: "Missing image dimensions" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const filePath = await saveUpload(buf, ext, file.type);
    const id = crypto.randomUUID();
    await createImage({ id, title, filePath, mediaType: file.type, width, height });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("upload failed", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: `Storage error: ${message}` }, { status: 500 });
  }
}
