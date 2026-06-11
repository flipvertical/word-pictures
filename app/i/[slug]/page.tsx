import { notFound } from "next/navigation";
import { getHotspots, getImageBySlug } from "@/lib/db";
import Viewer from "./viewer";

export const dynamic = "force-dynamic";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const image = await getImageBySlug(slug);
  if (!image) notFound();
  const hotspots = await getHotspots(image.id);
  return <Viewer image={image} hotspots={hotspots} />;
}
