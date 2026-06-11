import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTeacher } from "@/lib/auth";
import { deleteImage, getHotspots, getImage, replaceHotspots, setTitle } from "@/lib/db";
import { deleteUpload } from "@/lib/storage";
import { BoxSchema, WordsSchema } from "@/lib/types";

const SavePayload = z.object({
  title: z.string().min(1),
  hotspots: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      box: BoxSchema.nullable(),
      words: WordsSchema,
      sort: z.number(),
    }),
  ),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await isTeacher())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const image = await getImage(id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const hotspots = await getHotspots(id);
  return NextResponse.json({ image, hotspots });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await isTeacher())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const image = await getImage(id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = SavePayload.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setTitle(id, body.data.title);
  await replaceHotspots(id, body.data.hotspots);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await isTeacher())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const image = await getImage(id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteImage(id);
  await deleteUpload(image.filePath);
  return NextResponse.json({ ok: true });
}
