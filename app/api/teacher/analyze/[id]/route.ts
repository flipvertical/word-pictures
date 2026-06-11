import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { isTeacher } from "@/lib/auth";
import { getHotspots, getImage, replaceHotspots } from "@/lib/db";
import { uploadAbsolutePath } from "@/lib/storage";
import { analyzeAuto, analyzeGuided } from "@/lib/analyze";

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
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

  let mode: "auto" | "guided" = "auto";
  try {
    const body = await req.json();
    if (body?.mode === "guided") mode = "guided";
  } catch {
    // no body — default to auto
  }

  try {
    const buf = await readFile(uploadAbsolutePath(image.filePath));
    const input = {
      imageBase64: buf.toString("base64"),
      mediaType: image.mediaType,
      title: image.title,
    };
    let hotspots;
    if (mode === "guided") {
      const all = await getHotspots(id);
      const isEmpty = (h: (typeof all)[number]) =>
        h.words.nouns.length + h.words.verbs.length + h.words.adjectives.length === 0;
      const empty = all.filter(isEmpty);
      if (empty.length === 0) {
        return NextResponse.json(
          { error: "No empty hotspots to fill — add a dot first." },
          { status: 400 },
        );
      }
      const filled = await analyzeGuided(input, empty);
      const byId = new Map(filled.map((h) => [h.id, h]));
      hotspots = all.map((h) => byId.get(h.id) ?? h);
    } else {
      hotspots = await analyzeAuto(input);
    }
    await replaceHotspots(id, hotspots);
    return NextResponse.json({ hotspots });
  } catch (err) {
    console.error("analyze failed", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
