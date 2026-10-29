import { clamp01, type Rgb } from "./color";

export interface GradeParams {
  contrast: number;
  saturation: number;
  blackLift: number;
  lift: Rgb;
  gain: Rgb;
  gamma: Rgb;
  monochrome: boolean;
}

export const IDENTITY_GRADE: GradeParams = {
  contrast: 1,
  saturation: 1,
  blackLift: 0,
  lift: [0, 0, 0],
  gain: [1, 1, 1],
  gamma: [1, 1, 1],
  monochrome: false,
};

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function applyGrade(rgb: Rgb, params: GradeParams): Rgb {
  let r = rgb[0] * (1 - params.blackLift) + params.blackLift;
  let g = rgb[1] * (1 - params.blackLift) + params.blackLift;
  let b = rgb[2] * (1 - params.blackLift) + params.blackLift;

  r = (r - 0.5) * params.contrast + 0.5;
  g = (g - 0.5) * params.contrast + 0.5;
  b = (b - 0.5) * params.contrast + 0.5;

  const luma = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const shadow = 1 - smoothstep(0.12, 0.55, luma);
  const highlight = smoothstep(0.45, 0.9, luma);

  r += params.lift[0] * shadow;
  g += params.lift[1] * shadow;
  b += params.lift[2] * shadow;
  r *= 1 + (params.gain[0] - 1) * (0.35 + highlight);
  g *= 1 + (params.gain[1] - 1) * (0.35 + highlight);
  b *= 1 + (params.gain[2] - 1) * (0.35 + highlight);

  r = Math.pow(clamp01(r), 1 / params.gamma[0]);
  g = Math.pow(clamp01(g), 1 / params.gamma[1]);
  b = Math.pow(clamp01(b), 1 / params.gamma[2]);

  if (params.monochrome) {
    const y = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
    return [y, y, y];
  }

  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [
    clamp01(y + (r - y) * params.saturation),
    clamp01(y + (g - y) * params.saturation),
    clamp01(y + (b - y) * params.saturation),
  ];
}

export interface Lut3D {
  id: string;
  name: string;
  size: number;
  data: Float32Array;
}

export function bakeLut(params: GradeParams, size = 33, id = "lut", name = "LUT"): Lut3D {
  const data = new Float32Array(size * size * size * 3);
  let index = 0;
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        const graded = applyGrade(
          [red / (size - 1), green / (size - 1), blue / (size - 1)],
          params,
        );
        data[index] = graded[0];
        data[index + 1] = graded[1];
        data[index + 2] = graded[2];
        index += 3;
      }
    }
  }
  return { id, name, size, data };
}

function lattice(data: Float32Array, size: number, red: number, green: number, blue: number): Rgb {
  const index = ((blue * size + green) * size + red) * 3;
  return [data[index], data[index + 1], data[index + 2]];
}

export function sampleLut(lut: Pick<Lut3D, "data" | "size">, rgb: Rgb): Rgb {
  const size = lut.size;
  const x = clamp01(rgb[0]) * (size - 1);
  const y = clamp01(rgb[1]) * (size - 1);
  const z = clamp01(rgb[2]) * (size - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const z1 = Math.min(size - 1, z0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const tz = z - z0;
  const c000 = lattice(lut.data, size, x0, y0, z0);
  const c100 = lattice(lut.data, size, x1, y0, z0);
  const c010 = lattice(lut.data, size, x0, y1, z0);
  const c110 = lattice(lut.data, size, x1, y1, z0);
  const c001 = lattice(lut.data, size, x0, y0, z1);
  const c101 = lattice(lut.data, size, x1, y0, z1);
  const c011 = lattice(lut.data, size, x0, y1, z1);
  const c111 = lattice(lut.data, size, x1, y1, z1);
  const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const c00 = mix(c000, c100, tx);
  const c10 = mix(c010, c110, tx);
  const c01 = mix(c001, c101, tx);
  const c11 = mix(c011, c111, tx);
  return mix(mix(c00, c10, ty), mix(c01, c11, ty), tz);
}

export function gradeSample(lut: Pick<Lut3D, "data" | "size">, rgb: Rgb, intensity: number): Rgb {
  return mixRgbSafe(rgb, sampleLut(lut, rgb), intensity);
}

function mixRgbSafe(original: Rgb, graded: Rgb, intensity: number): Rgb {
  const amount = clamp01(intensity);
  return [
    original[0] + (graded[0] - original[0]) * amount,
    original[1] + (graded[1] - original[1]) * amount,
    original[2] + (graded[2] - original[2]) * amount,
  ];
}
