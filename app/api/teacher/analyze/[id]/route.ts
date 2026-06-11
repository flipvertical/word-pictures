import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { isTeacher } from "@/lib/auth";
import { getImage, replaceHotspots } from "@/lib/db";
import { uploadAbsolutePath } from "@/lib/storage";
import { analyzeImage } from "@/lib/analyze";

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isTeacher())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — add it to .env.local" },
      { status: 500 },
    );
  }
  const { id } = await params;
  const image = await getImage(id);
  if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  try {
    const buf = await readFile(uploadAbsolutePath(image.filePath));
    const hotspots = await analyzeImage({
      imageBase64: buf.toString("base64"),
      mediaType: image.mediaType,
      title: image.title,
    });
    await replaceHotspots(id, hotspots);
    return NextResponse.json({ hotspots });
  } catch (err) {
    console.error("analyze failed", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
