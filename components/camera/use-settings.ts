"use client";

import { useCallback, useEffect, useState } from "react";
import { parseCube, cubeToLut, CubeParseError, MAX_CUBE_BYTES } from "@/lib/lut/cube";
import type { Lut3D } from "@/lib/lut/grade";
import {
  createPreset,
  deletePreset as dropPreset,
  duplicatePreset,
  exportConfig,
  importConfig,
  renamePreset,
  restoreDefaults,
  sanitizeSettings,
  touchRecent,
  type AppSettings,
  type Preset,
  type StoredLut,
} from "@/lib/storage/settings";
import {
  listLuts,
  listPresets,
  loadSettings,
  removeLut,
  removePreset,
  replacePresets,
  saveLut,
  savePreset,
  saveSettings,
} from "@/lib/storage/db";

function storedToLut(lut: StoredLut): Lut3D {
  return { id: lut.id, name: lut.name, size: lut.size, data: Float32Array.from(lut.data) };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(restoreDefaults());
  const [presets, setPresets] = useState<Preset[]>([]);
  const [customLuts, setCustomLuts] = useState<Lut3D[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSettings(), listPresets(), listLuts()])
      .then(([stored, storedPresets, storedLuts]) => {
        if (cancelled) return;
        setSettings(stored);
        setPresets(storedPresets);
        setCustomLuts(storedLuts.map(storedToLut));
      })
      .catch(() => {
        if (!cancelled) setNotice("Saved settings could not be read. This session starts from the defaults.");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings> | ((current: AppSettings) => AppSettings)) => {
    setSettings((current) => {
      const next = sanitizeSettings(typeof patch === "function" ? patch(current) : { ...current, ...patch });
      void saveSettings(next).catch(() => {
        setNotice("Settings could not be saved in this browser.");
      });
      return next;
    });
  }, []);

  const selectLut = useCallback((id: string) => {
    update((current) => touchRecent(current, id));
  }, [update]);

  const toggleFavorite = useCallback((id: string) => {
    update((current) => ({
      ...current,
      favorites: current.favorites.includes(id)
        ? current.favorites.filter((item) => item !== id)
        : [...current.favorites, id],
    }));
  }, [update]);

  const rememberLut = useCallback((lut: Lut3D) => {
    setCustomLuts((current) => [lut, ...current.filter((item) => item.id !== lut.id)]);
  }, []);

  const importCube = useCallback(async (file: File) => {
    try {
      if (file.size > MAX_CUBE_BYTES) throw new CubeParseError("LUT files must be 5 MB or smaller.");
      const parsed = parseCube(await file.text(), file.size);
      const id = `custom-${crypto.randomUUID()}`;
      const lut = cubeToLut(parsed, id);
      const stored: StoredLut = { id, name: lut.name, size: lut.size, data: Array.from(lut.data) };
      await saveLut(stored);
      rememberLut(lut);
      selectLut(id);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The LUT could not be imported.");
    }
  }, [rememberLut, selectLut]);

  const deleteCustomLut = useCallback(async (id: string) => {
    await removeLut(id);
    setCustomLuts((current) => current.filter((lut) => lut.id !== id));
    update((current) => ({
      ...current,
      lutId: current.lutId === id ? "natural" : current.lutId,
      favorites: current.favorites.filter((item) => item !== id),
    }));
  }, [update]);

  const saveCurrentPreset = useCallback(async (name: string) => {
    const created = createPreset(name, settings);
    await savePreset(created);
    setPresets((current) => [...current, created]);
  }, [settings]);

  const rename = useCallback(async (id: string, name: string) => {
    let next: Preset[] = [];
    setPresets((current) => {
      next = renamePreset(current, id, name);
      return next;
    });
    const preset = next.find((item) => item.id === id);
    if (preset) await savePreset(preset);
  }, []);

  const duplicate = useCallback(async (id: string) => {
    let next: Preset[] = [];
    setPresets((current) => {
      next = duplicatePreset(current, id);
      return next;
    });
    const created = next.find((item) => !presets.some((preset) => preset.id === item.id));
    if (created) await savePreset(created);
  }, [presets]);

  const removePresetById = useCallback(async (id: string) => {
    setPresets((current) => dropPreset(current, id));
    await removePreset(id);
  }, []);

  const applyPreset = useCallback((id: string) => {
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    update(preset.settings);
  }, [presets, update]);

  const restore = useCallback(async () => {
    const defaults = restoreDefaults();
    setSettings(defaults);
    await saveSettings(defaults);
  }, []);

  const exportFile = useCallback(() => {
    const luts: StoredLut[] = customLuts.map((lut) => ({
      id: lut.id,
      name: lut.name,
      size: lut.size,
      data: Array.from(lut.data),
    }));
    const blob = new Blob([exportConfig(settings, presets, luts)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "camlut-pro-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [customLuts, presets, settings]);

  const importFile = useCallback(async (file: File) => {
    try {
      const config = importConfig(await file.text());
      setSettings(config.settings);
      setPresets(config.presets);
      await saveSettings(config.settings);
      await replacePresets(config.presets);
      for (const lut of config.customLuts) {
        await saveLut(lut);
        rememberLut(storedToLut(lut));
      }
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The configuration could not be imported.");
    }
  }, [rememberLut]);

  return {
    ready,
    settings,
    presets,
    customLuts,
    notice,
    setNotice,
    update,
    selectLut,
    toggleFavorite,
    importCube,
    deleteCustomLut,
    saveCurrentPreset,
    rename,
    duplicate,
    removePresetById,
    applyPreset,
    restore,
    exportFile,
    importFile,
  };
}
