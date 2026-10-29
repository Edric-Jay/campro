import type {
  AppliedAt,
  CapabilityMap,
  ControlId,
  ControlState,
  NumericRange,
  ProbeSources,
} from "./types";
import { CONTROL_IDS } from "./types";

function asRange(value: unknown): NumericRange | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.min !== "number" || typeof record.max !== "number") return undefined;
  if (record.max < record.min) return undefined;
  return {
    min: record.min,
    max: record.max,
    step: typeof record.step === "number" && record.step > 0 ? record.step : undefined,
  };
}

function asStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function state(level: ControlState["level"], reason: string, extra?: Partial<ControlState>): ControlState {
  return { level, reason, ...extra };
}

const HUNDRED_MICROSECONDS = 10_000;

/** Chrome on Windows reports exposureTime in 100 µs, not the spec's seconds. */
export function normalizeExposure(range: NumericRange) {
  if (range.min >= 1 && range.max >= 100) {
    return {
      range: {
        min: range.min / HUNDRED_MICROSECONDS,
        max: range.max / HUNDRED_MICROSECONDS,
        step: range.step ? range.step / HUNDRED_MICROSECONDS : undefined,
      },
      deviceFactor: HUNDRED_MICROSECONDS,
    };
  }
  return { range, deviceFactor: 1 };
}

function firstRange(sources: ProbeSources, key: string) {
  const photo = asRange(sources.photoCapabilities?.[key]);
  const track = asRange(sources.trackCapabilities[key]);
  if (photo) return { range: photo, appliedAt: "still" as AppliedAt };
  if (track) return { range: track, appliedAt: "track" as AppliedAt };
  return null;
}

function apertureValue(sources: ProbeSources) {
  const range =
    asRange(sources.trackCapabilities.aperture) ??
    asRange(sources.trackCapabilities.fNumber) ??
    asRange(sources.photoCapabilities?.aperture);
  const reported =
    asNumber(sources.trackSettings.aperture) ??
    asNumber(sources.trackSettings.fNumber) ??
    asNumber(sources.photoSettings?.aperture);
  return { range, reported };
}

