import type { WhiteBalanceChoice } from "./types";

export const WB_PRESETS: { id: WhiteBalanceChoice; label: string; kelvin: number | null }[] = [
  { id: "auto", label: "Auto", kelvin: null },
  { id: "daylight", label: "Daylight", kelvin: 5200 },
  { id: "cloudy", label: "Cloudy", kelvin: 6000 },
  { id: "shade", label: "Shade", kelvin: 7000 },
  { id: "tungsten", label: "Tungsten", kelvin: 3200 },
  { id: "fluorescent", label: "Fluorescent", kelvin: 4000 },
  { id: "flash", label: "Flash", kelvin: 5500 },
  { id: "kelvin", label: "Kelvin", kelvin: null },
];

export function kelvinFor(settings: { whiteBalance: WhiteBalanceChoice; kelvin: number }) {
  if (settings.whiteBalance === "kelvin" || settings.whiteBalance === "auto") return settings.kelvin;
  return WB_PRESETS.find((preset) => preset.id === settings.whiteBalance)?.kelvin ?? settings.kelvin;
}
