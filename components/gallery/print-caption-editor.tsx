"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  bakePrintCaption,
  captionBand,
  fontById,
  HANDWRITING_FONTS,
  isCaptionFrame,
  type PrintCaption,
} from "@/lib/frames/caption";
import { frameLayout, resolveOrientation, type FrameId, type FrameOrientation } from "@/lib/frames/film";
import type { CaptureRecord } from "@/lib/storage/records";

const DEFAULT_CAPTION: PrintCaption = {
  text: "",
  fontId: "caveat",
  includeDate: true,
  x: 0.5,
  y: 0.55,
};

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
  const [draft, setDraft] = useState<PrintCaption>(record.metadata.caption ?? DEFAULT_CAPTION);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    setDraft(record.metadata.caption ?? DEFAULT_CAPTION);
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

  function moveTo(clientX: number, clientY: number) {
    const node = stageRef.current;
    if (!node || !band) return;
    const rect = node.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const x = (px - band.left) / band.width;
    const y = (py - band.top) / band.height;
    setDraft((current) => ({
      ...current,
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    }));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!band) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX, event.clientY);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    moveTo(event.clientX, event.clientY);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
  const dateLabel = draft.includeDate
    ? new Date(record.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-paper/10 bg-panel p-3">
      <div>
        <p className="font-mono text-[10px] tracking-[0.16em] text-paper/55 uppercase">Write on print</p>
        <p className="mt-1 text-xs text-paper/55">Drag the text on the white border. Handwriting is saved into the photo.</p>
      </div>
      <div
        ref={stageRef}
        className="relative touch-none overflow-hidden bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {baseUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={baseUrl} alt="" className="pointer-events-none block w-full select-none" draggable={false} />
        ) : null}
        {band ? (
          <div
            className="pointer-events-none absolute border border-dashed border-sage/50 bg-sage/5"
            style={{
              left: `${band.left * 100}%`,
              top: `${band.top * 100}%`,
              width: `${band.width * 100}%`,
              height: `${band.height * 100}%`,
            }}
          >
            <div
              className="absolute max-w-[90%] -translate-x-1/2 -translate-y-1/2 px-1 text-center text-[#2a2824]"
              style={{
                left: `${draft.x * 100}%`,
                top: `${draft.y * 100}%`,
                fontFamily: font.family,
                fontSize: "clamp(14px, 4.2vw, 28px)",
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
          style={{ fontFamily: font.family }}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {HANDWRITING_FONTS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={draft.fontId === item.id}
            className={`min-h-9 rounded-full border px-3 text-sm ${draft.fontId === item.id ? "border-sage bg-paper text-ink" : "border-paper/15"}`}
            style={{ fontFamily: item.family }}
            onClick={() => setDraft((current) => ({ ...current, fontId: item.id }))}
          >
            {item.name}
          </button>
        ))}
      </div>
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
