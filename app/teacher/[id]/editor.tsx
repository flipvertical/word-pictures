"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  POS_KEYS,
  POS_LABELS,
  emptyWords,
  type Box,
  type Hotspot,
  type ImageRecord,
  type PosKey,
  type WordEntry,
} from "@/lib/types";

type Props = { image: ImageRecord; initialHotspots: Hotspot[] };
type BoxDragMode = "move" | "nw" | "ne" | "sw" | "se";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function Editor({ image, initialHotspots }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(image.title);
  const [hotspots, setHotspots] = useState<Hotspot[]>(initialHotspots);
  const [selectedId, setSelectedId] = useState<string | null>(initialHotspots[0]?.id ?? null);
  const [shareSlug, setShareSlug] = useState(image.shareSlug);
  const [published, setPublished] = useState(image.status === "published");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const boxDrag = useRef<{
    mode: BoxDragMode;
    startPx: number;
    startPy: number;
    startBox: Box;
    rect: DOMRect;
  } | null>(null);

  const selected = hotspots.find((h) => h.id === selectedId) ?? null;

  function patchHotspot(id: string, patch: Partial<Hotspot>) {
    setHotspots((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }

  function pointerToNorm(e: React.PointerEvent): { x: number; y: number } | null {
    const rect = imgWrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    };
  }

  function onPinPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragId.current = id;
    setSelectedId(id);
  }
  function onPinPointerMove(e: React.PointerEvent) {
    if (!dragId.current) return;
    const p = pointerToNorm(e);
    if (p) patchHotspot(dragId.current, { x: p.x, y: p.y });
  }
  function onPinPointerUp() {
    dragId.current = null;
  }

  function onBoxPointerDown(e: React.PointerEvent, mode: BoxDragMode) {
    if (!selected?.box) return;
    const rect = imgWrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // pointer capture can fail (cancelled gestures, synthetic events) — dragging still works
    }
    boxDrag.current = {
      mode,
      startPx: e.clientX,
      startPy: e.clientY,
      startBox: { ...selected.box },
      rect,
    };
  }
  function onBoxPointerMove(e: React.PointerEvent) {
    const d = boxDrag.current;
    if (!d || !selected) return;
    const dx = (e.clientX - d.startPx) / d.rect.width;
    const dy = (e.clientY - d.startPy) / d.rect.height;
    const MIN = 0.03;
    let { x, y, w, h } = d.startBox;
    if (d.mode === "move") {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      let x2 = x + w;
      let y2 = y + h;
      if (d.mode.includes("w")) x = clamp(x + dx, 0, x2 - MIN);
      if (d.mode.includes("e")) x2 = clamp(x2 + dx, x + MIN, 1);
      if (d.mode.includes("n")) y = clamp(y + dy, 0, y2 - MIN);
      if (d.mode.includes("s")) y2 = clamp(y2 + dy, y + MIN, 1);
      w = x2 - x;
      h = y2 - y;
    }
    patchHotspot(selected.id, { box: { x, y, w, h } });
  }
  function onBoxPointerUp() {
    boxDrag.current = null;
  }

  function addHotspot() {
    const h: Hotspot = {
      id: crypto.randomUUID(),
      label: "New hotspot",
      x: 0.5,
      y: 0.5,
      box: null,
      words: emptyWords(),
      sort: hotspots.length,
      dotColor: "light",
    };
    setHotspots((hs) => [...hs, h]);
    setSelectedId(h.id);
  }

  function addBox() {
    if (!selected) return;
    const w = 0.2;
    const h = 0.2;
    patchHotspot(selected.id, {
      box: {
        x: clamp(selected.x - w / 2, 0, 1 - w),
        y: clamp(selected.y - h / 2, 0, 1 - h),
        w,
        h,
      },
    });
  }

  function deleteHotspot(id: string) {
    setHotspots((hs) => hs.filter((h) => h.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function patchWord(pos: PosKey, idx: number, patch: Partial<WordEntry>) {
    if (!selected) return;
    const words = { ...selected.words };
    words[pos] = words[pos].map((w, i) => (i === idx ? { ...w, ...patch } : w));
    patchHotspot(selected.id, { words });
  }
  function addWord(pos: PosKey) {
    if (!selected) return;
    const words = { ...selected.words };
    words[pos] = [...words[pos], { word: "", gloss: "", related: [] }];
    patchHotspot(selected.id, { words });
  }
  function removeWord(pos: PosKey, idx: number) {
    if (!selected) return;
    const words = { ...selected.words };
    words[pos] = words[pos].filter((_, i) => i !== idx);
    patchHotspot(selected.id, { words });
  }

  async function api(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(String(data.error ?? "Request failed"));
    return data;
  }

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function saveCurrent() {
    await api(`/api/teacher/images/${image.id}`, {
      method: "PUT",
      body: JSON.stringify({ title, hotspots }),
    });
  }

  const save = () =>
    run("save", async () => {
      await saveCurrent();
      return "Saved.";
    });

  const analyzeAuto = () =>
    run("auto", async () => {
      if (
        hotspots.length > 0 &&
        !confirm("This will replace ALL current hotspots and words with the AI's proposals. Continue?")
      ) {
        return "Analysis cancelled.";
      }
      const data = await api(`/api/teacher/analyze/${image.id}`, {
        method: "POST",
        body: JSON.stringify({ mode: "auto" }),
      });
      const hs = data.hotspots as Hotspot[];
      setHotspots(hs);
      setSelectedId(hs[0]?.id ?? null);
      return `Done — proposed ${hs.length} hotspots. Review, edit, then save.`;
    });

  const isEmpty = (h: Hotspot) => POS_KEYS.every((p) => h.words[p].length === 0);
  const emptyCount = hotspots.filter(isEmpty).length;

  const analyzeGuided = () =>
    run("guided", async () => {
      if (emptyCount === 0) return "No empty hotspots — add a dot first.";
      await saveCurrent();
      const data = await api(`/api/teacher/analyze/${image.id}`, {
        method: "POST",
        body: JSON.stringify({ mode: "guided" }),
      });
      const hs = data.hotspots as Hotspot[];
      setHotspots(hs);
      return `Done — filled ${emptyCount} empty hotspot${emptyCount === 1 ? "" : "s"}. Review, edit, then save.`;
    });

  const togglePublish = () =>
    run("publish", async () => {
      await saveCurrent();
      const data = await api(`/api/teacher/images/${image.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ publish: !published }),
      });
      const slug = data.shareSlug as string | null;
      setShareSlug(slug);
      setPublished(Boolean(slug));
      return slug ? "Published." : "Unpublished.";
    });

  const remove = () =>
    run("delete", async () => {
      if (!confirm("Delete this image and all its hotspots?")) return "Cancelled.";
      await api(`/api/teacher/images/${image.id}`, { method: "DELETE" });
      router.push("/teacher");
      return "Deleted.";
    });

  const shareUrl = shareSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/i/${shareSlug}`
    : null;

  const dotClasses = (h: Hotspot) =>
    h.dotColor === "dark"
      ? "bg-neutral-900/90 ring-1 ring-white/70"
      : "bg-white/95 ring-1 ring-black/40";

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/teacher" className="text-sm text-neutral-500 hover:underline">
          ← Images
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 font-medium"
        />
        <button
          onClick={analyzeAuto}
          disabled={busy !== null}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "auto" ? "Analyzing…" : "AI: propose hotspots"}
        </button>
        <button
          onClick={analyzeGuided}
          disabled={busy !== null || emptyCount === 0}
          title="The AI looks at each dot that has no words yet and writes its label, box and words. Hotspots that already have words are left alone."
          className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          {busy === "guided"
            ? "Filling…"
            : `AI: fill empty hotspots${emptyCount > 0 ? ` (${emptyCount})` : ""}`}
        </button>
        <button
          onClick={save}
          disabled={busy !== null}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          onClick={togglePublish}
          disabled={busy !== null}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          {published ? "Unpublish" : "Publish"}
        </button>
      </div>

      {(busy === "auto" || busy === "guided") && (
        <p className="mt-2 text-sm text-neutral-500">
          The AI is looking at the picture — this takes a minute or so.
        </p>
      )}
      {message && <p className="mt-2 text-sm text-neutral-600">{message}</p>}
      {published && shareUrl && (
        <p className="mt-2 text-sm">
          Student link:{" "}
          <a href={shareUrl} target="_blank" className="text-indigo-700 underline">
            {shareUrl}
          </a>{" "}
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="ml-1 rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50"
          >
            Copy
          </button>
        </p>
      )}

      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-3/5">
          <div ref={imgWrapRef} className="relative inline-block w-full select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.filePath} alt={title} className="w-full rounded-xl" draggable={false} />

            {selected?.box && (
              <div
                onPointerDown={(e) => onBoxPointerDown(e, "move")}
                onPointerMove={onBoxPointerMove}
                onPointerUp={onBoxPointerUp}
                className="absolute cursor-move rounded border-2 border-indigo-400/90"
                style={{
                  left: `${selected.box.x * 100}%`,
                  top: `${selected.box.y * 100}%`,
                  width: `${selected.box.w * 100}%`,
                  height: `${selected.box.h * 100}%`,
                  touchAction: "none",
                }}
              >
                {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                  <div
                    key={corner}
                    onPointerDown={(e) => onBoxPointerDown(e, corner)}
                    onPointerMove={onBoxPointerMove}
                    onPointerUp={onBoxPointerUp}
                    className="absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-500"
                    style={{
                      left: corner.includes("w") ? "-7px" : undefined,
                      right: corner.includes("e") ? "-7px" : undefined,
                      top: corner.includes("n") ? "-7px" : undefined,
                      bottom: corner.includes("s") ? "-7px" : undefined,
                      cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                      touchAction: "none",
                    }}
                  />
                ))}
              </div>
            )}

            {hotspots.map((h) => (
              <button
                key={h.id}
                onPointerDown={(e) => onPinPointerDown(e, h.id)}
                onPointerMove={onPinPointerMove}
                onPointerUp={onPinPointerUp}
                title={h.label}
                aria-label={h.label}
                className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center"
                style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, touchAction: "none" }}
              >
                <span
                  className={`block rounded-full transition-all ${dotClasses(h)} ${
                    h.id === selectedId ? "h-5 w-5 ring-2 ring-indigo-500" : "h-4 w-4"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={addHotspot}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              + Add hotspot
            </button>
            <span className="text-xs text-neutral-500">
              Drag a dot to reposition. Drag the box edges or corners to reshape it.
            </span>
            <button
              onClick={remove}
              className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Delete image
            </button>
          </div>
        </div>

        <div className="lg:w-2/5">
          {!selected && (
            <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
              {hotspots.length === 0
                ? "No hotspots yet. Use “AI: propose hotspots”, or place your own dots and then “AI: fill empty hotspots”."
                : "Select a dot to edit its words."}
            </p>
          )}
          {selected && (
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-2">
                <input
                  value={selected.label}
                  onChange={(e) => patchHotspot(selected.id, { label: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 font-medium"
                />
                <button
                  onClick={() => deleteHotspot(selected.id)}
                  className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-xs text-neutral-500">Dot:</span>
                <div className="flex overflow-hidden rounded-lg border border-neutral-300 text-xs">
                  {(["light", "dark"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => patchHotspot(selected.id, { dotColor: c })}
                      className={`px-2.5 py-1 ${
                        selected.dotColor === c
                          ? "bg-neutral-900 text-white"
                          : "bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {c === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
                {selected.box ? (
                  <button
                    onClick={() => patchHotspot(selected.id, { box: null })}
                    className="text-xs text-neutral-500 underline hover:text-neutral-800"
                  >
                    Remove box
                  </button>
                ) : (
                  <button onClick={addBox} className="text-xs text-indigo-700 underline">
                    Add box
                  </button>
                )}
              </div>

              {POS_KEYS.map((pos) => (
                <div key={pos} className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{POS_LABELS[pos]}</h3>
                    <button
                      onClick={() => addWord(pos)}
                      className="text-xs text-indigo-700 hover:underline"
                    >
                      + word
                    </button>
                  </div>
                  <div className="mt-1 flex flex-col gap-1.5">
                    {selected.words[pos].map((w, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          value={w.word}
                          onChange={(e) => patchWord(pos, i, { word: e.target.value })}
                          placeholder="word"
                          className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm"
                        />
                        <input
                          value={w.gloss}
                          onChange={(e) => patchWord(pos, i, { gloss: e.target.value })}
                          placeholder="kid-friendly meaning"
                          className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                        />
                        <input
                          value={w.related.join(", ")}
                          onChange={(e) =>
                            patchWord(pos, i, {
                              related: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="related, words"
                          className="w-32 rounded border border-neutral-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => removeWord(pos, i)}
                          aria-label="Remove word"
                          className="px-1 text-neutral-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selected.words[pos].length === 0 && (
                      <p className="text-xs text-neutral-400">
                        No {POS_LABELS[pos].toLowerCase()} yet.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
