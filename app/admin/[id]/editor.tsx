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
    let data: Record<string, unknown> | null = null;
    try {
      data = await res.json();
    } catch {
      // non-JSON error page (e.g. a platform timeout) — fall through
    }
    if (!res.ok || !data) {
      const hint =
        res.status === 504
          ? "The server timed out — AI analysis may exceed your hosting plan's function time limit."
          : `Request failed (server error ${res.status})`;
      throw new Error(String(data?.error ?? hint));
    }
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
      router.push("/admin");
      return "Deleted.";
    });

  const shareUrl = shareSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/i/${shareSlug}`
    : null;

  const dotStyle = (h: Hotspot, isSelected: boolean): React.CSSProperties => {
    const light = h.dotColor !== "dark";
    const ring = light
      ? "0 0 0 1.5px rgba(28,36,30,0.45)"
      : "0 0 0 1.5px rgba(255,253,248,0.75)";
    return {
      width: isSelected ? 18 : 13,
      height: isSelected ? 18 : 13,
      background: light ? "rgba(255,253,248,0.95)" : "rgba(28,36,30,0.92)",
      boxShadow:
        ring +
        (isSelected
          ? ", 0 0 0 4px rgba(94,158,130,0.65)"
          : ", 0 2px 6px rgba(0,0,0,0.35)"),
    };
  };

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin" className="text-sm text-muted hover:underline">
          ← Images
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-border-stronger bg-ivory px-3 py-1.5 font-serif text-ink"
        />
        <button
          onClick={analyzeAuto}
          disabled={busy !== null}
          className="rounded-full bg-green px-3.5 py-1.5 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
        >
          {busy === "auto" ? "Analyzing…" : "AI: propose hotspots"}
        </button>
        <button
          onClick={analyzeGuided}
          disabled={busy !== null || emptyCount === 0}
          title="The AI looks at each dot that has no words yet and writes its label, box and words. Hotspots that already have words are left alone."
          className="rounded-full border border-border-stronger bg-ivory px-3.5 py-1.5 text-sm font-semibold text-green-dark hover:bg-page disabled:opacity-50"
        >
          {busy === "guided"
            ? "Filling…"
            : `AI: fill empty hotspots${emptyCount > 0 ? ` (${emptyCount})` : ""}`}
        </button>
        <button
          onClick={save}
          disabled={busy !== null}
          className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          onClick={togglePublish}
          disabled={busy !== null}
          className="rounded-full border border-border-stronger bg-ivory px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-page disabled:opacity-50"
        >
          {published ? "Unpublish" : "Publish"}
        </button>
      </div>

      {(busy === "auto" || busy === "guided") && (
        <p className="mt-2 text-sm text-muted">
          The AI is looking at the picture — this takes a minute or so.
        </p>
      )}
      {message && <p className="mt-2 text-sm text-ink-2">{message}</p>}
      {published && shareUrl && (
        <p className="mt-2 text-sm text-ink-2">
          Student link:{" "}
          <a href={shareUrl} target="_blank" className="text-green underline">
            {shareUrl}
          </a>{" "}
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="ml-1 rounded-full border border-border-stronger bg-ivory px-2.5 py-0.5 text-xs font-semibold hover:bg-page"
          >
            Copy
          </button>
        </p>
      )}

      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-3/5">
          <div ref={imgWrapRef} className="relative inline-block w-full select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.filePath}
              alt={title}
              className="w-full rounded-[10px]"
              style={{ boxShadow: "0 2px 8px rgba(38,53,46,0.18), 0 16px 40px rgba(38,53,46,0.22)" }}
              draggable={false}
            />

            {selected?.box && (
              <div
                onPointerDown={(e) => onBoxPointerDown(e, "move")}
                onPointerMove={onBoxPointerMove}
                onPointerUp={onBoxPointerUp}
                className="absolute cursor-move rounded border-2 border-green/90"
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
                    className="absolute h-3.5 w-3.5 rounded-full border-2 border-ivory bg-green"
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
                className="absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center"
                style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, touchAction: "none" }}
              >
                <span
                  className="block rounded-full transition-all duration-[180ms]"
                  style={dotStyle(h, h.id === selectedId)}
                />
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={addHotspot}
              className="rounded-full border border-border-stronger bg-ivory px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-page"
            >
              + Add hotspot
            </button>
            <span className="text-xs text-muted">
              Drag a dot to reposition. Drag the box edges or corners to reshape it.
            </span>
            <button
              onClick={remove}
              className="ml-auto rounded-full border border-red-200 px-3.5 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Delete image
            </button>
          </div>
        </div>

        <div className="lg:w-2/5">
          {!selected && (
            <p className="rounded-[14px] border border-dashed border-border-stronger p-6 text-sm text-muted">
              {hotspots.length === 0
                ? "No hotspots yet. Use “AI: propose hotspots”, or place your own dots and then “AI: fill empty hotspots”."
                : "Select a dot to edit its words."}
            </p>
          )}
          {selected && (
            <div className="rounded-[14px] border border-border-strong bg-surface p-4">
              <div className="flex items-center gap-2">
                <input
                  value={selected.label}
                  onChange={(e) => patchHotspot(selected.id, { label: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-border-stronger bg-ivory px-3 py-1.5 font-serif text-ink"
                />
                <button
                  onClick={() => deleteHotspot(selected.id)}
                  className="rounded-full border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-2">
                  Dot
                </span>
                <div className="flex overflow-hidden rounded-full border border-border-stronger text-xs">
                  {(["light", "dark"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => patchHotspot(selected.id, { dotColor: c })}
                      className={`px-2.5 py-1 font-semibold ${
                        selected.dotColor === c
                          ? "bg-ink text-surface"
                          : "bg-ivory text-ink-2 hover:bg-page"
                      }`}
                    >
                      {c === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
                {selected.box ? (
                  <button
                    onClick={() => patchHotspot(selected.id, { box: null })}
                    className="text-xs text-muted underline hover:text-ink"
                  >
                    Remove box
                  </button>
                ) : (
                  <button onClick={addBox} className="text-xs text-green underline">
                    Add box
                  </button>
                )}
              </div>

              {POS_KEYS.map((pos) => (
                <div key={pos} className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-2">
                      {POS_LABELS[pos]}
                    </h3>
                    <button
                      onClick={() => addWord(pos)}
                      className="text-xs text-green hover:underline"
                    >
                      + word
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {selected.words[pos].map((w, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          value={w.word}
                          onChange={(e) => patchWord(pos, i, { word: e.target.value })}
                          placeholder="word"
                          className="w-28 rounded-[7px] border border-border-soft bg-ivory px-2 py-1 font-serif text-sm text-ink"
                          style={{ boxShadow: "0 1px 2px rgba(38,53,46,0.1)" }}
                        />
                        <input
                          value={w.gloss}
                          onChange={(e) => patchWord(pos, i, { gloss: e.target.value })}
                          placeholder="kid-friendly meaning"
                          className="min-w-0 flex-1 rounded-[7px] border border-border-soft bg-ivory px-2 py-1 text-sm text-ink-2"
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
                          className="w-32 rounded-[7px] border border-border-soft bg-ivory px-2 py-1 text-sm text-ink-2"
                        />
                        <button
                          onClick={() => removeWord(pos, i)}
                          aria-label="Remove word"
                          className="px-1 text-muted hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selected.words[pos].length === 0 && (
                      <p className="text-xs text-muted">
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
