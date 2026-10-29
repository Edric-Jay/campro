import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createPreset,
  deletePreset,
  duplicatePreset,
  exportConfig,
  importConfig,
  renamePreset,
  restoreDefaults,
  sanitizeSettings,
  DEFAULT_SETTINGS,
} from "./settings";
import { listPresets, loadSettings, savePreset, saveSettings } from "./db";

describe("settings", () => {
  it("starts from the natural look", () => {
    expect(restoreDefaults().lutId).toBe("natural");
    expect(restoreDefaults().lutIntensity).toBe(100);
  });

  it("clamps intensity and drops unknown choices", () => {
    const next = sanitizeSettings({ lutIntensity: 400, facingMode: "side", ev: 9, timerSeconds: 3 });
    expect(next.lutIntensity).toBe(100);
    expect(next.facingMode).toBe("environment");
    expect(next.ev).toBe(3);
    expect(next.timerSeconds).toBe(0);
  });

  it("creates, renames, duplicates, and deletes presets", () => {
    const preset = createPreset("Night", DEFAULT_SETTINGS);
    const renamed = renamePreset([preset], preset.id, "Night two");
    expect(renamed[0]?.name).toBe("Night two");
    const duplicated = duplicatePreset(renamed, preset.id);
    expect(duplicated).toHaveLength(2);
    expect(duplicated[1]?.name).toContain("copy");
    expect(deletePreset(duplicated, preset.id)).toHaveLength(1);
  });

  it("round-trips configuration JSON without captures", () => {
    const preset = createPreset("Day", { ...DEFAULT_SETTINGS, lutId: "cinema" });
    const json = exportConfig({ ...DEFAULT_SETTINGS, kelvin: 5000 }, [preset], []);
    const imported = importConfig(json);
    expect(imported.settings.kelvin).toBe(5000);
    expect(imported.presets[0]?.settings.lutId).toBe("cinema");
    expect(json).not.toContain("blob");
    expect(() => importConfig("{")).toThrow(/JSON/);
    expect(() => importConfig('{"version":2}')).toThrow(/version/);
  });
});

describe("settings storage", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("saves and loads settings and presets", async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, lutId: "cinema" });
    await savePreset(createPreset("Street", DEFAULT_SETTINGS));
    expect((await loadSettings()).lutId).toBe("cinema");
    expect(await listPresets()).toHaveLength(1);
  });
});
