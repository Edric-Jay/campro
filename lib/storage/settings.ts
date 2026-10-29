import type {
  CaptureMode,
  ExposureChoice,
  FacingMode,
  FlashChoice,
  FocusChoice,
  GridMode,
  OutputFormat,
  WhiteBalanceChoice,
} from "@/lib/camera/types";
import { isFrameId, isFrameOrientation, type FrameId, type FrameOrientation } from "@/lib/frames/film";

export interface AppSettings {
  lutId: string;
  lutIntensity: number;
  facingMode: FacingMode;
  captureMode: CaptureMode;
  exposureMode: ExposureChoice;
  shutterId: string;
  isoId: string;
  ev: number;
  focusMode: FocusChoice;
  focusDistance: number;
  whiteBalance: WhiteBalanceChoice;
  kelvin: number;
  wbLock: boolean;
  zoom: number | null;
  flash: FlashChoice;
  grid: GridMode;
  crosshair: boolean;
  safeFrame: boolean;
  level: boolean;
  histogram: boolean;
  zebra: boolean;
  zebraHighlight: number;
  zebraShadow: number | null;
  peaking: boolean;
  peakingSensitivity: number;
  peakingColor: string;
  falseColor: boolean;
  cleanViewfinder: boolean;
  timerSeconds: 0 | 2 | 5 | 10;
  burstCount: 1 | 3 | 5;
  outputFormat: OutputFormat;
  videoFps: 24 | 25 | 30 | 50 | 60;
  videoWidth: number;
  videoHeight: number;
  favorites: string[];
  recents: string[];
  previewMagnify: boolean;
  frameId: FrameId;
  frameOrientation: FrameOrientation;
}

export interface Preset {
  id: string;
  name: string;
  settings: AppSettings;
  createdAt: number;
}

export interface StoredLut {
  id: string;
  name: string;
  size: number;
  data: number[];
}

export interface ConfigFile {
  version: 1;
  settings: AppSettings;
  presets: Preset[];
  customLuts: StoredLut[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  lutId: "natural",
  lutIntensity: 100,
  facingMode: "environment",
  captureMode: "photo",
  exposureMode: "auto",
  shutterId: "auto",
  isoId: "auto",
  ev: 0,
  focusMode: "continuous",
  focusDistance: 0.5,
  whiteBalance: "auto",
  kelvin: 5600,
  wbLock: false,
  zoom: null,
  flash: "off",
  grid: "off",
  crosshair: false,
  safeFrame: false,
  level: false,
  histogram: false,
  zebra: false,
  zebraHighlight: 95,
  zebraShadow: null,
  peaking: false,
  peakingSensitivity: 50,
  peakingColor: "#d6ff4a",
  falseColor: false,
  cleanViewfinder: false,
  timerSeconds: 0,
  burstCount: 1,
  outputFormat: "jpeg",
  videoFps: 30,
  videoWidth: 1920,
  videoHeight: 1080,
  favorites: [],
  recents: ["natural"],
  previewMagnify: false,
  frameId: "none",
  frameOrientation: "auto",
};

const FACING = new Set<FacingMode>(["user", "environment"]);
const MODES = new Set<CaptureMode>(["photo", "video"]);
const EXPOSURE = new Set<ExposureChoice>(["auto", "manual", "shutter-priority", "iso-priority"]);
const FOCUS = new Set<FocusChoice>(["continuous", "single-shot", "manual"]);
const WHITE = new Set<WhiteBalanceChoice>([
  "auto",
  "daylight",
  "cloudy",
  "shade",
  "tungsten",
  "fluorescent",
  "flash",
  "kelvin",
]);
const FLASH = new Set<FlashChoice>(["off", "auto", "on", "torch", "red-eye"]);
const GRIDS = new Set<GridMode>(["off", "thirds", "golden"]);
const FORMATS = new Set<OutputFormat>(["jpeg", "heif", "raw"]);
const FPS = new Set([24, 25, 30, 50, 60]);
const TIMERS = new Set([0, 2, 5, 10]);
const BURSTS = new Set([1, 3, 5]);

function record(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number) {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, next));
}

function flag(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function choice<T extends string>(value: unknown, allowed: Set<T>, fallback: T) {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 48);
}

