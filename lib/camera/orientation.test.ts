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

  it("leaves matching aspects alone", () => {
    expect(quarterTurnsToMatch(1920, 1080, "landscape", 90)).toBe(0);
    expect(quarterTurnsToMatch(1080, 1920, "portrait", 0)).toBe(0);
  });

  it("rotates portrait sensor stills for landscape prints", () => {
    expect(quarterTurnsToMatch(1080, 1920, "landscape", 90)).toBe(1);
    expect(quarterTurnsToMatch(1080, 1920, "landscape", 270)).toBe(3);
  });

  it("rotates landscape sensor stills for portrait prints", () => {
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 0)).toBe(1);
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 90)).toBe(3);
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 270)).toBe(1);
  });
});
