"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { imageWindowAspect, type FrameId } from "@/lib/frames/film";

function readBox(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function AspectPreview({
  frameId,
  clearChrome = false,
  children,
}: {
  frameId: FrameId;
  clearChrome?: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const measure = () => setReady(readBox(node).width > 2);
    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    const visual = window.visualViewport;
    visual?.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      visual?.removeEventListener("resize", measure);
    };
  }, [frameId, clearChrome]);

  // Portrait-only frames for now — preview always matches the portrait photo window.
  const aspect = frameId === "none" ? null : imageWindowAspect(frameId, "portrait");

  return (
    <div
      ref={rootRef}
      className={`absolute z-0 flex items-center justify-center bg-black [container-type:size] ${
        clearChrome ? "inset-x-0 top-[var(--cam-top)] bottom-[var(--cam-bottom)]" : "inset-0"
      }`}
    >
      {/* Keep one stable media host so video/canvas are never remounted when a frame is chosen. */}
      <div
        className="relative overflow-hidden"
        style={
          aspect && ready
            ? {
                width: `min(100cqw, calc(100cqh * ${aspect}))`,
                height: `min(100cqh, calc(100cqw / ${aspect}))`,
              }
            : { width: "100%", height: "100%" }
        }
      >
        {children}
      </div>
    </div>
  );
}
