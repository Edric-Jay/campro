"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteCapture, getCapture, updateCapture } from "@/lib/storage/db";
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
  const [record, setRecord] = useState<CaptureRecord | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    getCapture(id)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setMissing(true);
          return;
        }
        setRecord(found);
        objectUrl = URL.createObjectURL(showOriginal && found.original ? found.original : found.graded);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setNotice("This capture could not be opened.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, showOriginal]);

  async function persist(next: CaptureRecord) {
    setRecord(next);
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(showOriginal && next.original ? next.original : next.graded));
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
    window.location.href = "/gallery";
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
        <h1 data-testid="review-title" className="font-mono text-[11px] tracking-[0.16em] uppercase">
          {record?.lutName ?? "Capture"}
        </h1>
        <Link href="/" className="text-sm">
          Camera
        </Link>
      </header>
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-xl bg-black">
          {record?.kind === "video" && url && !viewingOriginal ? (
            <video src={url} controls className="max-h-[70dvh] w-full" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-[70dvh] w-full object-contain" />
          ) : (
            <div className="aspect-[3/2]" />
          )}
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
                  Frame {record.metadata.frameId} · {record.metadata.frameOrientation ?? "auto"}
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
