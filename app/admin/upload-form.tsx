"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose an image file first.");
    if (file.size > 4 * 1024 * 1024)
      return setError("Image is over 4MB — please resize it first.");
    setBusy(true);
    setError(null);
    try {
      const { width, height } = await readDimensions(file);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", title || file.name.replace(/\.[^.]+$/, ""));
      fd.set("width", String(width));
      fd.set("height", String(height));
      const res = await fetch("/api/teacher/upload", { method: "POST", body: fd });
      let data: { id?: string; error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON crash page from the platform
      }
      if (!res.ok || !data?.id) {
        throw new Error(data?.error ?? `Upload failed (server error ${res.status})`);
      }
      router.push(`/admin/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3"
    >
      <input
        type="file"
        ref={fileRef}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="text-sm"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. Landscape with the Fall of Icarus)"
        className="min-w-64 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
