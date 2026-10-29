"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { deleteCapture, getCapture, listCaptures, updateCapture } from "@/lib/storage/db";
import type { CaptureRecord } from "@/lib/storage/records";
import { isCaptionFrame } from "@/lib/frames/caption";
import { PrintCaptionEditor } from "./print-caption-editor";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function share(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!nav.share || (nav.canShare && !nav.canShare({ files: [file] }))) return false;
  await nav.share({ files: [file], title: filename });
  return true;
}

export function ReviewView({ id }: { id: string }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [record, setRecord] = useState<CaptureRecord | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const axisRef = useRef<"x" | "y" | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => ids.indexOf(id), [ids, id]);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < ids.length - 1;

  useEffect(() => {
    let cancelled = false;
    listCaptures()
      .then((records) => {
        if (!cancelled) setIds(records.map((item) => item.id));
      })
      .catch(() => {
        if (!cancelled) setIds([id]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setMissing(false);
    setConfirming(false);
    setNotice(null);
    setDragX(0);
    setShowOriginal(false);
    getCapture(id)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setMissing(true);
          setRecord(null);
          return;
        }
        setRecord(found);
      })
      .catch(() => {
        if (!cancelled) setNotice("This capture could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!record) {
      setUrl(null);
      return;
    }
    const blob = showOriginal && record.original ? record.original : record.graded;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [record, showOriginal]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && hasPrev) {
        event.preventDefault();
        go(-1);
      }
      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        go(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function go(delta: number) {
    const nextId = ids[index + delta];
    if (!nextId) return;
    setDragX(0);
    setDragging(false);
    startRef.current = null;
    axisRef.current = null;
    router.replace(`/gallery/${nextId}`);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    axisRef.current = null;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!axisRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisRef.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }
    if (axisRef.current !== "x") return;
    event.preventDefault();
    const max = mediaRef.current?.clientWidth ?? 320;
    const limited =
      dx > 0 && !hasPrev ? dx * 0.25 : dx < 0 && !hasNext ? dx * 0.25 : dx;
    setDragX(Math.max(-max, Math.min(max, limited)));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const width = mediaRef.current?.clientWidth ?? 320;
    const threshold = Math.min(88, width * 0.18);
    const axis = axisRef.current;
    const dx = dragX;
    startRef.current = null;
    axisRef.current = null;
    setDragging(false);
    if (axis === "x" && dx > threshold && hasPrev) {
      go(-1);
      return;
    }
    if (axis === "x" && dx < -threshold && hasNext) {
      go(1);
      return;
    }
    setDragX(0);
  }

  async function persist(next: CaptureRecord) {
    setRecord(next);
    try {
      await updateCapture(next);
    } catch {
      setNotice("The photo could not be updated.");
    }
  }

  async function toggleFavorite() {
    if (!record) return;
    await persist({ ...record, favorite: !record.favorite });
  }

  async function remove() {
    await deleteCapture(id);
    const fallback = ids[index + 1] ?? ids[index - 1];
    window.location.href = fallback ? `/gallery/${fallback}` : "/gallery";
  }

  if (missing) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink text-paper">
        <div className="text-center">
          <p>That capture is not on this device.</p>
          <Link href="/gallery" className="mt-3 inline-block text-sage">
            Gallery
          </Link>
        </div>
      </main>
    );
  }

  const stamp = record ? new Date(record.createdAt).toISOString().replace(/[:.]/g, "-") : "capture";
  const viewingOriginal = Boolean(showOriginal && record?.original);
  const media = viewingOriginal ? record?.original : record?.graded;
  const canCaption = Boolean(record && !viewingOriginal && isCaptionFrame(record.metadata.frameId));

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <header className="flex items-center justify-between border-b border-paper/10 px-4 py-3">
        <Link href="/gallery" className="text-sm text-sage">
          Gallery
        </Link>
        <div className="text-center">
          <h1 data-testid="review-title" className="font-mono text-[11px] tracking-[0.16em] uppercase">
            {record?.lutName ?? "Capture"}
          </h1>
          {ids.length > 0 && index >= 0 ? (
            <p className="mt-0.5 font-mono text-[10px] tracking-widest text-paper/45">
              {index + 1} / {ids.length}
            </p>
          ) : null}
        </div>
        <Link href="/" className="text-sm">
          Camera
        </Link>
      </header>

      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative">
          <div
            ref={mediaRef}
            className="relative touch-pan-y overflow-hidden rounded-xl bg-black select-none"
            style={{ touchAction: "pan-y" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="will-change-transform"
              style={{
                transform: `translate3d(${dragX}px, 0, 0)`,
                transition: dragging ? "none" : "transform 180ms ease-out",
              }}
            >
              {record?.kind === "video" && url && !viewingOriginal ? (
                <video src={url} controls className="max-h-[70dvh] w-full" draggable={false} />
              ) : url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="max-h-[70dvh] w-full object-contain" draggable={false} />
              ) : (
                <div className="aspect-[3/2]" />
              )}
            </div>
            {hasPrev ? (
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute top-1/2 left-2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ink/55 text-lg text-paper/90 backdrop-blur"
                onClick={() => go(-1)}
              >
                ‹
              </button>
            ) : null}
            {hasNext ? (
              <button
                type="button"
                aria-label="Next photo"
                className="absolute top-1/2 right-2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ink/55 text-lg text-paper/90 backdrop-blur"
                onClick={() => go(1)}
              >
                ›
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-center font-mono text-[10px] tracking-widest text-paper/40 uppercase">
            Swipe for next photo
          </p>
        </div>

        {record && media ? (
          <aside className="flex flex-col gap-4 text-sm">
            <div className="rounded-xl border border-paper/10 bg-panel p-3">
              <p className="font-mono text-[10px] tracking-widest text-paper/50 uppercase">
                {new Date(record.createdAt).toLocaleString()}
              </p>
              <p className="mt-2">{record.metadata.exposureSummary}</p>
              <p className="mt-1 text-paper/70">
                Look {record.lutName} · {Math.round(record.intensity)}%
              </p>
              <p className="text-paper/70">White balance {record.metadata.whiteBalanceLabel}</p>
              <p className="text-paper/70">
                {record.metadata.width}×{record.metadata.height} · {record.originalSource}
              </p>
              {record.metadata.frameId && record.metadata.frameId !== "none" ? (
                <p className="mt-1 text-paper/70">
                  Frame {record.metadata.frameId} · {record.metadata.frameOrientation ?? "portrait"}
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-paper/55">{record.metadata.gradedNote}</p>
            </div>

            {canCaption ? <PrintCaptionEditor record={record} onApplied={(next) => void persist(next)} /> : null}

            <div className="flex flex-wrap gap-2">
              {record.original ? (
                <button type="button" className="min-h-10 rounded-full border border-paper/15 px-4" onClick={() => setShowOriginal((value) => !value)}>
                  {viewingOriginal ? "Graded" : "Original"}
                </button>
              ) : null}
              <button type="button" className="min-h-10 rounded-full border border-paper/15 px-4" onClick={() => void toggleFavorite()}>
                {record.favorite ? "Favorited" : "Favorite"}
              </button>
              <button
                type="button"
                className="min-h-10 rounded-full border border-paper/15 px-4"
                onClick={() => download(media, `camlut-${stamp}.${record.kind === "video" && !viewingOriginal ? "webm" : "jpg"}`)}
              >
                Save
              </button>
              <button
                type="button"
                className="min-h-10 rounded-full border border-paper/15 px-4"
                onClick={() =>
                  void share(media, `camlut-${stamp}`).then((shared) => {
                    if (!shared) setNotice("Sharing is not available in this browser. Use Save instead.");
                  })
                }
              >
                Share
              </button>
            </div>
            {confirming ? (
              <div className="flex gap-2">
                <button type="button" className="min-h-10 rounded-full border border-danger px-4 text-danger" onClick={() => void remove()}>
                  Delete
                </button>
                <button type="button" className="min-h-10 px-4" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="min-h-10 self-start text-paper/60" onClick={() => setConfirming(true)}>
                Delete
              </button>
            )}
            {notice ? <p className="text-xs text-amber">{notice}</p> : null}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
