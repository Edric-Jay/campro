"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteCapture, listCaptures, updateCapture } from "@/lib/storage/db";
import type { CaptureRecord } from "@/lib/storage/records";

export function GalleryView() {
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCaptures()
      .then((records) => {
        if (cancelled) return;
        setCaptures(records);
        const next: Record<string, string> = {};
        for (const record of records) next[record.id] = URL.createObjectURL(record.thumbnail);
        setUrls(next);
      })
      .catch(() => {
        if (!cancelled) setNotice("The gallery could not be read in this browser.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    };
  }, [urls]);

  async function toggleFavorite(record: CaptureRecord) {
    const next = { ...record, favorite: !record.favorite };
    setCaptures((current) => current.map((item) => (item.id === record.id ? next : item)));
    try {
      await updateCapture(next);
    } catch {
      setNotice("That favorite could not be saved.");
    }
  }

  async function remove(record: CaptureRecord) {
    if (!window.confirm("Delete this capture from the camera gallery?")) return;
    setCaptures((current) => current.filter((item) => item.id !== record.id));
    try {
      await deleteCapture(record.id);
    } catch {
      setNotice("That capture could not be deleted.");
    }
  }

  return (
    <main className="min-h-dvh bg-ink px-4 py-4 text-paper">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="font-mono text-xs tracking-[0.18em] uppercase">Gallery</h1>
        <Link href="/" className="text-sm text-sage">
          Camera
        </Link>
      </header>
      {notice ? <p className="mb-3 text-sm text-amber">{notice}</p> : null}
      {captures.length === 0 ? <p className="text-sm text-paper/60">No captures yet. Photos stay on this device.</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {captures.map((record) => (
          <article key={record.id} data-testid="capture-card" className="border border-paper/10">
            <Link href={`/gallery/${record.id}`}>
              {urls[record.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[record.id]} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <span className="block aspect-[4/3] bg-black" />
              )}
            </Link>
            <div className="flex items-center justify-between gap-2 px-2 py-2 text-[11px]">
              <div>
                <p>{record.lutName}</p>
                <p className="text-paper/45">{new Date(record.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button type="button" onClick={() => void toggleFavorite(record)}>
                  {record.favorite ? "Favorited" : "Favorite"}
                </button>
                <button type="button" onClick={() => void remove(record)}>
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
