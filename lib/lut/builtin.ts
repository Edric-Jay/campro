import { bakeLut, type Lut3D } from "./grade";
import type { GradeParams } from "./grade";

export interface LookDefinition {
  id: string;
  name: string;
  note: string;
  params: GradeParams;
}

const neutral = {
  contrast: 1,
  saturation: 1,
  blackLift: 0,
  lift: [0, 0, 0] as [number, number, number],
  gain: [1, 1, 1] as [number, number, number],
  gamma: [1, 1, 1] as [number, number, number],
  monochrome: false,
};

export const LOOKS: LookDefinition[] = [
  {
    id: "natural",
    name: "Natural",
    note: "Restrained contrast and realistic color.",
    params: { ...neutral, contrast: 1.04, saturation: 0.98 },
  },
  {
    id: "cinema",
    name: "Cinema",
    note: "Warm highlights and controlled shadows.",
    params: {
      ...neutral,
      contrast: 1.08,
      saturation: 0.92,
      blackLift: 0.02,
      lift: [-0.012, 0.004, 0.02],
      gain: [1.06, 1.02, 0.96],
    },
  },
  {
    id: "golden-teal",
    name: "Golden Teal",
    note: "Warm skin and teal-leaning shadows.",
    params: {
      ...neutral,
      contrast: 1.06,
      saturation: 0.9,
      lift: [-0.02, 0.012, 0.04],
      gain: [1.08, 1.03, 0.94],
    },
  },
  {
    id: "deep-blue",
    name: "Deep Blue",
    note: "Cool shadows and dense blacks.",
    params: {
      ...neutral,
      contrast: 1.14,
      saturation: 0.86,
      lift: [-0.018, 0, 0.045],
      gain: [0.97, 0.99, 1.05],
    },
  },
  {
    id: "clean-blue",
    name: "Clean Blue",
    note: "Cooler neutrals and clear highlights.",
    params: {
      ...neutral,
      contrast: 1.05,
      saturation: 0.94,
      lift: [-0.01, 0.002, 0.02],
      gain: [0.98, 1, 1.04],
    },
  },
  {
    id: "faded-film",
    name: "Faded Film",
    note: "Muted color and lifted blacks.",
    params: {
      ...neutral,
      contrast: 0.9,
      saturation: 0.76,
      blackLift: 0.08,
      lift: [0.012, 0.008, 0.004],
      gain: [1.03, 1, 0.97],
    },
  },
  {
    id: "warm-film",
    name: "Warm Film",
    note: "Warm highlights and a gentle color response.",
    params: {
      ...neutral,
      contrast: 1.03,
      saturation: 0.9,
      blackLift: 0.03,
      lift: [0.012, 0.004, -0.008],
      gain: [1.08, 1.02, 0.94],
    },
  },
  {
    id: "soft-film",
    name: "Soft Film",
    note: "Lower saturation and a green-sensitive tone.",
    params: {
      ...neutral,
      contrast: 0.96,
      saturation: 0.8,
      blackLift: 0.02,
      lift: [-0.004, 0.016, 0.004],
      gain: [1.01, 1.03, 0.98],
    },
  },
  {
    id: "portrait",
    name: "Portrait",
    note: "Soft contrast and natural-looking skin tones.",
    params: {
      ...neutral,
      contrast: 0.98,
      saturation: 0.9,
      blackLift: 0.015,
      lift: [0.014, 0.004, 0.002],
      gain: [1.05, 1.01, 0.97],
    },
  },
  {
    id: "cinema-soft",
    name: "Cinema Soft",
    note: "Subdued saturation and separated tones.",
    params: {
      ...neutral,
      contrast: 1.04,
      saturation: 0.78,
      blackLift: 0.025,
      lift: [-0.008, 0.006, 0.016],
      gain: [1.03, 1.01, 0.98],
    },
  },
  {
    id: "bleach-bypass",
    name: "Bleach Bypass",
    note: "High contrast and reduced saturation.",
    params: {
      ...neutral,
      contrast: 1.28,
      saturation: 0.42,
      gain: [1.04, 1.03, 1.02],
    },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    note: "Black and white, with contrast you can lower via intensity.",
    params: {
      ...neutral,
      contrast: 1.12,
      saturation: 0,
      blackLift: 0.01,
      monochrome: true,
    },
  },
];

const cache = new Map<string, Lut3D>();

export function builtinLut(id: string) {
  const existing = cache.get(id);
  if (existing) return existing;
  const look = LOOKS.find((item) => item.id === id) ?? LOOKS[0];
  const lut = bakeLut(look.params, 33, look.id, look.name);
  cache.set(look.id, lut);
  return lut;
}

export function builtinLuts() {
  return LOOKS.map((look) => builtinLut(look.id));
}
