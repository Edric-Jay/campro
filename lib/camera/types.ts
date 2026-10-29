export type SupportLevel = "supported" | "partial" | "preview-only" | "unavailable";

export type FacingMode = "user" | "environment";

export type ControlId =
  | "shutter"
  | "iso"
  | "ev"
  | "focus"
  | "whiteBalance"
  | "aperture"
  | "zoom"
  | "torch"
  | "metering"
  | "exposureMode"
  | "flash"
  | "raw";

export type AppliedAt = "track" | "still" | "preview";

export type ExposureChoice = "auto" | "manual" | "shutter-priority" | "iso-priority";

export type FocusChoice = "continuous" | "single-shot" | "manual";

export type WhiteBalanceChoice =
  | "auto"
  | "daylight"
  | "cloudy"
  | "shade"
  | "tungsten"
  | "fluorescent"
  | "flash"
  | "kelvin";

export type FlashChoice = "off" | "auto" | "on" | "torch" | "red-eye";

export type CaptureMode = "photo" | "video";

export type GridMode = "off" | "thirds" | "golden";

export type OutputFormat = "jpeg" | "heif" | "raw";

export interface NumericRange {
  min: number;
  max: number;
  step?: number;
}

export interface ControlState {
  level: SupportLevel;
  reason: string;
  range?: NumericRange;
  values?: string[];
  readOnly?: boolean;
  readOnlyValue?: number;
  appliedAt?: AppliedAt;
  /** Multiply a value in the control's seconds (or display) range to get the number the device expects. */
  deviceFactor?: number;
}

export interface MediaRanges {
  width?: NumericRange;
  height?: NumericRange;
  frameRate?: NumericRange;
  focalLength?: number;
}

export interface CapabilityMap {
  controls: Record<ControlId, ControlState>;
  hasImageCapture: boolean;
  trackSettings: Record<string, unknown>;
  photoSettings: Record<string, unknown> | null;
  media: MediaRanges;
}

export interface ProbeSources {
  supportedConstraints: Record<string, boolean>;
  trackCapabilities: Record<string, unknown>;
  trackSettings: Record<string, unknown>;
  photoCapabilities: Record<string, unknown> | null;
  photoSettings: Record<string, unknown> | null;
}

export const CONTROL_IDS: ControlId[] = [
  "shutter",
  "iso",
  "ev",
  "focus",
  "whiteBalance",
  "aperture",
  "zoom",
  "torch",
  "metering",
  "exposureMode",
  "flash",
  "raw",
];
