"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  anchorStyle,
  anchorToPoint,
  bakePrintCaption,
  CAPTION_ANCHORS,
  CAPTION_SIZE_DEFAULT,
  CAPTION_SIZE_MAX,
  CAPTION_SIZE_MIN,
  captionBand,
  clamp01,
  fontById,
  HANDWRITING_FONTS,
  isCaptionFrame,
  normalizeCaption,
  type CaptionAnchor,
  type CaptionPlacement,
  type PrintCaption,
} from "@/lib/frames/caption";
import { frameLayout, resolveOrientation, type FrameId, type FrameOrientation } from "@/lib/frames/film";
import type { CaptureRecord } from "@/lib/storage/records";
import { AnchorIcon, FreehandIcon, TextSizeIcon } from "@/components/camera/icons";

const DEFAULT_CAPTION = normalizeCaption({
  text: "",
  fontId: "caveat",
  includeDate: true,
  placement: "anchor",
  anchor: "bottom-center",
  size: CAPTION_SIZE_DEFAULT,
});

export function PrintCaptionEditor({
  record,
  onApplied,
}: {
  record: CaptureRecord;
  onApplied: (next: CaptureRecord) => void;
}) {
  const frameId = record.metadata.frameId;
  const orientation = record.metadata.frameOrientation ?? "auto";
  const editable = record.kind === "photo" && isCaptionFrame(frameId);
  const [draft, setDraft] = useState<PrintCaption>(normalizeCaption(record.metadata.caption));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(normalizeCaption(record.metadata.caption));
  }, [record.id, record.metadata.caption]);

  useEffect(() => {
    const base = record.printBase ?? record.graded;
    const url = URL.createObjectURL(base);
    setBaseUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [record.id, record.printBase, record.graded]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [editable, baseUrl]);

  const band = useMemo(() => {
    if (!editable || !frameId || size.width < 2) return null;
    const layout = frameLayout(frameId, resolveOrientation(orientation as FrameOrientation, size.width, size.height));
    return layout ? captionBand(layout) : null;
  }, [editable, frameId, orientation, size.height, size.width]);

  if (!editable || !frameId) return null;

  function setPlacement(placement: CaptionPlacement) {
    setDraft((current) => {
      if (placement === "freehand" && current.placement !== "freehand") {
        const point = anchorToPoint(current.anchor);
        return { ...current, placement, x: point.x, y: point.y };
      }
      return { ...current, placement };
    });
  }

  function moveFreehand(clientX: number, clientY: number) {
    const node = bandRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    setDraft((current) => ({
      ...current,
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    }));
  }

  function onBandPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (draft.placement !== "freehand") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    moveFreehand(event.clientX, event.clientY);
  }

  function onBandPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || draft.placement !== "freehand") return;
    moveFreehand(event.clientX, event.clientY);
  }

  function onBandPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingRef.current = false;
  }

  async function apply() {
    const base = record.printBase ?? record.graded;
    setBusy(true);
    setNotice(null);
    try {
      const captioned = await bakePrintCaption(base, frameId as FrameId, orientation as FrameOrientation, draft, record.createdAt);
      const thumbBitmap = await createImageBitmap(captioned);
      const scale = Math.min(1, 360 / Math.max(thumbBitmap.width, thumbBitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(thumbBitmap.width * scale));
      canvas.height = Math.max(2, Math.round(thumbBitmap.height * scale));
      canvas.getContext("2d")?.drawImage(thumbBitmap, 0, 0, canvas.width, canvas.height);
      thumbBitmap.close();
      const thumbnail = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("thumb"))), "image/jpeg", 0.85);
      });
      onApplied({
        ...record,
        graded: captioned,
        printBase: record.printBase ?? record.graded,
        thumbnail,
        metadata: {
          ...record.metadata,
          caption: draft,
          gradedNote: `${record.metadata.gradedNote.replace(/ Handwriting saved on the print\./g, "")} Handwriting saved on the print.`,
        },
      });
      setNotice("Caption saved on the print.");
    } catch {
      setNotice("The caption could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function clearCaption() {
    const base = record.printBase;
    if (!base) {
      setDraft(DEFAULT_CAPTION);
      return;
    }
    setBusy(true);
    try {
      const thumbBitmap = await createImageBitmap(base);
      const scale = Math.min(1, 360 / Math.max(thumbBitmap.width, thumbBitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(thumbBitmap.width * scale));
      canvas.height = Math.max(2, Math.round(thumbBitmap.height * scale));
      canvas.getContext("2d")?.drawImage(thumbBitmap, 0, 0, canvas.width, canvas.height);
      thumbBitmap.close();
      const thumbnail = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("thumb"))), "image/jpeg", 0.85);
      });
      setDraft(DEFAULT_CAPTION);
      onApplied({
        ...record,
        graded: base,
        thumbnail,
        metadata: { ...record.metadata, caption: null },
      });
      setNotice("Caption cleared.");
    } catch {
      setNotice("The caption could not be cleared.");
    } finally {
      setBusy(false);
    }
  }

  const font = fontById(draft.fontId);
  const freehand = draft.placement === "freehand";
  const place = freehand
    ? { left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, transform: "translate(-50%, -50%)", textAlign: "center" as const }
    : anchorStyle(draft.anchor);
  const previewPx = Math.round(18 * draft.size);
  const dateLabel = draft.includeDate
    ? new Date(record.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-paper/10 bg-panel p-3">
      <div>
        <p className="font-mono text-[10px] tracking-[0.16em] text-paper/55 uppercase">Write on print</p>
        <p className="mt-1 text-xs text-paper/55">Choose handwriting, size, and where the note sits on the white border.</p>
      </div>
      <div ref={stageRef} className="relative overflow-hidden bg-black">
        {baseUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={baseUrl} alt="" className="pointer-events-none block w-full select-none" draggable={false} />
        ) : null}
        {band ? (
          <div
            ref={bandRef}
            className={`absolute border border-dashed border-sage/40 bg-sage/5 ${
              freehand ? "cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none"
            }`}
            style={{
              left: `${band.left * 100}%`,
              top: `${band.top * 100}%`,
              width: `${band.width * 100}%`,
              height: `${band.height * 100}%`,
            }}
            onPointerDown={onBandPointerDown}
            onPointerMove={onBandPointerMove}
            onPointerUp={onBandPointerUp}
            onPointerCancel={onBandPointerUp}
          >
            <div
              className={`absolute max-w-[92%] px-2 text-[#2a2824] ${freehand ? "pointer-events-none select-none" : ""}`}
              style={{
                left: place.left,
                top: place.top,
                transform: place.transform,
                textAlign: place.textAlign,
                fontFamily: font.css,
                fontSize: `${Math.max(12, Math.min(42, previewPx))}px`,
                lineHeight: 1.15,
              }}
            >
              {draft.text.trim() || "Your note"}
              {dateLabel ? <span className="mt-0.5 block text-[0.75em] opacity-80">{dateLabel}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
      <label className="flex flex-col gap-1 text-xs text-paper/60">
        Note
        <textarea
          value={draft.text}
          maxLength={120}
          rows={2}
          placeholder="Write something…"
          className="min-h-16 rounded-lg border border-paper/15 bg-ink px-3 py-2 text-sm text-paper"
          style={{ fontFamily: font.css }}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
        />
      </label>
      <div>
        <p className="mb-1.5 font-mono text-[10px] tracking-widest text-paper/45 uppercase">Handwriting</p>
        <div className="flex flex-wrap gap-1.5">
          {HANDWRITING_FONTS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={draft.fontId === item.id}
              className={`min-h-9 rounded-full border px-3 text-sm ${draft.fontId === item.id ? "border-sage bg-paper text-ink" : "border-paper/15"}`}
              style={{ fontFamily: item.css }}
              onClick={() => setDraft((current) => ({ ...current, fontId: item.id }))}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-paper/45 uppercase">
            <TextSizeIcon className="h-3.5 w-3.5" />
            Size
          </p>
          <span className="font-mono text-[10px] text-paper/55">{Math.round(draft.size * 100)}%</span>
        </div>
        <input
          aria-label="Caption size"
          type="range"
          min={CAPTION_SIZE_MIN}
          max={CAPTION_SIZE_MAX}
          step={0.05}
          value={draft.size}
          className="h-8 w-full accent-sage"
          onChange={(event) => setDraft((current) => ({ ...current, size: Number(event.target.value) }))}
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-paper/40 uppercase">
          <span>S</span>
          <span>M</span>
          <span>L</span>
        </div>
      </div>
      <div>
        <p className="mb-1.5 font-mono text-[10px] tracking-widest text-paper/45 uppercase">Place</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={!freehand}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-full border text-sm ${
              !freehand ? "border-sage bg-paper text-ink" : "border-paper/15"
            }`}
            onClick={() => setPlacement("anchor")}
          >
            <AnchorIcon anchor="center" className="h-4 w-4" />
            Anchor
          </button>
          <button
            type="button"
            aria-pressed={freehand}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-full border text-sm ${
              freehand ? "border-sage bg-paper text-ink" : "border-paper/15"
            }`}
            onClick={() => setPlacement("freehand")}
          >
            <FreehandIcon className="h-4 w-4" />
            Freehand
          </button>
        </div>
      </div>
      {freehand ? (
        <p className="text-xs text-paper/55">Drag the note on the white border to place it.</p>
      ) : (
        <div>
          <p className="mb-1.5 font-mono text-[10px] tracking-widest text-paper/45 uppercase">Anchor</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CAPTION_ANCHORS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={draft.anchor === item.id}
                title={item.label}
                className={`grid h-11 place-items-center rounded-md border ${
                  draft.anchor === item.id ? "border-sage bg-paper text-ink" : "border-paper/15 text-paper/80"
                }`}
                onClick={() => setDraft((current) => ({ ...current, anchor: item.id as CaptionAnchor }))}
              >
                <AnchorIcon anchor={item.id} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.includeDate}
          onChange={(event) => setDraft((current) => ({ ...current, includeDate: event.target.checked }))}
          className="accent-sage"
        />
        Include the capture date
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="min-h-10 rounded-full bg-paper px-4 text-sm text-ink disabled:opacity-40" onClick={() => void apply()}>
          {busy ? "Saving…" : "Save on print"}
        </button>
        <button type="button" disabled={busy} className="min-h-10 rounded-full border border-paper/15 px-4 text-sm disabled:opacity-40" onClick={() => void clearCaption()}>
          Clear
        </button>
      </div>
      {notice ? <p className="text-xs text-sage">{notice}</p> : null}
    </section>
  );
}
