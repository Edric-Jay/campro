import type { AppSettings } from "@/lib/storage/settings";
import type { CapabilityMap } from "./types";
import { kelvinFor } from "./wb";
import { exposureDeviceValue, shutterSeconds, snapToRange } from "./stops";

export function buildStillOptions(settings: AppSettings, probe: CapabilityMap) {
  const options: Record<string, unknown> = {};
  if (settings.exposureMode === "manual") {
    if (probe.controls.shutter.appliedAt === "still" && probe.controls.shutter.level !== "unavailable") {
      const seconds = shutterSeconds(settings.shutterId);
      if (seconds != null && probe.controls.shutter.range) {
        const shutter = probe.controls.shutter;
        options.exposureTime = exposureDeviceValue(seconds, shutter.range, shutter.deviceFactor);
      }
    }
    if (
      probe.controls.iso.appliedAt === "still" &&
      probe.controls.iso.level !== "unavailable" &&
      settings.isoId !== "auto" &&
      probe.controls.iso.range
    ) {
      options.iso = snapToRange(Number(settings.isoId), probe.controls.iso.range);
    }
  }

  const white = probe.controls.whiteBalance;
  if (white.appliedAt === "still" && white.level !== "preview-only" && white.level !== "unavailable") {
    const modes = white.values ?? [];
    const kelvin = kelvinFor(settings);
    if ((settings.wbLock || settings.whiteBalance !== "auto") && modes.includes("manual")) {
      options.whiteBalanceMode = "manual";
      if (white.range) options.colorTemperature = snapToRange(kelvin, white.range);
    } else if (modes.includes("continuous")) {
      options.whiteBalanceMode = "continuous";
    }
  }

  const flash = new Set(probe.controls.flash.values ?? []);
  const photoFill = probe.controls.flash.appliedAt === "still" || flash.has("on") || flash.has("auto");
  if (settings.flash === "on" && flash.has("on")) options.fillLightMode = "flash";
  if (settings.flash === "auto" && flash.has("auto")) options.fillLightMode = "auto";
  if (settings.flash === "off" && photoFill && flash.has("off")) options.fillLightMode = "off";
  if (settings.flash === "red-eye" && flash.has("red-eye")) {
    options.redEyeReduction = true;
    if (flash.has("on")) options.fillLightMode = "flash";
  }
  return options;
}
