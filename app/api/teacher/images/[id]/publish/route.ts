import { NextRequest, NextResponse } from "next/server";
import { isTeacher } from "@/lib/auth";
import { getImage, setPublished } from "@/lib/db";

function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const rand = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${rand}` : rand;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isTeacher())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const image = await getImage(id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { publish } = await req.json();
  if (publish) {
    const slug = image.shareSlug ?? makeSlug(image.title);
    await setPublished(id, slug);
    return NextResponse.json({ shareSlug: slug });
  }
  await setPublished(id, null);
  return NextResponse.json({ shareSlug: null });
}
