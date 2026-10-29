import { describe, expect, it } from "vitest";
import { mapCapabilities, withRejection } from "./probe";
import type { ProbeSources } from "./types";
import { trackConstraintsFor } from "./constraints";
import { buildStillOptions } from "./still-options";
import { formatExposureSeconds, formatZoom, isoEnabled, shutterEnabled } from "./stops";
import { DEFAULT_SETTINGS } from "@/lib/storage/settings";

const desktop: ProbeSources = {
  supportedConstraints: { width: true, height: true, frameRate: true, facingMode: true },
  trackCapabilities: {
    width: { min: 1, max: 1280 },
    height: { min: 1, max: 720 },
    frameRate: { min: 1, max: 30 },
    facingMode: ["user"],
    brightness: { min: 0, max: 2 },
  },
  trackSettings: { width: 1280, height: 720, frameRate: 30 },
  photoCapabilities: null,
  photoSettings: null,
};

const android: ProbeSources = {
  supportedConstraints: {},
  trackCapabilities: {
    width: { min: 1, max: 4000 },
    height: { min: 1, max: 3000 },
    frameRate: { min: 1, max: 60 },
    facingMode: ["environment", "user"],
    zoom: { min: 1, max: 8, step: 0.1 },
    torch: true,
    focusMode: ["manual", "single-shot", "continuous"],
    focusDistance: { min: 0.1, max: 10, step: 0.1 },
    exposureMode: ["manual", "continuous"],
    exposureCompensation: { min: -3, max: 3, step: 0.166 },
    whiteBalanceMode: ["manual", "continuous"],
    colorTemperature: { min: 2500, max: 8000, step: 50 },
    pointsOfInterest: true,
  },
  trackSettings: { zoom: 1, facingMode: "environment" },
  photoCapabilities: {
    exposureTime: { min: 1 / 8000, max: 1, step: 0.0001 },
    iso: { min: 50, max: 6400, step: 1 },
    fillLightMode: ["off", "auto", "flash"],
    redEyeReduction: "controllable",
  },
  photoSettings: {},
};

describe("mapCapabilities", () => {
  it("keeps a desktop webcam honest", () => {
    const mapped = mapCapabilities(desktop);
    expect(mapped.controls.shutter.level).toBe("unavailable");
    expect(mapped.controls.iso.level).toBe("unavailable");
    expect(mapped.controls.ev.level).toBe("unavailable");
    expect(mapped.controls.focus.level).toBe("unavailable");
    expect(mapped.controls.whiteBalance.level).toBe("preview-only");
    expect(mapped.controls.zoom.level).toBe("unavailable");
    expect(mapped.controls.torch.level).toBe("unavailable");
    expect(mapped.controls.aperture.level).toBe("unavailable");
    expect(mapped.controls.raw.level).toBe("unavailable");
    expect(mapped.controls.metering.level).toBe("unavailable");
  });

  it("does not treat brightness as ISO", () => {
    expect(mapCapabilities(desktop).controls.iso.reason.toLowerCase()).toContain("iso");
    expect(mapCapabilities(desktop).controls.iso.level).not.toBe("supported");
  });

  it("maps a richer phone track without inventing priority modes", () => {
    const mapped = mapCapabilities(android);
    expect(mapped.controls.shutter.level).toBe("partial");
    expect(mapped.controls.shutter.appliedAt).toBe("still");
    expect(mapped.controls.iso.appliedAt).toBe("still");
    expect(mapped.controls.ev.level).toBe("supported");
    expect(mapped.controls.zoom.level).toBe("supported");
    expect(mapped.controls.torch.level).toBe("supported");
    expect(mapped.controls.focus.level).toBe("supported");
    expect(mapped.controls.whiteBalance.level).toBe("supported");
    expect(mapped.controls.metering.level).toBe("partial");
    expect(mapped.controls.exposureMode.values).toContain("manual");
    expect(mapped.controls.exposureMode.values).not.toContain("shutter-priority");
    expect(mapped.controls.raw.level).toBe("unavailable");
    expect(mapped.controls.flash.values).toEqual(expect.arrayContaining(["torch", "auto", "on", "red-eye"]));
  });

  it("marks a rejected control partial without changing the others", () => {
    const mapped = mapCapabilities(android);
    const rejected = withRejection(mapped, "zoom", "The camera rejected this zoom.");
    expect(rejected.controls.zoom.level).toBe("partial");
    expect(rejected.controls.zoom.reason).toContain("rejected");
    expect(rejected.controls.iso.level).toBe(mapped.controls.iso.level);
    expect(rejected.controls.ev.level).toBe("supported");
  });
});

