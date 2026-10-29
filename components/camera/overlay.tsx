"use client";

import type { FrameAnalysis } from "@/lib/analysis/frame";
import { falseColor } from "@/lib/analysis/frame";
import type { AppSettings } from "@/lib/storage/settings";
import { formatEv } from "@/lib/camera/stops";
import { useEffect, useRef } from "react";

export interface FocusMark {
  x: number;
  y: number;
  color: "white" | "green" | "amber";
  label: string;
}

function hex(color: string) {
  const value = color.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

export function OverlayLayer({
  settings,
  analysis,
  focus,
  tilt,
  onAskLevel,
  levelPermission,
}: {
  settings: AppSettings;
  analysis: FrameAnalysis | null;
  focus: FocusMark | null;
  tilt: number | null;
  onAskLevel: () => void;
  levelPermission: "unknown" | "needed" | "granted" | "denied";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clean = settings.cleanViewfinder;

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const width = Math.max(2, parent.clientWidth);
    const height = Math.max(2, parent.clientHeight);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (clean || !analysis) return;
    if (!settings.falseColor && !settings.zebra && !settings.peaking) return;
    const image = context.createImageData(analysis.width, analysis.height);
    const peak = hex(settings.peakingColor);
    for (let index = 0; index < analysis.width * analysis.height; index += 1) {
      const offset = index * 4;
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      if (settings.falseColor) {
        const paint = hex(falseColor(analysis.luma[index] ?? 0));
        red = paint[0];
        green = paint[1];
        blue = paint[2];
        alpha = 170;
      } else if (settings.zebra && analysis.zebra[index] === 1) {
        red = 243;
        green = 239;
        blue = 230;
        alpha = index % 6 < 2 ? 180 : 0;
      } else if (settings.zebra && analysis.zebra[index] === 2) {
        red = 154;
        green = 168;
        blue = 146;
        alpha = index % 6 < 2 ? 160 : 0;
      }
      if (settings.peaking && analysis.peaking[index]) {
        red = peak[0];
        green = peak[1];
        blue = peak[2];
        alpha = 220;
      }
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = alpha;
    }
    const scratch = document.createElement("canvas");
    scratch.width = analysis.width;
    scratch.height = analysis.height;
    scratch.getContext("2d")?.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(scratch, 0, 0, width, height);
  }, [analysis, clean, settings.falseColor, settings.peaking, settings.peakingColor, settings.zebra]);

  const focusColor = focus?.color === "green" ? "border-sage" : focus?.color === "amber" ? "border-amber" : "border-paper";

  return (
    <div className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!clean && settings.grid === "thirds" ? <div className="thirds absolute inset-0" /> : null}
      {!clean && settings.grid === "golden" ? <div className="golden absolute inset-0" /> : null}
      {!clean && settings.crosshair ? <div className="crosshair absolute inset-0" /> : null}
      {!clean && settings.safeFrame ? <div className="absolute inset-[8%] border border-paper/35" /> : null}
      {!clean && settings.level ? (
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
          {levelPermission === "needed" ? (
            <button type="button" className="pointer-events-auto min-h-8 rounded-full border border-paper/20 px-3 text-[10px] tracking-widest uppercase" onClick={onAskLevel}>
              Allow level
            </button>
          ) : tilt == null ? (
            <p className="font-mono text-[10px] tracking-widest text-paper/70 uppercase">Level unavailable</p>
          ) : (
            <div
              className={`h-px w-24 ${Math.abs(tilt) < 1.5 ? "bg-sage" : "bg-paper/80"}`}
              style={{ transform: `rotate(${tilt}deg)` }}
            />
          )}
        </div>
      ) : null}
      {focus ? (
        <div
          className={`absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 border ${focusColor}`}
          style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
        >
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest whitespace-nowrap uppercase">
            {focus.label}
          </span>
        </div>
      ) : null}
      {!clean && analysis ? (
        <div className="absolute top-3 right-3 w-28">
          <p className="font-mono text-[10px] tracking-[0.14em] text-paper/70 uppercase">Preview meter</p>
          <div className="mt-1 h-1 bg-paper/20">
            <div
              className="h-1 w-px bg-sage"
              style={{ marginLeft: `${((analysis.meterEv + 3) / 6) * 100}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-paper/80">{formatEv(analysis.meterEv)}</p>
          {analysis.highlightClip > 0.005 ? (
            <p className="font-mono text-[10px] text-paper/70">Highlight clip {Math.round(analysis.highlightClip * 100)}%</p>
          ) : null}
          {analysis.shadowClip > 0.005 ? (
            <p className="font-mono text-[10px] text-paper/70">Shadow clip {Math.round(analysis.shadowClip * 100)}%</p>
          ) : null}
          {settings.histogram ? <Histogram histogram={analysis.histogram} /> : null}
          {settings.peaking ? (
            <p className="mt-1 text-[10px] leading-snug text-paper/60">Peaking is an edge estimate, not sensor focus confirmation.</p>
          ) : null}
          {settings.falseColor ? (
            <p className="mt-1 text-[10px] leading-snug text-paper/60">False color is a preview of this frame.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Histogram({ histogram }: { histogram: FrameAnalysis["histogram"] }) {
  const peak = Math.max(1, ...histogram.luma, ...histogram.r, ...histogram.g, ...histogram.b);
  const rows = [
    ["R", histogram.r, "bg-danger"],
    ["G", histogram.g, "bg-sage"],
    ["B", histogram.b, "bg-paper"],
    ["Y", histogram.luma, "bg-amber"],
  ] as const;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {rows.map(([label, bars, color]) => (
        <div key={label} className="flex h-3 items-end gap-px">
          <span className="w-3 font-mono text-[9px] text-paper/50">{label}</span>
          {bars.map((value, index) => (
            <span key={index} className={`flex-1 ${color}`} style={{ height: `${(value / peak) * 100}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
