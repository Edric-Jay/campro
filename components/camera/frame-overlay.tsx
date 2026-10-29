"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { imageWindowAspect, resolveOrientation, type FrameId, type FrameOrientation } from "@/lib/frames/film";

export function AspectPreview({
  frameId,
  orientation,
  clearChrome = false,
  children,
}: {
  frameId: FrameId;
  orientation: FrameOrientation;
  clearChrome?: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [frameId, orientation]);

  const aspect =
    frameId === "none"
      ? null
      : imageWindowAspect(frameId, resolveOrientation(orientation, box.width || 3, box.height || 4));

  return (
    <div
      ref={rootRef}
      className={`absolute z-0 flex items-center justify-center bg-black [container-type:size] ${
        clearChrome ? "inset-x-0 top-[var(--cam-top)] bottom-[var(--cam-bottom)]" : "inset-0"
      }`}
    >
      {aspect ? (
        <div
          className="relative overflow-hidden"
          style={{
            width: `min(100cqw, calc(100cqh * ${aspect}))`,
            height: `min(100cqh, calc(100cqw / ${aspect}))`,
          }}
        >
          {children}
        </div>
      ) : (
        <div className="relative h-full w-full overflow-hidden">{children}</div>
      )}
    </div>
  );
}
