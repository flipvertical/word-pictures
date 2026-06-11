import { notFound, redirect } from "next/navigation";
import { isTeacher } from "@/lib/auth";
import { getHotspots, getImage } from "@/lib/db";
import Editor from "./editor";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isTeacher())) redirect("/teacher/login");
  const { id } = await params;
  const image = await getImage(id);
  if (!image) notFound();
  const hotspots = await getHotspots(id);
  return <Editor image={image} initialHotspots={hotspots} />;
}
