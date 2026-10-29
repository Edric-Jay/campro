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

function mix3(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function scale3(rgb: Rgb, gain: Rgb): Rgb {
  return [rgb[0] * gain[0], rgb[1] * gain[1], rgb[2] * gain[2]];
}

/** Same branches as the live preview shader, so the look cards match the camera. */
export function gradeBuiltinColor(rgb: Rgb, look: number): Rgb {
  const l = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const luma: Rgb = [l, l, l];
  const contrast = (value: Rgb, amount: number, pivot = 0.5): Rgb => [
    (value[0] - 0.5) * amount + pivot,
    (value[1] - 0.5) * amount + pivot,
    (value[2] - 0.5) * amount + pivot,
  ];
  let result = rgb;
  if (look < 0.5) result = contrast(rgb, 1.06);
  else if (look < 1.5) result = contrast(scale3(rgb, [1.08, 1.02, 0.94]), 1.08);
  else if (look < 2.5) {
    result = scale3(rgb, [1.14, 1.02, 0.84]);
    result = [
      result[0] + 0.045 * l - 0.03 * (1 - l),
      result[1] + 0.012 * l + 0.02 * (1 - l),
      result[2] - 0.03 * l + 0.06 * (1 - l),
    ];
  } else if (look < 3.5) result = contrast(scale3(rgb, [0.9, 0.98, 1.16]), 1.16, 0.48);
  else if (look < 4.5) {
    result = scale3(rgb, [0.92, 1, 1.12]);
    result = [result[0] - 0.01, result[1] + 0.01, result[2] + 0.03];
  } else if (look < 5.5) result = mix3(contrast(rgb, 0.75, 0.56), luma, 0.28);
  else if (look < 6.5) result = contrast(scale3(rgb, [1.12, 1.03, 0.86]), 0.9, 0.52);
  else if (look < 7.5) result = contrast(scale3(rgb, [0.94, 1.1, 0.9]), 0.88, 0.53);
  else if (look < 8.5) result = contrast(scale3(rgb, [1.08, 1, 0.92]), 0.92, 0.51);
  else if (look < 9.5) result = contrast(scale3(rgb, [1.05, 1.01, 0.95]), 0.86, 0.52);
  else if (look < 10.5) result = mix3(luma, contrast(rgb, 1.32), 0.4);
  else if (look < 11.5) {
    const g = clamp01((l - 0.5) * 1.15 + 0.5);
    result = [g, g, g];
  } else if (look < 12.5) {
    result = scale3(rgb, [0.91, 1.01, 1.1]);
    result = [result[0] + 0.035 * l, result[1] + 0.012 * l, result[2] - 0.008 * l];
  } else if (look < 13.5) result = contrast(scale3(rgb, [1.09, 1.015, 0.91]), 0.88, 0.53);
  else if (look < 14.5) {
    const g = (l - 0.5) * 1.13 + 0.5;
    result = [g, g, g];
  } else if (look < 15.5) {
    result = scale3(rgb, [1.12, 1.02, 0.86]);
    result = [result[0] + 0.045 * l, result[1] + 0.018 * l, result[2] - 0.025 * l];
  } else if (look < 16.5) {
    result = contrast(rgb, 1.18);
    result = mix3(luma, scale3(result, [1.04, 1, 0.96]), 0.8);
  } else if (look < 17.5) {
    result = scale3(rgb, [0.96, 1.08, 0.91]);
    result = [result[0], result[1] + 0.025 * (1 - l), result[2]];
  } else if (look < 18.5) {
    result = [
      rgb[0] + 0.055 * l,
      rgb[1] + 0.025 * (1 - l),
      (rgb[2] + 0.045 * (1 - l)) * 0.94,
    ];
  } else if (look < 19.5) result = mix3(contrast(rgb, 0.78, 0.55), [l * 0.8 + 0.15, l * 0.8 + 0.15, l * 0.8 + 0.15], 0.15);
  else if (look < 20.5) {
    const g = clamp01((l - 0.5) * 1.45 + 0.5);
    result = [g, g, g];
  } else if (look < 21.5) {
    result = scale3(rgb, [0.88, 1.04, 1.15]);
    result = [result[0] - 0.015, result[1] + 0.015, result[2] + 0.035];
  } else if (look < 22.5) result = contrast(scale3(rgb, [1.1, 1.02, 0.88]), 0.85, 0.55);
  else if (look < 23.5) {
    result = mix3(rgb, luma, 0.18);
    result = [result[0] * 0.88 + 0.08 + 0.045, result[1] * 0.88 + 0.08 + 0.015, result[2] * 0.88 + 0.08 + 0.035];
  } else {
    result = contrast(rgb, 1.16, 0.46);
    result = [
      result[0] - 0.03 * (1 - l) + 0.06 * l,
      result[1] + 0.02 * (1 - l) + 0.025 * l,
      result[2] + 0.04 * (1 - l) - 0.03 * l,
    ];
    result = [result[0] * 1.08, result[1] + 0.015, result[2]];
    const edge = Math.min(1, Math.max(0, (l - 0.72) / 0.26));
    const blow = edge * edge * (3 - 2 * edge) * 0.35;
    result = [result[0] + (1 - result[0]) * blow, result[1] + (1 - result[1]) * blow, result[2] + (1 - result[2]) * blow];
  }
  return [clamp01(result[0]), clamp01(result[1]), clamp01(result[2])];
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
