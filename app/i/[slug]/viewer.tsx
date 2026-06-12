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
type TrayWord = { word: string; pos: string };
type TrayGroup = { label: string; words: TrayWord[] };

const MARKER: Record<PosKey, string> = { nouns: "n.", verbs: "v.", adjectives: "adj." };

const CARD_SHADOW = "0 2px 6px rgba(20,28,24,0.25), 0 18px 40px rgba(20,28,24,0.35)";
const IMAGE_SHADOW = "0 2px 8px rgba(38,53,46,0.18), 0 16px 40px rgba(38,53,46,0.22)";
const CHIP_SHADOW = "0 1px 2px rgba(38,53,46,0.1)";

export default function Viewer({ image, hotspots }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<PosKey | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [tray, setTray] = useState<TrayGroup[]>([]);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [dragged, setDragged] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const open = hotspots.find((h) => h.id === openId) ?? null;

  function openHotspot(h: Hotspot) {
    if (openId === h.id) return close();
    setOpenId(h.id);
    setTab(null);
    setPicked(null);
    setRelatedOpen(false);
    setDragged(false);
    setPos(null);
  }
  function close() {
    setOpenId(null);
    setTab(null);
    setPicked(null);
    setRelatedOpen(false);
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
    const best = fitting[0] ?? candidates.sort((a, b) => b.space - a.space)[0];
    setPos({
      left: Math.round(Math.min(Math.max(best.left, 8), Math.max(8, W - pw - 8))),
      top: Math.round(Math.min(Math.max(best.top, 8), Math.max(8, H - ph - 8))),
    });
  }, [open, tab, picked, relatedOpen, dragged]);

  function onCardPointerDown(e: React.PointerEvent) {
    if (!pos) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // pointer capture can fail mid-gesture — dragging still works
    }
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
    return tray.some((g) => g.label === label && g.words.some((w) => w.word === word));
  }

  // The collect animation: a decorative palette-chip clone flies from the tapped
  // control to the word's group in the tray. State lands on a timer, not on
  // animation events.
  function fly(source: HTMLElement, word: string, label: string, then: () => void) {
    const wrap = paletteRef.current;
    if (!wrap) return then();
    const start = source.getBoundingClientRect();
    const pal = wrap.getBoundingClientRect();
    let tx = pal.left + 32;
    let ty = pal.bottom - 30;
    const group = wrap.querySelector(`[data-group="${CSS.escape(label)}"]`);
    if (group) {
      const btns = group.querySelectorAll("button");
      const last = btns.length ? btns[btns.length - 1] : group;
      const r = last.getBoundingClientRect();
      tx = r.right + 10;
      ty = r.top + r.height / 2 - 12;
    } else {
      const groups = wrap.querySelectorAll("[data-group]");
      if (groups.length) {
        const r = groups[groups.length - 1].getBoundingClientRect();
        tx = r.right + 28;
        ty = r.top + 26;
      }
    }
    const el = document.createElement("span");
    el.textContent = word;
    el.style.cssText =
      "position:fixed;z-index:9999;pointer-events:none;font-family:var(--font-lora),serif;font-size:13.5px;" +
      "background:#2e5e4e;color:#f5f1ea;border-radius:999px;padding:4px 12px;" +
      `left:${start.left}px;top:${start.top}px;box-shadow:0 4px 14px rgba(0,0,0,0.3);`;
    document.body.appendChild(el);
    const dx = tx - start.left;
    const dy = ty - start.top;
    el.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        {
          transform: `translate(${dx * 0.5}px,${dy * 0.5 - 40}px) scale(1.05)`,
          opacity: 1,
          offset: 0.55,
        },
        { transform: `translate(${dx}px,${dy}px) scale(0.7)`, opacity: 0.4 },
      ],
      { duration: 620, easing: "cubic-bezier(0.3, 0.6, 0.35, 1)" },
    );
    setTimeout(() => el.remove(), 700);
    setTimeout(then, 540);
  }

  function addToTray(label: string, word: string, posMark: string, e: React.MouseEvent) {
    if (inTray(label, word)) return;
    fly(e.currentTarget as HTMLElement, word, label, () =>
      setTray((t) => {
        const i = t.findIndex((g) => g.label === label);
        const entry = { word, pos: posMark };
        setLastKey(`${label}|${word}`);
        if (i === -1) return [...t, { label, words: [entry] }];
        return t.map((g, j) => (j === i ? { ...g, words: [...g.words, entry] } : g));
      }),
    );
  }
  function removeFromTray(label: string, word: string) {
    setLastKey(null);
    setTray((t) =>
      t
        .map((g) =>
          g.label === label ? { ...g, words: g.words.filter((w) => w.word !== word) } : g,
        )
        .filter((g) => g.words.length > 0),
    );
  }

  async function copyTray() {
    const text = tray
      .map((g) => `${g.label}: ${g.words.map((w) => w.word).join(", ")}`)
      .join("\n");
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
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const total = tray.reduce((n, g) => n + g.words.length, 0);
  const pickedWord = open && tab && picked !== null ? open.words[tab][picked] : null;
  const pickedCollected =
    open && pickedWord ? inTray(open.label, pickedWord.word) : false;

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-6 pb-[72px] pt-9">
      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          Word Pictures
        </p>
        <h1 className="font-serif text-[28px] font-medium text-ink">{image.title}</h1>
        <p className="text-[13.5px] text-muted">
          Tap a dot on the picture for word ideas. Collect the ones you like, then copy
          them into your writing.
        </p>
      </header>

      <div className="text-center">
        <div
          ref={wrapRef}
          className="relative inline-block select-none leading-none"
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.filePath}
            alt={image.title}
            className="h-auto max-h-[68vh] w-auto max-w-full rounded-[10px]"
            style={{ boxShadow: IMAGE_SHADOW }}
            draggable={false}
          />
          {hotspots.map((h) => {
            const isOpen = h.id === openId;
            const light = h.dotColor !== "dark";
            const ring = light
              ? "0 0 0 1.5px rgba(28,36,30,0.45)"
              : "0 0 0 1.5px rgba(255,253,248,0.75)";
            return (
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
                  className="block rounded-full transition-all duration-[180ms]"
                  style={{
                    width: isOpen ? 18 : 13,
                    height: isOpen ? 18 : 13,
                    background: light ? "rgba(255,253,248,0.95)" : "rgba(28,36,30,0.92)",
                    boxShadow:
                      ring +
                      (isOpen
                        ? ", 0 0 0 4px rgba(94,158,130,0.65)"
                        : ", 0 2px 6px rgba(0,0,0,0.35)"),
                  }}
                />
              </button>
            );
          })}

          {open && (
            <div
              ref={cardRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute z-10 w-68 rounded-[14px] border border-[rgba(38,53,46,0.08)] bg-surface px-[15px] pb-[15px] pt-[13px] text-left leading-normal"
              style={{
                boxShadow: CARD_SHADOW,
                animation: "wp-pop 0.22s ease-out",
                ...(pos
                  ? { left: pos.left, top: pos.top }
                  : { left: 8, top: 8, visibility: "hidden" as const }),
              }}
            >
              <div
                onPointerDown={onCardPointerDown}
                onPointerMove={onCardPointerMove}
                onPointerUp={onCardPointerUp}
                className="flex cursor-grab items-center justify-between gap-2"
                style={{ touchAction: "none" }}
              >
                <span className="rounded-full bg-ink px-[11px] py-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-surface">
                  {open.label}
                </span>
                <button
                  onClick={close}
                  aria-label="Close"
                  className="px-1 text-[15px] leading-none text-muted hover:text-ink"
                >
                  ×
                </button>
              </div>

              <div className="mt-[11px] flex gap-3.5 border-b border-divider">
                {POS_KEYS.map((p) => {
                  const active = tab === p;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setTab(p);
                        setPicked(null);
                        setRelatedOpen(false);
                      }}
                      className={`-mb-px pb-1.5 text-[11px] uppercase tracking-[0.09em] ${
                        active
                          ? "border-b-2 border-green font-semibold text-ink"
                          : "border-b-2 border-transparent font-medium text-marker hover:text-ink-2"
                      }`}
                    >
                      {POS_LABELS[p]}
                    </button>
                  );
                })}
              </div>

              {!tab && (
                <p className="mb-0.5 mt-2.5 text-xs text-muted">Pick a word type to begin.</p>
              )}

              {tab && (
                <div className="mt-[11px] flex flex-wrap gap-[7px]">
                  {open.words[tab].map((w, i) => {
                    const isPicked = picked === i;
                    const collected = inTray(open.label, w.word);
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setPicked(isPicked ? null : i);
                          setRelatedOpen(false);
                        }}
                        className="rounded-[7px] px-[11px] py-1 font-serif text-sm transition-all duration-[120ms]"
                        style={{
                          background: collected ? "#2e5e4e" : "#fffdf8",
                          border: isPicked
                            ? "1px solid #26352e"
                            : collected
                              ? "1px solid transparent"
                              : "1px solid #e3dccd",
                          color: collected ? "#f5f1ea" : "#26352e",
                          boxShadow: CHIP_SHADOW,
                        }}
                      >
                        {w.word}
                        {collected ? " ✓" : ""}{" "}
                        <span
                          className="text-[10px] italic"
                          style={{
                            color: collected ? "rgba(245,241,234,0.6)" : "#98a097",
                          }}
                        >
                          {MARKER[tab]}
                        </span>
                      </button>
                    );
                  })}
                  {open.words[tab].length === 0 && (
                    <p className="text-xs text-muted">No words here yet.</p>
                  )}
                </div>
              )}

              {pickedWord && tab && (
                <div className="mt-[11px] rounded-[10px] bg-sunken px-3 py-[11px]">
                  <p className="font-serif text-sm text-ink">
                    {pickedWord.word}{" "}
                    <span className="text-[11px] italic text-muted">{MARKER[tab]}</span>
                  </p>
                  <p className="mt-1 text-[12.5px] leading-normal text-ink-2">
                    {pickedWord.gloss}
                  </p>
                  <button
                    onClick={(e) =>
                      open && addToTray(open.label, pickedWord.word, MARKER[tab], e)
                    }
                    disabled={pickedCollected}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150"
                    style={
                      pickedCollected
                        ? { background: "#d8e0d4", color: "#44604f", cursor: "default" }
                        : {
                            background: "#2e5e4e",
                            color: "#f5f1ea",
                            boxShadow: "0 1px 3px rgba(38,53,46,0.3)",
                          }
                    }
                  >
                    {pickedCollected ? "In your palette ✓" : "+ Add to palette"}
                  </button>

                  {pickedWord.related.length > 0 && (
                    <div className="mt-[11px] border-t border-border-strong pt-[9px]">
                      <button
                        onClick={() => setRelatedOpen(!relatedOpen)}
                        className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink-2"
                      >
                        {relatedOpen
                          ? "▾ more like this — tap to take"
                          : "▸ show more like this"}
                      </button>
                      {relatedOpen && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {pickedWord.related.map((r) => {
                            const collected = open ? inTray(open.label, r) : false;
                            return (
                              <button
                                key={r}
                                onClick={(e) =>
                                  open && addToTray(open.label, r, MARKER[tab], e)
                                }
                                disabled={collected}
                                className="rounded-full px-2.5 py-[3px] font-serif text-[13px] transition-all duration-[120ms]"
                                style={
                                  collected
                                    ? {
                                        background: "#2e5e4e",
                                        border: "1.5px solid #2e5e4e",
                                        color: "#f5f1ea",
                                      }
                                    : {
                                        background: "transparent",
                                        border: "1.5px dashed #9aab9f",
                                        color: "#44604f",
                                      }
                                }
                              >
                                {collected ? `${r} ✓` : `+ ${r}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        ref={paletteRef}
        className="rounded-xl border border-border-strong bg-palette px-5 py-4"
      >
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-base text-ink">My palette</span>
          <span className="text-xs text-muted">
            {total === 1 ? "1 word" : `${total} words`}
          </span>
          {total > 0 && (
            <button
              onClick={copyTray}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border-stronger bg-ivory px-3.5 py-[5px] text-xs font-semibold text-ink hover:bg-surface"
            >
              {copied ? "Copied ✓" : "Copy for my writing"}
            </button>
          )}
        </div>
        {total === 0 && (
          <p className="mb-0.5 mt-2.5 text-[13px] text-muted">
            Words you collect will gather here, one set for each part of the picture.
          </p>
        )}
        {total > 0 && (
          <div className="mt-3 flex flex-wrap gap-[18px]">
            {tray.map((g) => (
              <div key={g.label} data-group={g.label} className="flex flex-col gap-[7px]">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-2">
                  {g.label}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {g.words.map((w) => (
                    <button
                      key={w.word}
                      onClick={() => removeFromTray(g.label, w.word)}
                      title="Remove"
                      className="inline-flex items-center gap-[7px] rounded-full bg-green px-3 py-1 font-serif text-[13.5px] text-surface"
                      style={{
                        animation:
                          lastKey === `${g.label}|${w.word}`
                            ? "wp-pop 0.4s ease-out"
                            : "none",
                      }}
                    >
                      {w.word}{" "}
                      <span className="text-[10px] italic opacity-55">{w.pos}</span>
                      <span className="font-sans text-[10px] opacity-50">×</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
