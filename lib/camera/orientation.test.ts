import { describe, expect, it } from "vitest";
import { quarterTurnsToMatch } from "./orientation";

describe("still orientation", () => {
  it("leaves matching aspects alone", () => {
    expect(quarterTurnsToMatch(1920, 1080, "landscape", 90)).toBe(0);
    expect(quarterTurnsToMatch(1080, 1920, "portrait", 0)).toBe(0);
  });

  it("rotates portrait sensor stills for landscape holds", () => {
    expect(quarterTurnsToMatch(1080, 1920, "landscape", 90)).toBe(1);
    expect(quarterTurnsToMatch(1080, 1920, "landscape", 270)).toBe(3);
  });

  it("rotates landscape sensor stills for portrait holds", () => {
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 0)).toBe(1);
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 90)).toBe(3);
    expect(quarterTurnsToMatch(1920, 1080, "portrait", 270)).toBe(1);
  });
});
