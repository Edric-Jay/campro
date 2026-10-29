export interface FrameAnalysis {
  width: number;
  height: number;
  histogram: { r: number[]; g: number[]; b: number[]; luma: number[] };
  highlightClip: number;
  shadowClip: number;
  zebra: Uint8Array;
  peaking: Uint8Array;
  luma: Float32Array;
  lumaMean: number;
  meterEv: number;
}

export interface AnalysisOptions {
  highlight: number;
  shadow: number | null;
  peakingSensitivity: number;
}

export function previewMeterEv(lumaMean: number) {
  if (lumaMean <= 0.001) return -3;
  const ev = Math.log2(lumaMean / 0.45);
  return Math.min(3, Math.max(-3, ev));
}

export function analyzeFrame(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: AnalysisOptions,
): FrameAnalysis {
  const bins = 64;
  const histogram = {
    r: Array(bins).fill(0),
    g: Array(bins).fill(0),
    b: Array(bins).fill(0),
    luma: Array(bins).fill(0),
  };
  const count = width * height;
  const zebra = new Uint8Array(count);
  const peaking = new Uint8Array(count);
  const luma = new Float32Array(count);
  let lumaSum = 0;
  let highlightClip = 0;
  let shadowClip = 0;
  const highlight = options.highlight / 100;
  const shadow = options.shadow == null ? null : options.shadow / 100;

  for (let i = 0; i < count; i += 1) {
    const offset = i * 4;
    const r = pixels[offset] / 255;
    const g = pixels[offset + 1] / 255;
    const b = pixels[offset + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = y;
    lumaSum += y;
    histogram.r[Math.min(bins - 1, Math.floor(r * bins))] += 1;
    histogram.g[Math.min(bins - 1, Math.floor(g * bins))] += 1;
    histogram.b[Math.min(bins - 1, Math.floor(b * bins))] += 1;
    histogram.luma[Math.min(bins - 1, Math.floor(y * bins))] += 1;
    if (y >= 0.98) highlightClip += 1;
    if (y <= 0.02) shadowClip += 1;
    if (y >= highlight) zebra[i] = 1;
    else if (shadow != null && y <= shadow) zebra[i] = 2;
  }

  const threshold = 0.42 - (options.peakingSensitivity / 100) * 0.34;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -luma[index - width - 1] +
        luma[index - width + 1] -
        2 * luma[index - 1] +
        2 * luma[index + 1] -
        luma[index + width - 1] +
        luma[index + width + 1];
      const gy =
        -luma[index - width - 1] -
        2 * luma[index - width] -
        luma[index - width + 1] +
        luma[index + width - 1] +
        2 * luma[index + width] +
        luma[index + width + 1];
      if (Math.abs(gx) + Math.abs(gy) >= threshold) peaking[index] = 1;
    }
  }

  return {
    width,
    height,
    histogram,
    highlightClip: count ? highlightClip / count : 0,
    shadowClip: count ? shadowClip / count : 0,
    zebra,
    peaking,
    luma,
    lumaMean: count ? lumaSum / count : 0,
    meterEv: previewMeterEv(count ? lumaSum / count : 0),
  };
}

export function falseColor(value: number) {
  const stops = ["#2b3cff", "#1aa3ff", "#20d36a", "#d6e25a", "#f0a020", "#e23b2f"];
  return stops[Math.min(stops.length - 1, Math.floor(Math.min(0.999, Math.max(0, value)) * stops.length))];
}
