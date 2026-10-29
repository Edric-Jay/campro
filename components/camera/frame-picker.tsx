"use client";

import { FRAMES, type FrameId, type FrameOrientation } from "@/lib/frames/film";

const ORIENTATIONS: { id: FrameOrientation; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "portrait", label: "Portrait" },
  { id: "landscape", label: "Landscape" },
];

export function FramePicker({
  frameId,
  orientation,
  onFrame,
  onOrientation,
}: {
  frameId: FrameId;
  orientation: FrameOrientation;
  onFrame: (id: FrameId) => void;
  onOrientation: (orientation: FrameOrientation) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.16em] text-paper/55 uppercase">Frame</p>
        <div className="flex gap-1">
          {ORIENTATIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={orientation === option.id}
              className={`min-h-8 rounded-full border px-2.5 font-mono text-[10px] tracking-widest uppercase ${
                orientation === option.id ? "border-sage bg-paper text-ink" : "border-paper/15 text-paper"
              }`}
              onClick={() => onOrientation(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FRAMES.map((frame) => (
          <button
            key={frame.id}
            type="button"
            aria-pressed={frameId === frame.id}
            className={`w-24 shrink-0 rounded-md border px-2 py-2 text-left ${
              frameId === frame.id ? "border-sage" : "border-paper/15"
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
