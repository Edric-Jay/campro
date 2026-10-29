import { describe, expect, it } from "vitest";
import { previewFacingOf, previewOutputSize } from "./preview-still";
import { coverCrop } from "@/lib/lut/renderer";

describe("preview-matching stills", () => {
  it("builds landscape output for a landscape preview box", () => {
    const out = previewOutputSize(4032, 3024, 800, 450);
    expect(out.width).toBeGreaterThan(out.height);
    expect(out.width / out.height).toBeCloseTo(800 / 450, 2);
  });

  it("builds portrait output for a portrait preview box", () => {
    const out = previewOutputSize(4032, 3024, 450, 800);
    expect(out.height).toBeGreaterThan(out.width);
    expect(out.width / out.height).toBeCloseTo(450 / 800, 2);
  });

  it("uses the same cover math as the live viewfinder", () => {
    const crop = coverCrop(1920, 1080, 400, 800);
    expect(crop.u0).toBeGreaterThan(0);
    expect(crop.v0).toBe(0);
    expect(previewFacingOf(400, 800)).toBe("portrait");
    expect(previewFacingOf(800, 400)).toBe("landscape");
  });
});
