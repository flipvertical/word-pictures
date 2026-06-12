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
    <main className="mx-auto w-full max-w-3xl px-6 pb-[72px] pt-9">
      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          Word Pictures · Admin
        </p>
        <h1 className="font-serif text-[28px] font-medium text-ink">Images</h1>
        <p className="text-[13.5px] text-muted">
          Upload a picture, let the AI propose hotspots and vocabulary, then review and
          publish.
        </p>
      </header>

      <div className="mt-6">
        <UploadForm />
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        {images.map((img) => (
          <li
            key={img.id}
            className="flex items-center gap-4 rounded-[14px] border border-border-strong bg-surface p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.filePath}
              alt={img.title}
              className="h-16 w-24 rounded-[8px] object-cover"
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/${img.id}`}
                className="font-serif text-[16px] text-ink hover:underline"
              >
                {img.title}
              </Link>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.13em]">
                {img.status === "published" ? (
                  <span className="text-green">
                    Published ·{" "}
                    <a
                      href={`/i/${img.shareSlug}`}
                      className="underline"
                      target="_blank"
                    >
                      /i/{img.shareSlug}
                    </a>
                  </span>
                ) : (
                  <span className="text-muted">Draft</span>
                )}
              </p>
            </div>
            <Link
              href={`/admin/${img.id}`}
              className="rounded-full border border-border-stronger bg-ivory px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-page"
            >
              Edit
            </Link>
          </li>
        ))}
        {images.length === 0 && (
          <li className="rounded-[14px] border border-dashed border-border-stronger p-8 text-center text-[13.5px] text-muted">
            No images yet — upload one above to get started.
          </li>
        )}
      </ul>
    </main>
  );
}
