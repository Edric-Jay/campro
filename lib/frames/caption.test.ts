import { describe, expect, it } from "vitest";
import { captionBand, isCaptionFrame } from "./caption";
import { frameLayout } from "./film";

describe("print captions", () => {
  it("marks Instax and Polaroid as writable frames", () => {
    expect(isCaptionFrame("instax")).toBe(true);
    expect(isCaptionFrame("polaroid")).toBe(true);
    expect(isCaptionFrame("film-35")).toBe(false);
    expect(isCaptionFrame("none")).toBe(false);
  });

  it("places the caption band on the bottom white border", () => {
    const layout = frameLayout("instax", "portrait");
    expect(layout).not.toBeNull();
    if (!layout) return;
    const band = captionBand(layout);
    expect(band.top).toBeCloseTo(1 - layout.padBottom, 5);
    expect(band.height).toBeCloseTo(layout.padBottom, 5);
    expect(band.width).toBe(1);
  });
});
