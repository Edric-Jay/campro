import { describe, expect, it } from "vitest";
import { gradeBuiltinColor, gradeSample, bakeLut } from "./grade";
import { parseCube, CubeParseError } from "./cube";

const cube2 = `TITLE "test"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;

describe("cube parser", () => {
  it("parses a 3D LUT", () => {
    const parsed = parseCube(cube2);
    expect(parsed.kind).toBe("3d");
    expect(parsed.size).toBe(2);
    expect(parsed.title).toBe("test");
    expect(parsed.data).toHaveLength(24);
  });

  it("parses a 1D LUT", () => {
    const parsed = parseCube("LUT_1D_SIZE 2\n0 0 0\n1 1 1\n");
    expect(parsed.kind).toBe("1d");
    expect(parsed.data).toHaveLength(6);
  });

  it("rejects oversized files and lattices", () => {
    expect(() => parseCube("LUT_3D_SIZE 2\n0 0 0\n", 6 * 1024 * 1024)).toThrow(CubeParseError);
    expect(() => parseCube("LUT_3D_SIZE 65\n0 0 0\n")).toThrow(/64/);
    expect(() => parseCube("LUT_3D_SIZE 2\n0 0 0\n")).toThrow(/color rows/);
  });
});

describe("grade intensity", () => {
  it("returns the original color at 0% intensity", () => {
    const lut = bakeLut(
      {
        contrast: 1.4,
        saturation: 0.2,
        blackLift: 0.1,
        lift: [0.1, -0.1, 0.2],
        gain: [1.2, 0.8, 0.7],
        gamma: [0.8, 1.1, 1],
        monochrome: false,
      },
      5,
    );
    const original: [number, number, number] = [0.2, 0.5, 0.8];
    const graded = gradeSample(lut, original, 1);
    expect(graded).not.toEqual(original);
    expect(gradeSample(lut, original, 0)).toEqual(original);
  });

  it("applies the Chrome profile as a cooler grade", () => {
    const graded = gradeBuiltinColor([0.5, 0.5, 0.5], 12);
    expect(graded[2]).toBeGreaterThan(graded[0]);
  });

  it("blows highlights and warms a 2000s digicam grade", () => {
    const mid = gradeBuiltinColor([0.45, 0.45, 0.45], 24);
    const bright = gradeBuiltinColor([0.9, 0.9, 0.9], 24);
    expect(mid[0]).toBeGreaterThan(mid[2]);
    expect(bright[0]).toBeGreaterThan(0.9);
  });

  it("renders Mono and Noir as gray", () => {
    for (const look of [14, 20]) {
      const graded = gradeBuiltinColor([0.2, 0.7, 0.4], look);
      expect(graded[0]).toBeCloseTo(graded[1], 5);
      expect(graded[1]).toBeCloseTo(graded[2], 5);
    }
  });
});