export function mapCapabilities(sources: ProbeSources): CapabilityMap {
  const caps = sources.trackCapabilities;
  const photo = sources.photoCapabilities;
  const shutterRaw = firstRange(sources, "exposureTime");
  const shutter = shutterRaw
    ? { ...shutterRaw, ...normalizeExposure(shutterRaw.range) }
    : null;
  const iso = firstRange(sources, "iso");
  const ev = asRange(caps.exposureCompensation);
  const focusModes = asStrings(caps.focusMode);
  const focusDistance = asRange(caps.focusDistance);
  const whiteModes = [
    ...asStrings(caps.whiteBalanceMode),
    ...asStrings(photo?.whiteBalanceMode),
  ].filter((mode, index, all) => all.indexOf(mode) === index);
  const kelvin =
    asRange(caps.colorTemperature) ?? asRange(photo?.colorTemperature);
  const kelvinAt: AppliedAt | undefined = asRange(caps.colorTemperature)
    ? "track"
    : asRange(photo?.colorTemperature)
      ? "still"
      : undefined;
  const zoom = asRange(caps.zoom);
  const torch = caps.torch === true;
  const points = "pointsOfInterest" in caps && caps.pointsOfInterest !== false;
  const exposureModes = asStrings(caps.exposureMode);
  const fill = asStrings(photo?.fillLightMode);
  const redEye = photo?.redEyeReduction === "controllable";
  const aperture = apertureValue(sources);

  const flashValues = new Set<string>();
  if (torch) {
    flashValues.add("off");
    flashValues.add("torch");
  }
  if (fill.includes("off")) flashValues.add("off");
  if (fill.includes("auto")) flashValues.add("auto");
  if (fill.includes("flash")) flashValues.add("on");
  if (redEye) flashValues.add("red-eye");

  const canManual = Boolean(shutter || iso);
  const exposureValues = ["auto"];
  if (canManual || exposureModes.includes("manual")) exposureValues.push("manual");

  const controls: Record<ControlId, ControlState> = {
    shutter: shutter
      ? state(
          "partial",
          shutter.appliedAt === "still"
            ? "Sent with the still through ImageCapture. The live viewfinder may not use this shutter speed."
            : "Applied with a camera-track constraint. The live value is whatever the device accepts.",
          {
            range: shutter.range,
            appliedAt: shutter.appliedAt,
            deviceFactor: shutter.deviceFactor,
            ...(shutter.deviceFactor !== 1
              ? {
                  reason:
                    shutter.appliedAt === "still"
                      ? "Sent with the still through ImageCapture, in the camera's 100-microsecond units. The dial is in seconds. The live viewfinder may not use this shutter speed."
                      : "Applied with a camera-track constraint. This browser reports exposure time in 100-microsecond units; the dial is in seconds. The live value is whatever the device accepts.",
                }
              : {}),
          },
        )
      : state(
          "unavailable",
          "This browser does not expose shutter speed. A brightness filter cannot change the sensor shutter.",
        ),
    iso: iso
      ? state(
          "partial",
          iso.appliedAt === "still"
            ? "Sent with the still through ImageCapture. Digital gain is not used as ISO."
            : "Applied with a camera-track constraint. Digital gain is not used as ISO.",
          { range: iso.range, appliedAt: iso.appliedAt },
        )
      : state(
          "unavailable",
          "This browser does not expose ISO. Digital brightness is not sensor ISO.",
        ),
    ev: ev
      ? state("supported", "Exposure compensation is applied to the camera track.", {
          range: ev,
          appliedAt: "track",
        })
      : state("unavailable", "This camera track does not expose exposure compensation."),
    focus:
      focusModes.length || focusDistance
        ? state(
            focusDistance && focusModes.includes("manual") ? "supported" : "partial",
            focusDistance
              ? "Focus mode and focus distance come from the camera track."
              : "Focus mode is exposed. Focus distance is not, so there is no manual-focus dial.",
            {
              values: focusModes,
              range: focusDistance,
              appliedAt: "track",
            },
          )
        : state(
            "unavailable",
            "This browser does not expose focus mode or focus distance. Sharpening is not focus.",
          ),
    whiteBalance:
      whiteModes.length || kelvin
        ? state(kelvin ? "supported" : "partial", kelvin
            ? "White balance is applied to the camera. Tint is not exposed."
            : "Only white-balance mode is exposed. Kelvin presets stay off because the camera has no color-temperature range.", {
            values: whiteModes,
            range: kelvin,
            appliedAt: kelvinAt ?? "track",
          })
        : state(
            "preview-only",
            "Preview white balance only. It changes the viewfinder grade and the saved JPEG, not the camera sensor.",
            { range: { min: 2000, max: 10000, step: 100 }, appliedAt: "preview" },
          ),
    aperture: aperture.range
      ? state(
          "partial",
          "Aperture was reported by the camera. This browser cannot change it, so the control stays read-only.",
          {
            range: aperture.range,
            readOnly: true,
            readOnlyValue: aperture.reported ?? aperture.range.min,
          },
        )
      : aperture.reported !== undefined
        ? state("supported", "Fixed aperture reported by the camera. It cannot be changed.", {
            readOnly: true,
            readOnlyValue: aperture.reported,
          })
        : state(
            "unavailable",
            "No aperture is reported. This app will not add an aperture slider for a fixed lens.",
          ),
    zoom:
      zoom && zoom.max > zoom.min
        ? state(
            "supported",
            "Digital zoom through the camera track. This does not switch to another physical lens.",
            { range: zoom, appliedAt: "track" },
          )
        : state("unavailable", "This camera track does not expose zoom."),
    torch: torch
      ? state("supported", "Torch is applied to the camera track.", {
          values: ["off", "on"],
          appliedAt: "track",
        })
      : state("unavailable", "This camera does not expose a torch."),
    metering: points
      ? state(
          "partial",
          "Tap the viewfinder to send an exposure point. Matrix, center-weighted, and spot modes are not available in the browser.",
          { appliedAt: "track" },
        )
      : state("unavailable", "This browser does not expose metering modes or an exposure point."),
    exposureMode:
      exposureValues.length > 1 || exposureModes.length > 0 || ev
        ? state(
            canManual ? "partial" : "supported",
            canManual
              ? "Auto uses the camera's continuous exposure. Manual sends shutter and ISO only when those controls exist. Shutter priority and ISO priority are not available."
              : "Only automatic exposure is available. Manual, shutter priority, and ISO priority are not exposed.",
            { values: exposureValues, appliedAt: "track" },
          )
        : state(
            "unavailable",
            "This browser does not expose exposure modes. The camera stays in its own auto exposure.",
            { values: ["auto"] },
          ),
    flash: flashValues.size
      ? state(
          fill.length || redEye ? "partial" : "supported",
          fill.length || redEye
            ? "Torch uses the camera track. Flash and red-eye are sent only when ImageCapture lists them."
            : "Only the torch is available. Auto flash, forced flash, and red-eye are not exposed.",
          { values: [...flashValues], appliedAt: fill.length ? "still" : "track" },
        )
      : state("unavailable", "This camera does not expose flash or torch."),
    raw: state(
      "unavailable",
      "Browsers cannot write RAW or DNG from this camera path. HEIF is also unavailable. Graded stills are JPEG.",
    ),
  };

  return {
    controls,
    hasImageCapture: sources.photoCapabilities !== null,
    trackSettings: sources.trackSettings,
    photoSettings: sources.photoSettings,
    media: {
      width: asRange(caps.width),
      height: asRange(caps.height),
      frameRate: asRange(caps.frameRate),
      focalLength: asNumber(sources.trackSettings.focalLength),
    },
  };
}

export function withRejection(map: CapabilityMap, id: ControlId, detail: string): CapabilityMap {
  const current = map.controls[id];
  return {
    ...map,
    controls: {
      ...map.controls,
      [id]: {
        ...current,
        level: "partial",
        reason: detail,
      },
    },
  };
}

export function emptyProbeSources(): ProbeSources {
  return {
    supportedConstraints: {},
    trackCapabilities: {},
    trackSettings: {},
    photoCapabilities: null,
    photoSettings: null,
  };
}

export function controlList(map: CapabilityMap) {
  return CONTROL_IDS.map((id) => ({ id, ...map.controls[id] }));
}
