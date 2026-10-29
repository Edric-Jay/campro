export type Rgb = [number, number, number];

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function channel(kelvin: number, kind: "r" | "g" | "b") {
  const temp = clamp(kelvin, 1000, 40000) / 100;
  if (kind === "r") {
    if (temp <= 66) return 255;
    return 329.698727446 * (temp - 60) ** -0.1332047592;
  }
  if (kind === "g") {
    if (temp <= 66) return 99.4708025861 * Math.log(temp) - 161.1195681661;
    return 288.1221695283 * (temp - 60) ** -0.0755148492;
  }
  if (temp >= 66) return 255;
  if (temp <= 19) return 0;
  return 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
}

function tempRgb(kelvin: number): Rgb {
  return [
    clamp(channel(kelvin, "r"), 0, 255) / 255,
    clamp(channel(kelvin, "g"), 0, 255) / 255,
    clamp(channel(kelvin, "b"), 0, 255) / 255,
  ];
}

export function kelvinGains(kelvin: number): Rgb {
  const neutral = tempRgb(6500);
  const target = tempRgb(kelvin);
  return [
    target[0] / Math.max(0.001, neutral[0]),
    target[1] / Math.max(0.001, neutral[1]),
    target[2] / Math.max(0.001, neutral[2]),
  ];
}

export function mixRgb(original: Rgb, graded: Rgb, intensity: number): Rgb {
  const amount = clamp01(intensity);
  return [
    original[0] + (graded[0] - original[0]) * amount,
    original[1] + (graded[1] - original[1]) * amount,
    original[2] + (graded[2] - original[2]) * amount,
  ];
}
