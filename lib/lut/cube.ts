import { clamp01 } from "./color";
import { bakeLut, type Lut3D } from "./grade";

export const MAX_CUBE_BYTES = 5 * 1024 * 1024;
export const MAX_CUBE_SIZE = 64;

export class CubeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CubeParseError";
  }
}

export interface ParsedCube {
  title: string;
  kind: "1d" | "3d";
  size: number;
  data: Float32Array;
}

function fail(message: string): never {
  throw new CubeParseError(message);
}

export function parseCube(text: string, byteLength = text.length): ParsedCube {
  if (byteLength > MAX_CUBE_BYTES) {
    fail(`LUT files must be ${MAX_CUBE_BYTES / (1024 * 1024)} MB or smaller.`);
  }

  let title = "Custom LUT";
  let kind: "1d" | "3d" | null = null;
  let size = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const samples: number[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith("TITLE")) {
      const quoted = line.match(/TITLE\s+"([^"]+)"/i);
      const plain = line.match(/TITLE\s+(\S+)/i);
      title = quoted?.[1] ?? plain?.[1] ?? title;
      continue;
    }
    if (upper.startsWith("LUT_3D_SIZE")) {
      kind = "3d";
      size = Number(line.split(/\s+/)[1]);
      continue;
    }
    if (upper.startsWith("LUT_1D_SIZE")) {
      kind = "1d";
      size = Number(line.split(/\s+/)[1]);
      continue;
    }
    if (upper.startsWith("DOMAIN_MIN")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) domainMin = parts;
      continue;
    }
    if (upper.startsWith("DOMAIN_MAX")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) domainMax = parts;
      continue;
    }
    if (upper.startsWith("LUT_") || upper.startsWith("DOMAIN_")) continue;

    const parts = line.split(/\s+/).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((value) => !Number.isFinite(value))) {
      fail("A LUT row was not three numbers.");
    }
    const span = domainMax.map((max, index) => max - domainMin[index]);
    samples.push(
      clamp01((parts[0] - domainMin[0]) / (span[0] || 1)),
      clamp01((parts[1] - domainMin[1]) / (span[1] || 1)),
      clamp01((parts[2] - domainMin[2]) / (span[2] || 1)),
    );
  }

  if (!kind || !Number.isInteger(size) || size < 2) fail("The LUT size is missing.");
  if (size > MAX_CUBE_SIZE) fail(`LUT size must be ${MAX_CUBE_SIZE} or smaller.`);
  const expected = kind === "3d" ? size ** 3 * 3 : size * 3;
  if (samples.length !== expected) {
    fail(`Expected ${expected / 3} color rows and found ${samples.length / 3}.`);
  }

  return { title, kind, size, data: Float32Array.from(samples) };
}

export function cubeToLut(parsed: ParsedCube, id: string): Lut3D {
  if (parsed.kind === "3d") {
    return { id, name: parsed.title, size: parsed.size, data: parsed.data };
  }
  const size = Math.min(33, MAX_CUBE_SIZE);
  const curve = parsed.data;
  const curveSize = parsed.size;
  const sampleCurve = (value: number, channel: number) => {
    const x = clamp01(value) * (curveSize - 1);
    const i0 = Math.floor(x);
    const i1 = Math.min(curveSize - 1, i0 + 1);
    const t = x - i0;
    const a = curve[i0 * 3 + channel];
    const b = curve[i1 * 3 + channel];
    return a + (b - a) * t;
  };
  const lut = bakeLut(
    {
      contrast: 1,
      saturation: 1,
      blackLift: 0,
      lift: [0, 0, 0],
      gain: [1, 1, 1],
      gamma: [1, 1, 1],
      monochrome: false,
    },
    size,
    id,
    parsed.title,
  );
  let index = 0;
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        lut.data[index] = sampleCurve(red / (size - 1), 0);
        lut.data[index + 1] = sampleCurve(green / (size - 1), 1);
        lut.data[index + 2] = sampleCurve(blue / (size - 1), 2);
        index += 3;
      }
    }
  }
  return lut;
}
