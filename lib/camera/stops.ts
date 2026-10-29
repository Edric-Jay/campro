import type { NumericRange } from "./types";

export interface ShutterStop {
  id: string;
  label: string;
  seconds: number | "auto";
}

export const SHUTTER_STOPS: ShutterStop[] = [
  { id: "auto", label: "Auto", seconds: "auto" },
  { id: "1/8000", label: "1/8000", seconds: 1 / 8000 },
  { id: "1/4000", label: "1/4000", seconds: 1 / 4000 },
  { id: "1/2000", label: "1/2000", seconds: 1 / 2000 },
  { id: "1/1000", label: "1/1000", seconds: 1 / 1000 },
  { id: "1/500", label: "1/500", seconds: 1 / 500 },
  { id: "1/250", label: "1/250", seconds: 1 / 250 },
  { id: "1/125", label: "1/125", seconds: 1 / 125 },
  { id: "1/60", label: "1/60", seconds: 1 / 60 },
  { id: "1/30", label: "1/30", seconds: 1 / 30 },
  { id: "1/15", label: "1/15", seconds: 1 / 15 },
  { id: "1/8", label: "1/8", seconds: 1 / 8 },
  { id: "1/4", label: "1/4", seconds: 1 / 4 },
  { id: "1/2", label: "1/2", seconds: 1 / 2 },
  { id: "1", label: "1s", seconds: 1 },
  { id: "2", label: "2s", seconds: 2 },
  { id: "4", label: "4s", seconds: 4 },
  { id: "8", label: "8s", seconds: 8 },
];

export const ISO_STOPS = [50, 64, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600] as const;

export const VIDEO_FRAME_RATES = [24, 25, 30, 50, 60] as const;

export const VIDEO_RESOLUTIONS = [
  { id: "720", label: "720p", width: 1280, height: 720 },
  { id: "1080", label: "1080p", width: 1920, height: 1080 },
  { id: "2160", label: "2160p", width: 3840, height: 2160 },
] as const;

export function shutterById(id: string) {
  return SHUTTER_STOPS.find((stop) => stop.id === id) ?? SHUTTER_STOPS[0];
}

export function shutterSeconds(id: string) {
  const stop = shutterById(id);
  return stop.seconds === "auto" ? null : stop.seconds;
}

function inRange(value: number, range: NumericRange) {
  const eps = Math.max(1e-6, Math.abs(value) * 1e-3);
  return value >= range.min - eps && value <= range.max + eps;
}

export function shutterEnabled(id: string, range: NumericRange | undefined, available: boolean) {
  if (!available) return false;
  if (id === "auto") return true;
  const seconds = shutterSeconds(id);
  if (seconds == null || !range) return false;
  return inRange(seconds, range);
}

export function isoEnabled(id: string, range: NumericRange | undefined, available: boolean) {
  if (!available) return false;
  if (id === "auto") return true;
  const value = Number(id);
  if (!Number.isFinite(value) || !range) return false;
  return inRange(value, range);
}

export function evStops() {
  const stops: number[] = [];
  for (let step = -9; step <= 9; step += 1) {
    stops.push(Math.round((step / 3) * 10) / 10);
  }
  return stops;
}

export function evEnabled(value: number, range: NumericRange | undefined, available: boolean) {
  if (!available || !range) return false;
  return inRange(value, range);
}

export function exposureDeviceValue(seconds: number, range: NumericRange | undefined, deviceFactor = 1) {
  const snapped = range ? snapToRange(seconds, range) : seconds;
  return snapped * deviceFactor;
}

export function snapToRange(value: number, range: NumericRange) {
  const step = range.step && range.step > 0 ? range.step : 0;
  const snapped = step
    ? range.min + Math.round((value - range.min) / step) * step
    : value;
  return Math.min(range.max, Math.max(range.min, snapped));
}

export function formatExposureSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds >= 0.95) {
    const rounded = Math.round(seconds * 10) / 10;
    return `${rounded}s`;
  }
  return `1/${Math.round(1 / seconds)}`;
}

export function formatZoom(value: number, range?: NumericRange) {
  if (range && range.min >= 50) return `${(value / 100).toFixed(2)}×`;
  return `${value.toFixed(2)}×`;
}

export function formatEv(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const text = rounded.toFixed(1);
  return `${rounded > 0 ? "+" : ""}${text} EV`;
}

export function frameRateEnabled(fps: number, range: NumericRange | undefined) {
  if (!range) return false;
  return inRange(fps, range);
}

export function resolutionEnabled(
  width: number,
  height: number,
  widthRange: NumericRange | undefined,
  heightRange: NumericRange | undefined,
) {
  if (!widthRange || !heightRange) return false;
  return inRange(width, widthRange) && inRange(height, heightRange);
}

export function guidelineShutter(fps: number) {
  if (fps <= 25) {
    return {
      id: "1/60",
      label: "1/60",
      note: "180° guideline is about 1/50. The nearest shutter on this dial is 1/60.",
    };
  }
  if (fps <= 30) {
    return { id: "1/60", label: "1/60", note: "180° guideline at 30 fps is about 1/60." };
  }
  if (fps <= 50) {
    return {
      id: "1/125",
      label: "1/125",
      note: "180° guideline is about 1/100. The nearest shutter on this dial is 1/125.",
    };
  }
  return { id: "1/125", label: "1/125", note: "180° guideline at 60 fps is about 1/125." };
}
