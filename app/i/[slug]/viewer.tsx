"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  POS_KEYS,
  POS_LABELS,
  type Hotspot,
  type ImageRecord,
  type PosKey,
} from "@/lib/types";

type Props = { image: ImageRecord; hotspots: Hotspot[] };
type TrayGroup = { label: string; words: string[] };

export default function Viewer({ image, hotspots }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<PosKey | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [tray, setTray] = useState<TrayGroup[]>([]);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [dragged, setDragged] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const open = hotspots.find((h) => h.id === openId) ?? null;

  function openHotspot(h: Hotspot) {
    if (openId === h.id) return close();
    setOpenId(h.id);
    setTab(null);
    setPicked(null);
    setDragged(false);
    setPos(null);
  }
  function close() {
    setOpenId(null);
    setTab(null);
    setPicked(null);
    setPos(null);
  }

  // Position the card outside the hotspot's bounding box, on the side with most room.
  useLayoutEffect(() => {
    if (!open || dragged) return;
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const pw = card.offsetWidth;
    const ph = card.offsetHeight;
    const GAP = 12;
    const anchor = open.box
      ? {
          left: open.box.x * W,
          top: open.box.y * H,
          right: (open.box.x + open.box.w) * W,
          bottom: (open.box.y + open.box.h) * H,
        }
      : {
          left: open.x * W - 16,
          top: open.y * H - 16,
          right: open.x * W + 16,
          bottom: open.y * H + 16,
        };
    const pinY = open.y * H;
    const candidates = [
      { left: anchor.right + GAP, top: pinY - 20, space: W - anchor.right },
      { left: anchor.left - GAP - pw, top: pinY - 20, space: anchor.left },
      { left: open.x * W - pw / 2, top: anchor.bottom + GAP, space: H - anchor.bottom },
      { left: open.x * W - pw / 2, top: anchor.top - GAP - ph, space: anchor.top },
    ];
    const fitting = candidates.filter(
      (c) => c.space >= (c === candidates[0] || c === candidates[1] ? pw : ph) + GAP,
    );
    const best = (fitting[0] ?? candidates.sort((a, b) => b.space - a.space)[0]);
    setPos({
      left: Math.round(Math.min(Math.max(best.left, 8), Math.max(8, W - pw - 8))),
      top: Math.round(Math.min(Math.max(best.top, 8), Math.max(8, H - ph - 8))),
    });
  }, [open, tab, picked, dragged]);

  function onCardPointerDown(e: React.PointerEvent) {
    if (!pos) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.left, dy: e.clientY - pos.top };
  }
  function onCardPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setDragged(true);
    setPos({ left: e.clientX - drag.current.dx, top: e.clientY - drag.current.dy });
  }
  function onCardPointerUp() {
    drag.current = null;
  }

  function inTray(label: string, word: string): boolean {
    return tray.some((g) => g.label === label && g.words.includes(word));
  }
  function addToTray(label: string, word: string) {
    if (inTray(label, word)) return;
    setTray((t) => {
      const i = t.findIndex((g) => g.label === label);
      if (i === -1) return [...t, { label, words: [word] }];
      return t.map((g, j) => (j === i ? { ...g, words: [...g.words, word] } : g));
    });
  }
  function removeFromTray(label: string, word: string) {
    setTray((t) =>
      t
        .map((g) => (g.label === label ? { ...g, words: g.words.filter((w) => w !== word) } : g))
        .filter((g) => g.words.length > 0),
    );
  }

  async function copyTray() {
    const text = tray.map((g) => `${g.label}: ${g.words.join(", ")}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return;
    } catch {
      // fall through to the legacy path (older iPads, stricter contexts)
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) setCopied(true);
    else window.prompt("Copy your words:", text);
  }
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const total = tray.reduce((n, g) => n + g.words.length, 0);
  const pickedWord = open && tab && picked !== null ? open.words[tab][picked] : null;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="text-lg font-medium">{image.title}</h1>
      <p className="mb-3 text-sm text-neutral-500">
        Tap a dot on the picture to get word ideas. Collect words you like, then use them in
        your writing.
      </p>

      <div className="text-center">
        <div ref={wrapRef} className="relative inline-block select-none" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.filePath}
            alt={image.title}
            className="h-auto max-h-[68vh] w-auto max-w-full rounded-xl"
            draggable={false}
          />
          {hotspots.map((h) => (
            <button
              key={h.id}
              onClick={(e) => {
                e.stopPropagation();
                openHotspot(h);
              }}
              aria-label={h.label}
              className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
            >
              <span
                className={`block rounded-full transition-all ${
                  h.dotColor === "dark"
                    ? "bg-neutral-900/90 ring-1 ring-white/70"
                    : "bg-white/95 ring-1 ring-black/40"
                } ${h.id === openId ? "h-5 w-5 ring-2 ring-indigo-500" : "h-4 w-4 hover:h-5 hover:w-5"}`}
              />
            </button>
          ))}

          {open && (
            <div
              ref={cardRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute z-10 w-56 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-lg"
              style={pos ? { left: pos.left, top: pos.top } : { left: 8, top: 8, visibility: "hidden" }}
            >
              <div
                onPointerDown={onCardPointerDown}
                onPointerMove={onCardPointerMove}
                onPointerUp={onCardPointerUp}
                className="flex cursor-grab items-center justify-between gap-2"
                style={{ touchAction: "none" }}
              >
                <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">
                  {open.label}
                </span>
                <button
                  onClick={close}
                  aria-label="Close"
                  className="rounded px-1.5 text-neutral-400 hover:text-neutral-700"
                >
                  ×
                </button>
              </div>

              <div className="mt-2 flex gap-1">
                {POS_KEYS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setTab(p);
                      setPicked(null);
                    }}
                    className={`rounded-md px-2 py-0.5 text-xs ${
                      tab === p
                        ? "bg-neutral-100 font-medium text-neutral-900 ring-1 ring-neutral-300"
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    {POS_LABELS[p]}
                  </button>
                ))}
              </div>

              {!tab && <p className="mt-2 text-xs text-neutral-400">Pick a word type.</p>}

              {tab && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {open.words[tab].map((w, i) => (
                    <button
                      key={i}
                      onClick={() => setPicked(picked === i ? null : i)}
                      className={`rounded-full border px-2 py-0.5 text-[13px] ${
                        picked === i
                          ? "border-neutral-400 bg-neutral-100 font-medium"
                          : "border-neutral-200 hover:border-neutral-400"
                      }`}
                    >
                      {w.word}
                      {inTray(open.label, w.word) && " ✓"}
                    </button>
                  ))}
                  {open.words[tab].length === 0 && (
                    <p className="text-xs text-neutral-400">No words here yet.</p>
                  )}
                </div>
              )}

              {pickedWord && (
                <div className="mt-2 rounded-lg bg-neutral-50 p-2">
                  <p className="text-[13px] text-neutral-600">{pickedWord.gloss}</p>
                  <button
                    onClick={() => addToTray(open.label, pickedWord.word)}
                    disabled={inTray(open.label, pickedWord.word)}
                    className="mt-1.5 rounded-md bg-neutral-900 px-2 py-1 text-xs text-white hover:bg-neutral-700 disabled:opacity-40"
                  >
                    {inTray(open.label, pickedWord.word) ? "Added ✓" : "+ Add to my words"}
                  </button>
                  {pickedWord.related.length > 0 && (
                    <div className="mt-2 border-t border-neutral-200 pt-1.5">
                      <p className="text-[11px] text-neutral-400">more like this — tap to collect:</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {pickedWord.related.map((r) => (
                          <button
                            key={r}
                            onClick={() => addToTray(open.label, r)}
                            disabled={inTray(open.label, r)}
                            className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:border-neutral-500 disabled:border-solid disabled:opacity-50"
                          >
                            {inTray(open.label, r) ? `${r} ✓` : `+ ${r}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 p-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">My words</span>
          <span className="text-xs text-neutral-400">{total} collected</span>
          {total > 0 && (
            <button
              onClick={copyTray}
              className="ml-auto rounded-lg border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50"
            >
              {copied ? "Copied ✓" : "Copy all"}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tray.length === 0 && (
            <p className="text-sm text-neutral-400">
              Words you collect will gather here in sets, one for each part of the picture.
            </p>
          )}
          {tray.map((g) => (
            <span
              key={g.label}
              className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-neutral-100 p-1.5"
            >
              <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">
                {g.label}
              </span>
              {g.words.map((w) => (
                <button
                  key={w}
                  onClick={() => removeFromTray(g.label, w)}
                  title="Remove"
                  className="rounded-full bg-white px-2 py-0.5 text-[13px] hover:bg-neutral-50"
                >
                  {w} <span className="text-neutral-400">×</span>
                </button>
              ))}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
