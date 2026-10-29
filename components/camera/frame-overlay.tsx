"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { imageWindowAspect, resolveOrientation, type FrameId, type FrameOrientation } from "@/lib/frames/film";

function readBox(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

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

    const measure = () => setBox(readBox(node));
    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    const visual = window.visualViewport;
    visual?.addEventListener("resize", measure);
    const screenOrientation = window.screen?.orientation;
    screenOrientation?.addEventListener("change", measure);

    // Some mobile browsers fire orientationchange before layout settles.
    const afterRotate = () => {
      measure();
      window.setTimeout(measure, 50);
      window.setTimeout(measure, 250);
    };
    window.addEventListener("orientationchange", afterRotate);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("orientationchange", afterRotate);
      visual?.removeEventListener("resize", measure);
      screenOrientation?.removeEventListener("change", measure);
    };
  }, [frameId, clearChrome]);

  // Preview always follows the live screen shape so rotating the phone updates the crop.
  // Portrait / Landscape in settings only locks the print when capturing.
  const fallbackW = typeof window !== "undefined" ? window.innerWidth : 3;
  const fallbackH = typeof window !== "undefined" ? window.innerHeight : 4;
  const screenOrientation = resolveOrientation("auto", box.width || fallbackW, box.height || fallbackH);
  const aspect = frameId === "none" ? null : imageWindowAspect(frameId, screenOrientation);

  return (
    <div
      ref={rootRef}
      className={`absolute z-0 flex items-center justify-center bg-black [container-type:size] ${
        clearChrome ? "inset-x-0 top-[var(--cam-top)] bottom-[var(--cam-bottom)]" : "inset-0"
      }`}
    >
      {aspect ? (
        <div
          key={`${screenOrientation}-${aspect.toFixed(3)}`}
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
      {orientation !== "auto" && frameId !== "none" ? (
        <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/70 px-2 py-1 font-mono text-[9px] tracking-widest text-paper/70 uppercase">
          Preview follows phone · print locked {orientation}
        </p>
      ) : null}
    </div>
  );
}
