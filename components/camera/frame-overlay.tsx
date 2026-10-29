"use client";

import { useEffect, useRef, useState } from "react";
import { frameLayout, resolveOrientation, type FrameId, type FrameOrientation } from "@/lib/frames/film";

export function FrameOverlay({
  frameId,
  orientation,
  clearChrome = false,
}: {
  frameId: FrameId;
  orientation: FrameOrientation;
  clearChrome?: boolean;
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
  }, [frameId]);

  if (frameId === "none") return null;
  const layout = frameLayout(frameId, resolveOrientation(orientation, box.width || 3, box.height || 4));

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute z-0 flex items-center justify-center [container-type:size] ${
        clearChrome ? "inset-x-0 top-[var(--cam-top)] bottom-[var(--cam-bottom)]" : "inset-0"
      }`}
    >
      {layout ? <div
        className="relative"
        style={{
          width: `min(100cqw, calc(100cqh * ${layout.outerAspect}))`,
          height: `min(100cqh, calc(100cqw / ${layout.outerAspect}))`,
        }}
      >
        <div className="absolute inset-x-0 top-0" style={{ height: `${layout.padTop * 100}%`, background: layout.paper }} />
        <div className="absolute inset-x-0 bottom-0" style={{ height: `${layout.padBottom * 100}%`, background: layout.paper }} />
        <div
          className="absolute left-0"
          style={{
            top: `${layout.padTop * 100}%`,
            bottom: `${layout.padBottom * 100}%`,
            width: `${layout.padLeft * 100}%`,
            background: layout.paper,
          }}
        />
        <div
          className="absolute right-0"
          style={{
            top: `${layout.padTop * 100}%`,
            bottom: `${layout.padBottom * 100}%`,
            width: `${layout.padRight * 100}%`,
            background: layout.paper,
          }}
        />
        {layout.sprockets !== "none"
          ? Array.from({ length: layout.sprockets === "horizontal" ? 16 : 12 }, (_, index) => {
              const horizontal = layout.sprockets === "horizontal";
              const count = horizontal ? 8 : 6;
              const lane = index < count ? 0 : 1;
              const slot = index % count;
              return (
                <span
                  key={index}
                  className="absolute rounded-full"
                  style={{
                    width: "1.6%",
                    height: "1.6%",
                    background: layout.hole,
                    left: horizontal ? `${((slot + 0.5) / count) * 100}%` : lane === 0 ? "4%" : "94%",
                    top: horizontal ? (lane === 0 ? "4%" : "94%") : `${((slot + 0.5) / count) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              );
            })
          : null}
      </div> : null}
    </div>
  );
}