export function sanitizeSettings(input: unknown): AppSettings {
  const raw = record(input);
  const timer = num(raw.timerSeconds, 0, 0, 10);
  const burst = num(raw.burstCount, 1, 1, 5);
  const fps = num(raw.videoFps, 30, 1, 240);
  return {
    lutId: text(raw.lutId, DEFAULT_SETTINGS.lutId),
    lutIntensity: num(raw.lutIntensity, 100, 0, 100),
    facingMode: choice(raw.facingMode, FACING, "environment"),
    captureMode: choice(raw.captureMode, MODES, "photo"),
    exposureMode: choice(raw.exposureMode, EXPOSURE, "auto"),
    shutterId: text(raw.shutterId, "auto"),
    isoId: text(raw.isoId, "auto"),
    ev: Math.round(num(raw.ev, 0, -3, 3) * 10) / 10,
    focusMode: choice(raw.focusMode, FOCUS, "continuous"),
    focusDistance: num(raw.focusDistance, 0.5, 0, 1000),
    whiteBalance: choice(raw.whiteBalance, WHITE, "auto"),
    kelvin: num(raw.kelvin, 5600, 2000, 10000),
    wbLock: flag(raw.wbLock, false),
    zoom: typeof raw.zoom === "number" && Number.isFinite(raw.zoom) ? raw.zoom : null,
    flash: choice(raw.flash, FLASH, "off"),
    grid: choice(raw.grid, GRIDS, "off"),
    crosshair: flag(raw.crosshair, false),
    safeFrame: flag(raw.safeFrame, false),
    level: flag(raw.level, false),
    histogram: flag(raw.histogram, false),
    zebra: flag(raw.zebra, false),
    zebraHighlight: num(raw.zebraHighlight, 95, 50, 100),
    zebraShadow:
      typeof raw.zebraShadow === "number" && Number.isFinite(raw.zebraShadow)
        ? num(raw.zebraShadow, 5, 0, 30)
        : null,
    peaking: flag(raw.peaking, false),
    peakingSensitivity: num(raw.peakingSensitivity, 50, 1, 100),
    peakingColor: text(raw.peakingColor, DEFAULT_SETTINGS.peakingColor),
    falseColor: flag(raw.falseColor, false),
    cleanViewfinder: flag(raw.cleanViewfinder, false),
    timerSeconds: (TIMERS.has(timer) ? timer : 0) as AppSettings["timerSeconds"],
    burstCount: (BURSTS.has(burst) ? burst : 1) as AppSettings["burstCount"],
    outputFormat: choice(raw.outputFormat, FORMATS, "jpeg"),
    videoFps: (FPS.has(fps) ? fps : 30) as AppSettings["videoFps"],
    videoWidth: num(raw.videoWidth, 1920, 160, 7680),
    videoHeight: num(raw.videoHeight, 1080, 120, 4320),
    favorites: strings(raw.favorites),
    recents: strings(raw.recents),
    previewMagnify: flag(raw.previewMagnify, false),
    frameId: typeof raw.frameId === "string" && isFrameId(raw.frameId) ? raw.frameId : "none",
    frameOrientation:
      typeof raw.frameOrientation === "string" && isFrameOrientation(raw.frameOrientation)
        ? raw.frameOrientation
        : "auto",
  };
}

export function restoreDefaults() {
  return sanitizeSettings(DEFAULT_SETTINGS);
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createPreset(name: string, settings: AppSettings): Preset {
  return {
    id: newId(),
    name: name.trim() || "Preset",
    settings: sanitizeSettings(settings),
    createdAt: Date.now(),
  };
}

export function renamePreset(presets: Preset[], id: string, name: string) {
  return presets.map((preset) =>
    preset.id === id ? { ...preset, name: name.trim() || preset.name } : preset,
  );
}

export function duplicatePreset(presets: Preset[], id: string) {
  const source = presets.find((preset) => preset.id === id);
  if (!source) return presets;
  return [
    ...presets,
    createPreset(`${source.name} copy`, source.settings),
  ];
}

export function deletePreset(presets: Preset[], id: string) {
  return presets.filter((preset) => preset.id !== id);
}

function sanitizeLut(input: unknown): StoredLut | null {
  const raw = record(input);
  const size = num(raw.size, 0, 0, 64);
  if (typeof raw.id !== "string" || typeof raw.name !== "string" || size < 2) return null;
  if (!Array.isArray(raw.data) || raw.data.length !== size * size * size * 3) return null;
  if (raw.data.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
  return { id: raw.id, name: raw.name, size, data: raw.data };
}

export function exportConfig(settings: AppSettings, presets: Preset[], customLuts: StoredLut[]) {
  const used = new Set<string>([settings.lutId, ...presets.map((preset) => preset.settings.lutId)]);
  const file: ConfigFile = {
    version: 1,
    settings: sanitizeSettings(settings),
    presets: presets.map((preset) => ({
      ...preset,
      settings: sanitizeSettings(preset.settings),
    })),
    customLuts: customLuts.filter((lut) => used.has(lut.id)),
  };
  return JSON.stringify(file);
}

export function importConfig(json: string): ConfigFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("The configuration file is not valid JSON.");
  }
  const raw = record(parsed);
  if (raw.version !== 1) throw new Error("This configuration file is not version 1.");
  const presets = Array.isArray(raw.presets)
    ? raw.presets.map((item) => {
        const preset = record(item);
        return {
          id: text(preset.id, newId()),
          name: text(preset.name, "Preset"),
          createdAt: num(preset.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
          settings: sanitizeSettings(preset.settings),
        };
      })
    : [];
  const customLuts = Array.isArray(raw.customLuts)
    ? raw.customLuts.map(sanitizeLut).filter((lut): lut is StoredLut => lut !== null)
    : [];
  return {
    version: 1,
    settings: sanitizeSettings(raw.settings),
    presets,
    customLuts,
  };
}

export function touchRecent(settings: AppSettings, lutId: string): AppSettings {
  return sanitizeSettings({
    ...settings,
    lutId,
    recents: [lutId, ...settings.recents.filter((id) => id !== lutId)].slice(0, 6),
  });
}
