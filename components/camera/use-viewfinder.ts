"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { analyzeFrame, type AnalysisOptions, type FrameAnalysis } from "@/lib/analysis/frame";
import type { Rgb } from "@/lib/lut/color";
import type { Lut3D } from "@/lib/lut/grade";
import { coverCrop, LutRenderer, type WebGlKind } from "@/lib/lut/renderer";

export interface ViewDraw {
  intensity: number;
  mirror: boolean;
  magnify: boolean;
  wbGains: Rgb;
  analyze: boolean;
  analysis: AnalysisOptions;
}

export function useViewfinder(videoRef: RefObject<HTMLVideoElement | null>, lut: Lut3D | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  const drawRef = useRef<ViewDraw>({
    intensity: 1,
    mirror: false,
    magnify: false,
    wbGains: [1, 1, 1],
    analyze: false,
    analysis: { highlight: 95, shadow: null, peakingSensitivity: 50 },
  });
  const lutRef = useRef(lut);
  lutRef.current = lut;
  const [kind, setKind] = useState<WebGlKind>("none");
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    let renderer: LutRenderer;
    try {
      renderer = new LutRenderer(canvas);
    } catch {
      setKind("none");
      return;
    }
    rendererRef.current = renderer;
    setKind(renderer.kind);
    let appliedLut = "";
    if (lutRef.current) {
      renderer.setLut(lutRef.current);
      appliedLut = lutRef.current.id;
    }
    let stop = false;
    let frameHandle = 0;
    let slowStreak = 0;
    let last = performance.now();
    let lastAnalysis = 0;
    let slowShown = false;

    const tick = (now: number) => {
      if (stop) return;
      const gap = now - last;
      last = now;
      slowStreak = gap > 80 ? slowStreak + 1 : Math.max(0, slowStreak - 1);
      const nextSlow = slowStreak >= 8;
      if (nextSlow !== slowShown) {
        slowShown = nextSlow;
        setSlow(nextSlow);
      }
      try {
        const nextLut = lutRef.current;
        if (nextLut && nextLut.id !== appliedLut) {
          renderer.setLut(nextLut);
          appliedLut = nextLut.id;
        }
        const draw = drawRef.current;
        if (video.videoWidth > 2 && canvas.clientWidth > 2) {
          let crop = coverCrop(video.videoWidth, video.videoHeight, canvas.clientWidth, canvas.clientHeight);
          if (draw.magnify) {
            const dx = (crop.u1 - crop.u0) * 0.25;
            const dy = (crop.v1 - crop.v0) * 0.25;
            crop = { u0: crop.u0 + dx, v0: crop.v0 + dy, u1: crop.u1 - dx, v1: crop.v1 - dy };
          }
          renderer.draw(video, {
            intensity: draw.intensity,
            mirror: draw.mirror,
            wbGains: draw.wbGains,
            crop,
          });
          if (draw.analyze && now - lastAnalysis > 100) {
            lastAnalysis = now;
            const sample = renderer.readAnalysis();
            if (sample) {
              setAnalysis(analyzeFrame(sample.pixels, sample.width, sample.height, draw.analysis));
            }
          }
        }
      } finally {
        if (!stop) frameHandle = requestAnimationFrame(tick);
      }
    };

    frameHandle = requestAnimationFrame(tick);
    return () => {
      stop = true;
      cancelAnimationFrame(frameHandle);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [videoRef]);

  useEffect(() => {
    if (lut) rendererRef.current?.setLut(lut);
  }, [lut]);

  return { canvasRef, rendererRef, drawRef, kind, analysis, slow };
}
