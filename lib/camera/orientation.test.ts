import { describe, expect, it } from "vitest";
import { quarterTurnsToMatch, resolveCaptureOrientation, viewfinderOrientation } from "./orientation";

describe("still orientation", () => {
  it("reads landscape from the viewfinder box", () => {
    expect(viewfinderOrientation({ clientWidth: 800, clientHeight: 400 })).toBe("landscape");
    expect(viewfinderOrientation({ clientWidth: 400, clientHeight: 800 })).toBe("portrait");
    expect(viewfinderOrientation(null)).toBeNull();
  });

  it("lets a locked print orientation win over the viewfinder", () => {
    expect(resolveCaptureOrientation("landscape", { clientWidth: 400, clientHeight: 800 })).toBe("landscape");
    expect(resolveCaptureOrientation("portrait", { clientWidth: 800, clientHeight: 400 })).toBe("portrait");
    expect(resolveCaptureOrientation("auto", { clientWidth: 800, clientHeight: 400 })).toBe("landscape");
  });

  it("keeps landscape-right stills upright when the aspect already matches", () => {
    expect(quarterTurnsToMatch(1920, 1080, "landscape", 90, "primary")).toBe(0);
  });

  it("half-turns landscape-left stills that already look landscape (otherwise they look flipped)", () => {
    expect(quarterTurnsToMatch(1920, 1080, "landscape", 270, "secondary")).toBe(2);
    expect(quarterTurnsToMatch(1920, 1080, "landscape", 270)).toBe(2);
  });

  it("rotates portrait sensor stills for both landscape sides", () => {
    expect(quarterTurnsToMatch(1080, 1920, "landscape", 90, "primary")).toBe(1);
    expect(quarterTurnsToMatch(1080, 1920, "landscape", 270, "secondary")).toBe(3);
  });

  it("rotates landscape sensor stills for portrait prints", () => {
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 0, "primary", false)).toBe(1);
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 180, "primary", true)).toBe(3);
  });
});
