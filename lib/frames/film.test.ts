import { describe, expect, it } from "vitest";
import { frameLayout, imageWindowAspect, resolveOrientation } from "./film";

describe("film frames", () => {
  it("follows the photo aspect unless portrait or landscape is chosen", () => {
    expect(resolveOrientation("auto", 1280, 720)).toBe("landscape");
    expect(resolveOrientation("auto", 720, 1280)).toBe("portrait");
    expect(resolveOrientation("portrait", 1280, 720)).toBe("portrait");
    expect(resolveOrientation("landscape", 720, 1280)).toBe("landscape");
  });

  it("keeps a printable window in both orientations", () => {
    for (const id of ["instax", "instax-wide", "polaroid", "film-35", "classic"] as const) {
      for (const orientation of ["portrait", "landscape"] as const) {
        const layout = frameLayout(id, orientation);
        expect(layout).not.toBeNull();
        if (!layout) continue;
        const windowWidth = 1 - layout.padLeft - layout.padRight;
        const windowHeight = 1 - layout.padTop - layout.padBottom;
        expect(windowWidth).toBeGreaterThan(0.5);
        expect(windowHeight).toBeGreaterThan(0.5);
        if (orientation === "landscape") expect(layout.outerAspect).toBeGreaterThan(1);
        else expect(layout.outerAspect).toBeLessThan(1);
        const aspect = imageWindowAspect(id, orientation);
        expect(aspect).toBeCloseTo((layout.outerAspect * windowWidth) / windowHeight, 5);
        if (orientation === "landscape") expect(aspect).toBeGreaterThan(1);
        else expect(aspect).toBeLessThanOrEqual(1.05);
      }
    }
  });
});