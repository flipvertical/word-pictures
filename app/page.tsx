import Link from "next/link";
import { listPublishedImages } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const images = await listPublishedImages();

  return (
    <main className="mx-auto w-full max-w-[980px] px-6 pb-[72px] pt-9">
      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          Word Pictures
        </p>
        <h1 className="font-serif text-[28px] font-medium text-ink">
          Pictures to write about
        </h1>
        <p className="text-[13.5px] text-muted">
          Tap a picture, explore it, and collect the words to write about it.
        </p>
      </header>

      {images.length === 0 ? (
        <p className="mt-10 rounded-[14px] border border-dashed border-border-stronger p-10 text-center text-[13.5px] text-muted">
          Nothing is open right now — check back when your teacher starts an activity.
        </p>
      ) : (
        <ul className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {images.map((img) => (
            <li key={img.id}>
              <Link
                href={`/i/${img.shareSlug}`}
                className="group block rounded-[14px] bg-surface p-3 transition-shadow"
                style={{
                  boxShadow: "0 2px 6px rgba(20,28,24,0.12), 0 12px 28px rgba(20,28,24,0.14)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.filePath}
                  alt={img.title}
                  className="aspect-[4/3] w-full rounded-[10px] object-cover"
                />
                <p className="px-1 pb-1 pt-3 font-serif text-[17px] text-ink group-hover:underline">
                  {img.title}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
