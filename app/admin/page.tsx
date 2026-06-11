import Link from "next/link";
import { redirect } from "next/navigation";
import { isTeacher } from "@/lib/auth";
import { listImages } from "@/lib/db";
import UploadForm from "./upload-form";

export const dynamic = "force-dynamic";

export default async function TeacherHome() {
  if (!(await isTeacher())) redirect("/admin/login");
  const images = await listImages();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-medium">Word Pictures — images</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Upload a picture, let the AI propose hotspots and vocabulary, then review and publish.
      </p>

      <div className="mt-6">
        <UploadForm />
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        {images.map((img) => (
          <li
            key={img.id}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.filePath}
              alt={img.title}
              className="h-16 w-24 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <Link href={`/admin/${img.id}`} className="font-medium hover:underline">
                {img.title}
              </Link>
              <p className="text-sm text-neutral-500">
                {img.status === "published" ? (
                  <span className="text-green-700">
                    Published —{" "}
                    <a href={`/i/${img.shareSlug}`} className="underline" target="_blank">
                      /i/{img.shareSlug}
                    </a>
                  </span>
                ) : (
                  "Draft"
                )}
              </p>
            </div>
            <Link
              href={`/admin/${img.id}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Edit
            </Link>
          </li>
        ))}
        {images.length === 0 && (
          <li className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            No images yet — upload one above to get started.
          </li>
        )}
      </ul>
    </main>
  );
}
