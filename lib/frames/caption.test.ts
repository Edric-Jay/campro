import { describe, expect, it } from "vitest";
import { anchorStyle, captionBand, isCaptionFrame, normalizeCaption } from "./caption";
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

  it("maps anchors to corners and the center", () => {
    expect(anchorStyle("top-left")).toMatchObject({ left: "0%", top: "0%", textAlign: "left" });
    expect(anchorStyle("center")).toMatchObject({ left: "50%", top: "50%", textAlign: "center" });
    expect(anchorStyle("bottom-right")).toMatchObject({ left: "100%", top: "100%", textAlign: "right" });
  });

  it("fills missing caption fields for older saves", () => {
    expect(normalizeCaption({ text: "hi", fontId: "reenie" })).toEqual({
      text: "hi",
      fontId: "reenie",
      includeDate: false,
      placement: "anchor",
      anchor: "bottom-center",
      x: 0.5,
      y: 0.8,
      size: 1,
    });
  });

  it("clamps caption size", () => {
    expect(normalizeCaption({ size: 0.1 }).size).toBe(0.6);
    expect(normalizeCaption({ size: 9 }).size).toBe(1.8);
  });

  it("keeps freehand placement and clamps coordinates", () => {
    expect(normalizeCaption({ placement: "freehand", x: -1, y: 2 })).toMatchObject({
      placement: "freehand",
      x: 0,
      y: 1,
    });
  });
});
