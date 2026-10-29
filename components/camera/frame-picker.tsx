"use client";

import { FRAMES, type FrameId } from "@/lib/frames/film";

export function FramePicker({
  frameId,
  onFrame,
}: {
  frameId: FrameId;
  onFrame: (id: FrameId) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-3">
      <div>
        <p className="font-mono text-[10px] tracking-[0.16em] text-paper/55 uppercase">Frame</p>
        <p className="mt-1 text-[11px] leading-snug text-paper/45">
          Portrait print frames. The preview matches the photo window; the border is added after capture.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FRAMES.map((frame) => (
          <button
            key={frame.id}
            type="button"
            aria-pressed={frameId === frame.id}
            className={`w-24 shrink-0 rounded-md border px-2 py-2 text-left ${
              frameId === frame.id ? "border-sage bg-paper/10" : "border-paper/15"
            }`}
            onClick={() => onFrame(frame.id)}
          >
            <span className="block text-[11px]">{frame.name}</span>
            <span className="block truncate text-[10px] text-paper/45">{frame.note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
