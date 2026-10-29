import type { CapabilityMap } from "./types";
import type { AppSettings } from "@/lib/storage/settings";
import { formatEv, formatExposureSeconds, formatZoom, shutterById } from "./stops";
import { kelvinFor } from "./wb";

export function exposureSummary(
  settings: AppSettings,
  probe: CapabilityMap | null,
  confirmed: Record<string, unknown>,
) {
  if (!probe) return "Waiting for the camera";
  const parts: string[] = [];
  if (probe.controls.exposureMode.level === "unavailable") parts.push("Camera auto");
  else if (settings.exposureMode === "manual") parts.push("Manual");
  else parts.push("Auto");

  if (settings.exposureMode === "manual" && probe.controls.shutter.level !== "unavailable") {
    const reported = typeof confirmed.exposureTime === "number" ? confirmed.exposureTime : null;
    if (reported != null) {
      const factor = probe.controls.shutter.deviceFactor && probe.controls.shutter.deviceFactor > 0
        ? probe.controls.shutter.deviceFactor
        : 1;
      const label = formatExposureSeconds(reported / factor);
      if (label) parts.push(probe.controls.shutter.appliedAt === "still" ? `${label} still` : label);
    } else if (settings.shutterId !== "auto") {
      const label = shutterById(settings.shutterId).label;
      parts.push(probe.controls.shutter.appliedAt === "still" ? `${label} still` : label);
    }
  }

  if (
    settings.exposureMode === "manual" &&
    probe.controls.iso.level !== "unavailable" &&
    settings.isoId !== "auto"
  ) {
    parts.push(`ISO ${settings.isoId}`);
  }

  if (settings.exposureMode !== "manual" && probe.controls.ev.level === "supported") {
    const ev = typeof confirmed.exposureCompensation === "number" ? confirmed.exposureCompensation : settings.ev;
    parts.push(formatEv(ev));
  }

  if (probe.controls.zoom.level === "supported") {
    const zoom = typeof confirmed.zoom === "number" ? confirmed.zoom : settings.zoom;
    if (typeof zoom === "number") parts.push(`Digital ${formatZoom(zoom, probe.controls.zoom.range)}`);
  }

  if (probe.controls.whiteBalance.level === "preview-only" && settings.whiteBalance !== "auto") {
    parts.push(`Preview ${Math.round(kelvinFor(settings))}K`);
  }

  return parts.join(" · ");
}

export function shutterWarning(settings: AppSettings, probe: CapabilityMap | null, rejected: boolean) {
  if (!probe || rejected || probe.controls.shutter.level === "unavailable") return null;
  if (settings.exposureMode !== "manual" || settings.shutterId === "auto") return null;
  const seconds = shutterById(settings.shutterId).seconds;
  if (seconds === "auto") return null;
  if (seconds >= 1) return "Tripod recommended. This duration is requested for the still, not simulated in the preview.";
  if (seconds >= 1 / 30) return "Slow shutter. Motion and camera shake may blur the still.";
  return null;
}

export function isoWarning(settings: AppSettings, probe: CapabilityMap | null, rejected: boolean) {
  if (!probe || rejected || probe.controls.iso.level === "unavailable") return null;
  if (settings.exposureMode !== "manual" || settings.isoId === "auto") return null;
  if (Number(settings.isoId) >= 3200) return "High ISO may increase noise in the capture.";
  return null;
}
