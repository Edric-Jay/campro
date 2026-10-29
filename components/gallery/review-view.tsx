"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteCapture, getCapture, updateCapture } from "@/lib/storage/db";
import type { CaptureRecord } from "@/lib/storage/records";

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

  async function toggleFavorite() {
    if (!record) return;
    const next = { ...record, favorite: !record.favorite };
    setRecord(next);
    try {
      await updateCapture(next);
    } catch {
      setNotice("The favorite could not be saved.");
    }
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

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <header className="flex items-center justify-between px-4 py-3">
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
      <div className="mx-auto grid max-w-5xl gap-4 px-4 pb-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="bg-black">
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
          <aside className="flex flex-col gap-3 text-sm">
            <p className="font-mono text-[10px] tracking-widest text-paper/50 uppercase">
              {new Date(record.createdAt).toLocaleString()}
            </p>
            <p>{record.metadata.exposureSummary}</p>
            <p>Look {record.lutName} · {Math.round(record.intensity)}%</p>
            <p>White balance {record.metadata.whiteBalanceLabel}</p>
            <p>
              {record.metadata.width}×{record.metadata.height} · {record.originalSource}
            </p>
            <p className="text-xs leading-relaxed text-paper/55">{record.metadata.gradedNote}</p>
            {record.metadata.audio ? <p>Microphone {record.metadata.audio}</p> : null}
            <div className="flex flex-wrap gap-2">
              {record.original ? (
                <button type="button" className="min-h-9 rounded-full border border-paper/15 px-3" onClick={() => setShowOriginal((value) => !value)}>
                  {viewingOriginal ? "Graded" : "Original"}
                </button>
              ) : null}
              <button type="button" className="min-h-9 rounded-full border border-paper/15 px-3" onClick={() => void toggleFavorite()}>
                {record.favorite ? "Favorited" : "Favorite"}
              </button>
              <button
                type="button"
                className="min-h-9 rounded-full border border-paper/15 px-3"
                onClick={() => download(media, `camlut-${stamp}.${record.kind === "video" && !viewingOriginal ? "webm" : "jpg"}`)}
              >
                Save
              </button>
              <button
                type="button"
                className="min-h-9 rounded-full border border-paper/15 px-3"
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
                <button type="button" className="min-h-9 rounded-full border border-danger px-3 text-danger" onClick={() => void remove()}>
                  Delete
                </button>
                <button type="button" className="min-h-9 px-3" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="min-h-9 self-start text-paper/60" onClick={() => setConfirming(true)}>
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