describe("still and track options", () => {
  it("sends manual shutter and ISO only when the still API has them", () => {
    const probe = mapCapabilities(android);
    const manual = buildStillOptions(
      { ...DEFAULT_SETTINGS, exposureMode: "manual", shutterId: "1/125", isoId: "400", flash: "on" },
      probe,
    );
    expect(manual.exposureTime).toBeCloseTo(1 / 125, 4);
    expect(manual.iso).toBe(400);
    expect(manual.fillLightMode).toBe("flash");

    const auto = buildStillOptions(
      { ...DEFAULT_SETTINGS, exposureMode: "auto", shutterId: "1/125", isoId: "400" },
      probe,
    );
    expect(auto.exposureTime).toBeUndefined();
    expect(auto.iso).toBeUndefined();
  });

  it("does not invent shutter or ISO on a desktop camera", () => {
    const probe = mapCapabilities(desktop);
    const options = buildStillOptions(
      { ...DEFAULT_SETTINGS, exposureMode: "manual", shutterId: "1/125", isoId: "400" },
      probe,
    );
    expect(options.exposureTime).toBeUndefined();
    expect(options.iso).toBeUndefined();
  });

  it("keeps exposure compensation off the track while manual", () => {
    const probe = mapCapabilities(android);
    const manual = trackConstraintsFor(
      { ...DEFAULT_SETTINGS, exposureMode: "manual", ev: 1, zoom: 2 },
      probe,
      "photo",
    );
    expect(manual.find((entry) => entry.id === "ev")).toBeUndefined();
    expect(manual.find((entry) => entry.id === "zoom")?.constraint).toEqual({ zoom: 2 });
    expect(manual.find((entry) => entry.id === "iso")).toBeUndefined();
    expect(manual.find((entry) => entry.id === "shutter")).toBeUndefined();

    const auto = trackConstraintsFor({ ...DEFAULT_SETTINGS, exposureMode: "auto", ev: 0.3 }, probe, "photo");
    expect(auto.find((entry) => entry.id === "ev")?.constraint.exposureCompensation).toEqual(expect.any(Number));
    expect(auto.find((entry) => entry.id === "exposureMode")?.constraint).toEqual({ exposureMode: "continuous" });
  });
});

describe("stop lists", () => {
  it("disables shutter and ISO values outside the reported range", () => {
    expect(shutterEnabled("1/8000", { min: 1 / 1000, max: 1 }, true)).toBe(false);
    expect(shutterEnabled("1/125", { min: 1 / 1000, max: 1 }, true)).toBe(true);
    expect(shutterEnabled("auto", { min: 1 / 1000, max: 1 }, true)).toBe(true);
    expect(shutterEnabled("auto", { min: 1 / 1000, max: 1 }, false)).toBe(false);
    expect(isoEnabled("25600", { min: 50, max: 3200 }, true)).toBe(false);
    expect(isoEnabled("800", { min: 50, max: 3200 }, true)).toBe(true);
    expect(isoEnabled("auto", { min: 50, max: 3200 }, true)).toBe(true);
  });

  it("shows a percentage zoom range as a magnification", () => {
    expect(formatZoom(100, { min: 100, max: 400, step: 10 })).toBe("1.00×");
    expect(formatZoom(1, { min: 1, max: 8, step: 0.1 })).toBe("1.00×");
    expect(formatExposureSeconds(1 / 60)).toBe("1/60");
    expect(formatExposureSeconds(0.03125)).toBe("1/32");
  });
});

describe("windows exposure units", () => {
  const windows: ProbeSources = {
    supportedConstraints: {},
    trackCapabilities: {
      exposureMode: ["continuous", "manual"],
      exposureTime: { min: 2.44140625, max: 1250, step: 2.44140625 },
      zoom: { min: 100, max: 400, step: 10 },
    },
    trackSettings: { exposureTime: 156.25, zoom: 100, exposureMode: "continuous" },
    photoCapabilities: null,
    photoSettings: null,
  };

  it("converts 100-microsecond exposure times into seconds before enabling stops", () => {
    const probe = mapCapabilities(windows);
    expect(probe.controls.shutter.deviceFactor).toBe(10_000);
    expect(probe.controls.shutter.range?.max).toBeCloseTo(0.125, 5);
    expect(shutterEnabled("1/60", probe.controls.shutter.range, true)).toBe(true);
    expect(shutterEnabled("1/4", probe.controls.shutter.range, true)).toBe(false);
    expect(probe.controls.shutter.reason).toContain("100-microsecond");

    const manual = trackConstraintsFor(
      { ...DEFAULT_SETTINGS, exposureMode: "manual", shutterId: "1/60" },
      probe,
      "photo",
    );
    expect(manual.find((entry) => entry.id === "exposureMode")?.constraint).toEqual({ exposureMode: "manual" });
    const exposure = manual.find((entry) => entry.id === "shutter")?.constraint.exposureTime;
    expect(exposure).toBeCloseTo(166.015625, 4);
  });
});
