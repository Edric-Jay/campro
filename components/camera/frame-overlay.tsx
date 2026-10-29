"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { layoutOrientation } from "@/lib/camera/orientation";
import { imageWindowAspect, resolveOrientation, type FrameId, type FrameOrientation, type ResolvedOrientation } from "@/lib/frames/film";

function readBox(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function AspectPreview({
  frameId,
  orientation,
  clearChrome = false,
  previewFacingRef,
  children,
}: {
  frameId: FrameId;
  orientation: FrameOrientation;
  clearChrome?: boolean;
  /** Latest preview facing — capture Auto reads this so the print matches the live window. */
  previewFacingRef?: MutableRefObject<ResolvedOrientation>;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
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

  // Preview always follows the phone box. Locked print orientation only affects capture.
  const screenOrientation =
    box.width > 2 && box.height > 2 ? resolveOrientation("auto", box.width, box.height) : layoutOrientation();
  const aspect = frameId === "none" ? null : imageWindowAspect(frameId, screenOrientation);

  useEffect(() => {
    if (!previewFacingRef) return;
    previewFacingRef.current = screenOrientation;
  }, [previewFacingRef, screenOrientation]);

  useEffect(() => {
    if (!previewFacingRef) return;
    const host = hostRef.current;
    if (!host) return;
    const syncFromHost = () => {
      const next = readBox(host);
      if (next.width < 2 || next.height < 2) return;
      previewFacingRef.current = next.width >= next.height ? "landscape" : "portrait";
    };
    syncFromHost();
    const observer = new ResizeObserver(() => syncFromHost());
    observer.observe(host);
    return () => observer.disconnect();
  }, [previewFacingRef, aspect, frameId]);

  return (
    <div
      ref={rootRef}
      className={`absolute z-0 flex items-center justify-center bg-black [container-type:size] ${
        clearChrome ? "inset-x-0 top-[var(--cam-top)] bottom-[var(--cam-bottom)]" : "inset-0"
      }`}
    >
      {/* Keep one stable media host so video/canvas are never remounted when a frame is chosen. */}
      <div
        ref={hostRef}
        className="relative overflow-hidden"
        style={
          aspect
            ? {
                width: `min(100cqw, calc(100cqh * ${aspect}))`,
                height: `min(100cqh, calc(100cqw / ${aspect}))`,
              }
            : { width: "100%", height: "100%" }
        }
      >
        {children}
      </div>
      {orientation !== "auto" && frameId !== "none" ? (
        <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/70 px-2 py-1 font-mono text-[9px] tracking-widest text-paper/70 uppercase">
          Preview follows phone · print locked {orientation}
        </p>
      ) : null}
    </div>
  );
}
