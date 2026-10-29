"use client";

import { CONTROL_IDS } from "@/lib/camera/types";
import type { CapabilityMap } from "@/lib/camera/types";
import type { AppSettings, Preset } from "@/lib/storage/settings";
import { useState } from "react";
import { LevelBadge, TechLabel } from "./controls";

const PEAKING = ["#d6ff4a", "#9aa892", "#f3efe6", "#e23b2f"];

export function SettingsSheet({
  open,
  settings,
  presets,
  probe,
  battery,
  quota,
  onClose,
  update,
  onPreset,
  onSavePreset,
  onRename,
  onDuplicate,
  onDeletePreset,
  onRestore,
  onExport,
  onImport,
}: {
  open: boolean;
  settings: AppSettings;
  presets: Preset[];
  probe: CapabilityMap | null;
  battery: number | null;
  quota: string | null;
  onClose: () => void;
  update: (patch: Partial<AppSettings>) => void;
  onPreset: (id: string) => void;
  onSavePreset: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onRestore: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  const [name, setName] = useState("Custom");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/55 lg:items-center lg:justify-center">
      <div className="max-h-[88dvh] w-full overflow-y-auto bg-panel p-4 lg:max-w-xl lg:rounded-md lg:border lg:border-paper/15">
        <div className="mb-4 flex items-center justify-between">
          <TechLabel>Settings</TechLabel>
          <button type="button" className="min-h-9 px-3 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex flex-col gap-5 text-sm">
          <section className="flex flex-col gap-2">
            <TechLabel>Overlays</TechLabel>
            <div className="flex flex-wrap gap-2">
              <Toggle pressed={settings.grid === "thirds"} onClick={() => update({ grid: settings.grid === "thirds" ? "off" : "thirds" })}>
                Thirds
              </Toggle>
              <Toggle pressed={settings.grid === "golden"} onClick={() => update({ grid: settings.grid === "golden" ? "off" : "golden" })}>
                Golden
              </Toggle>
              <Toggle pressed={settings.crosshair} onClick={() => update({ crosshair: !settings.crosshair })}>
                Crosshair
              </Toggle>
              <Toggle pressed={settings.safeFrame} onClick={() => update({ safeFrame: !settings.safeFrame })}>
                Safe frame
              </Toggle>
              <Toggle pressed={settings.level} onClick={() => update({ level: !settings.level })}>
                Level
              </Toggle>
              <Toggle pressed={settings.histogram} onClick={() => update({ histogram: !settings.histogram })}>
                Histogram
              </Toggle>
              <Toggle pressed={settings.zebra} onClick={() => update({ zebra: !settings.zebra })}>
                Zebra
              </Toggle>
              <Toggle pressed={settings.peaking} onClick={() => update({ peaking: !settings.peaking })}>
                Peaking
              </Toggle>
              <Toggle pressed={settings.falseColor} onClick={() => update({ falseColor: !settings.falseColor })}>
                False color
              </Toggle>
              <Toggle pressed={settings.cleanViewfinder} onClick={() => update({ cleanViewfinder: !settings.cleanViewfinder })}>
                Clean
              </Toggle>
              <Toggle pressed={settings.previewMagnify} onClick={() => update({ previewMagnify: !settings.previewMagnify })}>
                Preview magnify
              </Toggle>
            </div>
            <p className="text-xs text-paper/50">Preview magnify is a digital crop of the viewfinder. It is not focus.</p>
            <label className="flex items-center gap-3 text-xs">
              Zebra highlight {settings.zebraHighlight}
              <input
                type="range"
                min={70}
                max={100}
                value={settings.zebraHighlight}
                onChange={(event) => update({ zebraHighlight: Number(event.target.value) })}
              />
            </label>
            <label className="flex items-center gap-3 text-xs">
              <input
                type="checkbox"
                checked={settings.zebraShadow != null}
                onChange={(event) => update({ zebraShadow: event.target.checked ? 5 : null })}
              />
              Shadow zebra
              {settings.zebraShadow != null ? (
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={settings.zebraShadow}
                  onChange={(event) => update({ zebraShadow: Number(event.target.value) })}
                />
              ) : null}
            </label>
            <label className="flex items-center gap-3 text-xs">
              Peaking {settings.peakingSensitivity}
              <input
                type="range"
                min={1}
                max={100}
                value={settings.peakingSensitivity}
                onChange={(event) => update({ peakingSensitivity: Number(event.target.value) })}
              />
            </label>
            <div className="flex gap-2">
              {PEAKING.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Peaking ${color}`}
                  aria-pressed={settings.peakingColor === color}
                  className="h-7 w-7 rounded-full border border-paper/30"
                  style={{ background: color }}
                  onClick={() => update({ peakingColor: color })}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <TechLabel>Timer and rapid stills</TechLabel>
            <div className="flex gap-2">
              {[0, 2, 5, 10].map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  aria-pressed={settings.timerSeconds === seconds}
                  className="min-h-9 rounded-full border border-paper/15 px-3 font-mono text-xs"
                  onClick={() => update({ timerSeconds: seconds as AppSettings["timerSeconds"] })}
                >
                  {seconds === 0 ? "Off" : `${seconds}s`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {[1, 3, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={settings.burstCount === count}
                  className="min-h-9 rounded-full border border-paper/15 px-3 font-mono text-xs"
                  onClick={() => update({ burstCount: count as AppSettings["burstCount"] })}
                >
                  {count === 1 ? "Single" : `${count} stills`}
                </button>
              ))}
            </div>
            <p className="text-xs text-paper/50">Rapid stills are sequential photos, not a hardware burst.</p>
          </section>

          <section className="flex flex-col gap-2">
            <TechLabel>Output</TechLabel>
            <p className="text-xs text-paper/55">JPEG is the graded still. HEIF and RAW are unavailable in this browser app.</p>
          </section>

          <section className="flex flex-col gap-2">
            <TechLabel>Presets</TechLabel>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-9 flex-1 border border-paper/15 bg-transparent px-3"
                aria-label="Preset name"
              />
              <button type="button" className="min-h-9 rounded-full border border-paper/15 px-3" onClick={() => onSavePreset(name)}>
                Save
              </button>
            </div>
            {presets.map((preset) => (
              <div key={preset.id} className="flex flex-wrap items-center gap-2">
                <button type="button" className="min-h-8 px-2 text-left" onClick={() => onPreset(preset.id)}>
                  {preset.name}
                </button>
                <button
                  type="button"
                  className="text-xs text-paper/55"
                  onClick={() => {
                    const next = window.prompt("Preset name", preset.name);
                    if (next && next.trim()) onRename(preset.id, next.trim());
                  }}
                >
                  Rename
                </button>
                <button type="button" className="text-xs text-paper/55" onClick={() => onDuplicate(preset.id)}>
                  Duplicate
                </button>
                <button type="button" className="text-xs text-paper/55" onClick={() => onDeletePreset(preset.id)}>
                  Delete
                </button>
              </div>
            ))}
          </section>

          <section className="flex flex-wrap gap-2">
            <button type="button" className="min-h-9 rounded-full border border-paper/15 px-3" onClick={onExport}>
              Export settings
            </button>
            <label className="min-h-9 cursor-pointer rounded-full border border-paper/15 px-3 leading-9">
              Import settings
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onImport(file);
                  event.target.value = "";
                }}
              />
            </label>
            <button type="button" className="min-h-9 rounded-full border border-paper/15 px-3" onClick={onRestore}>
              Restore defaults
            </button>
          </section>

          <section className="flex flex-col gap-2">
            <TechLabel>This camera</TechLabel>
            <p className="text-xs text-paper/55">
              {battery == null ? "Battery is not reported by this browser." : `Battery ${battery}%`}
              {quota ? ` · ${quota}` : ""}
            </p>
            <p className="text-xs text-paper/45">
              Volume-button, Bluetooth, and headphone shutters are not available to this web app.
            </p>
            {probe
              ? CONTROL_IDS.map((id) => (
                  <div key={id} className="border-t border-paper/10 pt-2">
                    <div className="flex justify-between gap-3">
                      <span className="font-mono text-[10px] tracking-widest uppercase">{id}</span>
                      <LevelBadge level={probe.controls[id].level} />
                    </div>
                    <p className="text-xs text-paper/55">{probe.controls[id].reason}</p>
                  </div>
                ))
              : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 text-xs ${pressed ? "border-sage text-sage" : "border-paper/15"}`}
    >
      {children}
    </button>
  );
}
