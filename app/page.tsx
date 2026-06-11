import Link from "next/link";
import { listPublishedImages } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const images = await listPublishedImages();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-medium">Word Pictures</h1>
      <p className="mt-1 text-neutral-500">
        Tap a picture, explore it, and collect the words to write about it.
      </p>

      {images.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          Nothing is open right now — check back when your teacher starts an activity.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {images.map((img) => (
            <li key={img.id}>
              <Link
                href={`/i/${img.shareSlug}`}
                className="group block overflow-hidden rounded-xl border border-neutral-200 transition-shadow hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.filePath}
                  alt={img.title}
                  className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                <p className="p-3 font-medium group-hover:underline">{img.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
