import type { AppSettings } from "@/lib/storage/settings";
import type { CapabilityMap, ControlId, WhiteBalanceChoice } from "./types";
import { kelvinFor } from "./wb";
import { exposureDeviceValue, shutterSeconds, snapToRange } from "./stops";

export interface ConstraintEntry {
  id: ControlId | "frameRate" | "resolution";
  constraint: Record<string, unknown>;
}

function kelvinInRange(choice: WhiteBalanceChoice, kelvin: number, probe: CapabilityMap) {
  const range = probe.controls.whiteBalance.range;
  if (!range || choice === "auto") return true;
  return kelvin >= range.min && kelvin <= range.max;
}

export function trackConstraintsFor(
  settings: AppSettings,
  probe: CapabilityMap,
  mode: "photo" | "video",
): ConstraintEntry[] {
  const entries: ConstraintEntry[] = [];
  const zoom = probe.controls.zoom;
  if (zoom.level === "supported" && zoom.range && settings.zoom != null) {
    entries.push({
      id: "zoom",
      constraint: { zoom: snapToRange(settings.zoom, zoom.range) },
    });
  }

  if (settings.exposureMode === "auto" && probe.controls.ev.level === "supported" && probe.controls.ev.range) {
    entries.push({
      id: "ev",
      constraint: { exposureCompensation: snapToRange(settings.ev, probe.controls.ev.range) },
    });
  }

  if (probe.controls.torch.level === "supported") {
    entries.push({ id: "torch", constraint: { torch: settings.flash === "torch" } });
  }

  const focus = probe.controls.focus;
  if (focus.level !== "unavailable") {
    const modes = focus.values ?? [];
    const constraint: Record<string, unknown> = {};
    if (modes.includes(settings.focusMode)) constraint.focusMode = settings.focusMode;
    if (
      settings.focusMode === "manual" &&
      modes.includes("manual") &&
      focus.range
    ) {
      constraint.focusDistance = snapToRange(settings.focusDistance, focus.range);
    }
    if (Object.keys(constraint).length) entries.push({ id: "focus", constraint });
  }

  const white = probe.controls.whiteBalance;
  if (white.level === "supported" || (white.level === "partial" && white.appliedAt !== "preview")) {
    const modes = white.values ?? [];
    const constraint: Record<string, unknown> = {};
    const kelvin = kelvinFor(settings);
    const wantsManual = settings.wbLock || settings.whiteBalance !== "auto";
    if (!wantsManual && modes.includes("continuous")) {
      constraint.whiteBalanceMode = "continuous";
    } else if (wantsManual && white.appliedAt === "track") {
      if (modes.includes("manual")) constraint.whiteBalanceMode = "manual";
      if (white.range && kelvinInRange(settings.whiteBalance, kelvin, probe) && settings.whiteBalance !== "auto") {
        constraint.colorTemperature = snapToRange(kelvin, white.range);
      } else if (settings.wbLock && white.range) {
        constraint.colorTemperature = snapToRange(settings.kelvin, white.range);
      }
    }
    if (Object.keys(constraint).length) entries.push({ id: "whiteBalance", constraint });
  }

  const exposureChoices = probe.controls.exposureMode.values ?? [];
  if (probe.controls.exposureMode.level !== "unavailable") {
    if (settings.exposureMode === "manual" && exposureChoices.includes("manual")) {
      entries.push({ id: "exposureMode", constraint: { exposureMode: "manual" } });
    } else if (settings.exposureMode === "auto") {
      entries.push({ id: "exposureMode", constraint: { exposureMode: "continuous" } });
    }
  }

  if (
    settings.exposureMode === "manual" &&
    probe.controls.shutter.appliedAt === "track" &&
    probe.controls.shutter.level !== "unavailable" &&
    settings.shutterId !== "auto"
  ) {
    const seconds = shutterSeconds(settings.shutterId);
    if (seconds != null) {
      const shutter = probe.controls.shutter;
      entries.push({
        id: "shutter",
        constraint: {
          exposureTime: exposureDeviceValue(seconds, shutter.range, shutter.deviceFactor),
        },
      });
    }
  }

  if (
    settings.exposureMode === "manual" &&
    probe.controls.iso.appliedAt === "track" &&
    probe.controls.iso.level !== "unavailable" &&
    settings.isoId !== "auto"
  ) {
    entries.push({ id: "iso", constraint: { iso: Number(settings.isoId) } });
  }

  if (mode === "video" && probe.media.frameRate) {
    const { min, max } = probe.media.frameRate;
    if (settings.videoFps >= min && settings.videoFps <= max) {
      entries.push({ id: "frameRate", constraint: { frameRate: settings.videoFps } });
    }
  }

  if (mode === "video" && probe.media.width && probe.media.height) {
    const widthOk = settings.videoWidth >= probe.media.width.min && settings.videoWidth <= probe.media.width.max;
    const heightOk = settings.videoHeight >= probe.media.height.min && settings.videoHeight <= probe.media.height.max;
    if (widthOk && heightOk) {
      entries.push({
        id: "resolution",
        constraint: { width: settings.videoWidth, height: settings.videoHeight },
      });
    }
  }

  return entries;
}
