"use client";

import type { AppSettings } from "@/lib/storage/settings";
import type { CapabilityMap, ExposureChoice, FlashChoice, FocusChoice, WhiteBalanceChoice } from "@/lib/camera/types";
import {
  evEnabled,
  evStops,
  formatEv,
  formatZoom,
  frameRateEnabled,
  guidelineShutter,
  ISO_STOPS,
  isoEnabled,
  resolutionEnabled,
  SHUTTER_STOPS,
  shutterEnabled,
  VIDEO_FRAME_RATES,
  VIDEO_RESOLUTIONS,
} from "@/lib/camera/stops";
import { isoWarning, shutterWarning } from "@/lib/camera/summary";
import { WB_PRESETS } from "@/lib/camera/wb";
import { CloseIcon, FocusIcon } from "./icons";
import { Dial, LevelBadge, RangeField, StopSlider, TechLabel } from "./controls";

const EXPOSURE_OPTIONS: { id: ExposureChoice; label: string }[] = [
  { id: "auto", label: "Program" },
  { id: "manual", label: "Manual" },
  { id: "shutter-priority", label: "Shutter" },
  { id: "iso-priority", label: "ISO" },
];

const FOCUS_OPTIONS: { id: FocusChoice; label: string }[] = [
  { id: "continuous", label: "AF" },
  { id: "single-shot", label: "AF-S" },
  { id: "manual", label: "MF" },
];

const FLASH_OPTIONS: { id: FlashChoice; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "auto", label: "Auto" },
  { id: "on", label: "On" },
  { id: "torch", label: "Torch" },
  { id: "red-eye", label: "Red-eye" },
];

function exposureEnabled(id: ExposureChoice, probe: CapabilityMap) {
  if (probe.controls.exposureMode.level === "unavailable") return false;
  if (id === "shutter-priority" || id === "iso-priority") return false;
  if (id === "manual") return probe.controls.exposureMode.values?.includes("manual") ?? false;
  return true;
}

function whiteEnabled(id: WhiteBalanceChoice, probe: CapabilityMap) {
  const control = probe.controls.whiteBalance;
  if (control.level === "unavailable") return false;
  if (control.level === "preview-only") return true;
  if (id === "auto") return true;
  if (!control.range) return false;
  if (id === "kelvin") return true;
  const kelvin = WB_PRESETS.find((preset) => preset.id === id)?.kelvin;
  return kelvin != null && kelvin >= control.range.min && kelvin <= control.range.max;
}

function ChipRow({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string; disabled?: boolean }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={option.disabled}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className={`min-h-9 rounded-full border px-3 font-mono text-xs disabled:text-paper/30 ${
            option.id === value ? "border-sage bg-paper text-ink" : "border-paper/15 text-paper"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ProPanel({
  settings,
  probe,
  errors,
  update,
  audio,
  confirmedFps,
  onClose,
}: {
  settings: AppSettings;
  probe: CapabilityMap | null;
  errors: Record<string, string>;
  update: (patch: Partial<AppSettings>) => void;
  audio: string;
  confirmedFps: number | null;
  onClose?: () => void;
}) {
  if (!probe) {
    return (
      <aside className="bg-panel p-4" data-testid="pro-panel">
        <TechLabel>Pro</TechLabel>
        <p className="mt-3 text-sm text-paper/60">Controls appear after the camera reports its capabilities.</p>
      </aside>
    );
  }

  const shutterOn = probe.controls.shutter.level !== "unavailable";
  const isoOn = probe.controls.iso.level !== "unavailable";
  const manual = settings.exposureMode === "manual";
  const evOn = probe.controls.ev.level === "supported" && !manual;
  const guide = guidelineShutter(settings.videoFps);
  const focusValues = probe.controls.focus.values ?? [];
  const afAvailable = focusValues.includes("continuous");
  const zoomRange = probe.controls.zoom.range;
  const zoomStops =
    zoomRange &&
    [zoomRange.min, zoomRange.min + (zoomRange.max - zoomRange.min) * 0.33, zoomRange.min + (zoomRange.max - zoomRange.min) * 0.66, zoomRange.max]
      .map((value) => Math.round(value / (zoomRange.step || 1)) * (zoomRange.step || 1))
      .filter((value, index, list) => list.indexOf(value) === index);

  return (
    <aside className="flex flex-col gap-6 bg-panel p-4" data-testid="pro-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <TechLabel>Pro</TechLabel>
          <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-paper/45 uppercase">Browser camera</p>
        </div>
        {onClose ? (
          <button type="button" aria-label="Close Pro" className="grid h-10 w-10 place-items-center rounded-full border border-paper/15" onClick={onClose}>
            <CloseIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <section className="rounded-xl border border-paper/10 bg-ink/40 p-3" data-testid="control-focus">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FocusIcon className="h-4 w-4 text-sage" />
            <TechLabel>Focus</TechLabel>
          </div>
          <LevelBadge level={probe.controls.focus.level} />
        </div>
        <ChipRow
          value={settings.focusMode}
          options={FOCUS_OPTIONS.map((option) => ({
            ...option,
            disabled: focusValues.length ? !focusValues.includes(option.id) : true,
          }))}
          onChange={(id) => update({ focusMode: id as FocusChoice })}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!afAvailable}
            className={`min-h-10 rounded-full px-4 font-mono text-[11px] tracking-widest uppercase disabled:opacity-35 ${
              settings.focusMode === "continuous" ? "bg-sage text-ink" : "border border-paper/15 text-paper"
            }`}
            onClick={() => update({ focusMode: "continuous" })}
          >
            Autofocus
          </button>
          <p className="self-center text-xs text-paper/50">Tap the preview to meter or refocus when the camera allows it.</p>
        </div>
        {settings.focusMode === "manual" && probe.controls.focus.range ? (
          <div className="mt-3">
            <RangeField
              label="Focus distance"
              min={probe.controls.focus.range.min}
              max={probe.controls.focus.range.max}
              step={probe.controls.focus.range.step ?? 0.01}
              value={settings.focusDistance}
              onChange={(focusDistance) => update({ focusDistance })}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-paper/55">{errors.focus ?? probe.controls.focus.reason}</p>
        )}
      </section>

      <Dial
        label="Exposure"
        testId="control-exposure"
        level={probe.controls.exposureMode.level}
        reason={probe.controls.exposureMode.reason}
        value={settings.exposureMode}
        options={EXPOSURE_OPTIONS.map((option) => ({
          ...option,
          disabled: !exposureEnabled(option.id, probe),
        }))}
        onChange={(id) => update({ exposureMode: id as ExposureChoice })}
      />

      {manual ? (
        <>
          <StopSlider
            label="Shutter"
            testId="control-shutter"
            level={probe.controls.shutter.level}
            reason={errors.shutter ?? probe.controls.shutter.reason}
            value={settings.shutterId}
            warning={shutterWarning(settings, probe, Boolean(errors.shutter))}
            options={[
              ...SHUTTER_STOPS.map((stop) => ({
                id: stop.id,
                label: stop.label,
                disabled: !shutterEnabled(stop.id, probe.controls.shutter.range, shutterOn),
              })),
              { id: "bulb", label: "Bulb", disabled: true },
            ]}
            onChange={(id) => update({ shutterId: id })}
          />
          <StopSlider
            label="ISO"
            testId="control-iso"
            level={probe.controls.iso.level}
            reason={errors.iso ?? probe.controls.iso.reason}
            value={settings.isoId}
            warning={isoWarning(settings, probe, Boolean(errors.iso))}
            options={[
              { id: "auto", label: "Auto", disabled: !isoEnabled("auto", probe.controls.iso.range, isoOn) },
              ...ISO_STOPS.map((iso) => ({
                id: String(iso),
                label: String(iso),
                disabled: !isoEnabled(String(iso), probe.controls.iso.range, isoOn),
              })),
            ]}
            onChange={(id) => update({ isoId: id })}
          />
        </>
      ) : (
        <section className="grid gap-2" data-testid="control-shutter">
          <div className="flex items-baseline justify-between">
            <TechLabel>Shutter / ISO</TechLabel>
            <LevelBadge level={probe.controls.shutter.level} />
          </div>
          <p className="text-sm text-paper/70">Program mode lets the camera choose shutter and ISO.</p>
          <p className="text-xs text-paper/45">{probe.controls.shutter.reason}</p>
          <div className="hidden" data-testid="control-iso" />
        </section>
      )}

      {!manual ? (
        <StopSlider
          label="EV"
          testId="control-ev"
          level={probe.controls.ev.level}
          reason={errors.ev ?? probe.controls.ev.reason}
          value={settings.ev.toFixed(1)}
          options={evStops().map((ev) => ({
            id: ev.toFixed(1),
            label: formatEv(ev),
            disabled: !evOn || !evEnabled(ev, probe.controls.ev.range, probe.controls.ev.level === "supported"),
          }))}
          onChange={(id) => update({ ev: Number(id) })}
        />
      ) : (
        <section data-testid="control-ev">
          <TechLabel>EV</TechLabel>
          <p className="mt-2 text-xs text-paper/55">Exposure compensation stays off in manual mode.</p>
        </section>
      )}

      <Dial
        label="White balance"
        testId="control-wb"
        level={probe.controls.whiteBalance.level}
        reason={errors.whiteBalance ?? probe.controls.whiteBalance.reason}
        value={settings.whiteBalance}
        options={WB_PRESETS.map((preset) => ({
          id: preset.id,
          label: preset.label,
          disabled: !whiteEnabled(preset.id, probe),
        }))}
        onChange={(id) => update({ whiteBalance: id as WhiteBalanceChoice })}
      />
      {(settings.whiteBalance === "kelvin" || probe.controls.whiteBalance.level === "preview-only") && probe.controls.whiteBalance.range ? (
        <RangeField
          label={probe.controls.whiteBalance.level === "preview-only" ? "Preview Kelvin" : "Kelvin"}
          min={probe.controls.whiteBalance.range.min}
          max={probe.controls.whiteBalance.range.max}
          step={probe.controls.whiteBalance.range.step ?? 100}
          value={settings.kelvin}
          suffix="K"
          onChange={(kelvin) => update({ kelvin: Math.round(kelvin), whiteBalance: "kelvin" })}
        />
      ) : null}
      <button
        type="button"
        disabled={!(probe.controls.whiteBalance.values ?? []).includes("manual")}
        aria-pressed={settings.wbLock}
        onClick={() => update({ wbLock: !settings.wbLock })}
        className={`min-h-10 self-start rounded-full border px-4 text-xs ${settings.wbLock ? "border-sage bg-paper text-ink" : "border-paper/15"}`}
      >
        {settings.wbLock ? "WB locked" : "Lock WB"}
      </button>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <TechLabel>Aperture</TechLabel>
          <LevelBadge level={probe.controls.aperture.level} />
        </div>
        {probe.controls.aperture.readOnlyValue != null ? (
          <p className="font-mono text-sm">f/{probe.controls.aperture.readOnlyValue}</p>
        ) : null}
        <p className="text-xs leading-relaxed text-paper/55">{probe.controls.aperture.reason}</p>
      </section>

      <section className="flex flex-col gap-3" data-testid="control-zoom">
        <div className="flex items-baseline justify-between">
          <TechLabel>Digital zoom</TechLabel>
          <LevelBadge level={probe.controls.zoom.level} />
        </div>
        {zoomRange && zoomStops ? (
          <>
            <ChipRow
              value={String(settings.zoom ?? zoomRange.min)}
              options={zoomStops.map((stop) => ({
                id: String(stop),
                label: formatZoom(stop, zoomRange),
              }))}
              onChange={(id) => update({ zoom: Number(id) })}
            />
            <RangeField
              label="Zoom"
              min={zoomRange.min}
              max={zoomRange.max}
              step={zoomRange.step ?? 0.1}
              value={settings.zoom ?? zoomRange.min}
              onChange={(zoom) => update({ zoom })}
              display={formatZoom(settings.zoom ?? zoomRange.min, zoomRange)}
            />
          </>
        ) : null}
        <p className="text-xs leading-relaxed text-paper/55">{errors.zoom ?? probe.controls.zoom.reason}</p>
      </section>

      <Dial
        label="Flash"
        testId="control-flash"
        level={probe.controls.flash.level}
        reason={probe.controls.flash.reason}
        value={settings.flash}
        options={FLASH_OPTIONS.map((option) => ({
          ...option,
          disabled: !(probe.controls.flash.values ?? []).includes(option.id),
        }))}
        onChange={(id) => update({ flash: id as FlashChoice })}
      />

      <section>
        <TechLabel>Metering</TechLabel>
        <p className="mt-2 text-xs leading-relaxed text-paper/55">{probe.controls.metering.reason}</p>
      </section>

      <section className="flex flex-col gap-3">
        <TechLabel>Video</TechLabel>
        <p className="text-xs leading-relaxed text-paper/55">
          Recording writes the graded viewfinder. Mic: {audio}. {confirmedFps ? `Confirmed ${confirmedFps} fps.` : "Frame rate appears after the camera accepts it."}
        </p>
        <ChipRow
          value={String(settings.videoFps)}
          options={VIDEO_FRAME_RATES.map((fps) => ({
            id: String(fps),
            label: `${fps}`,
            disabled: !frameRateEnabled(fps, probe.media.frameRate),
          }))}
          onChange={(id) => update({ videoFps: Number(id) as AppSettings["videoFps"] })}
        />
        <ChipRow
          value={`${settings.videoWidth}x${settings.videoHeight}`}
          options={VIDEO_RESOLUTIONS.map((item) => ({
            id: `${item.width}x${item.height}`,
            label: item.label,
            disabled: !resolutionEnabled(item.width, item.height, probe.media.width, probe.media.height),
          }))}
          onChange={(id) => {
            const [width, height] = id.split("x").map(Number);
            update({ videoWidth: width, videoHeight: height });
          }}
        />
        <p className="text-xs text-paper/55">{guide.note}</p>
        {shutterOn ? (
          <button type="button" className="min-h-10 self-start rounded-full border border-paper/15 px-4 text-xs" onClick={() => update({ exposureMode: "manual", shutterId: guide.id })}>
            Use {guide.label} for this frame rate
          </button>
        ) : null}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <TechLabel>RAW / HEIF</TechLabel>
          <LevelBadge level="unavailable" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-paper/55">{probe.controls.raw.reason}</p>
      </section>
    </aside>
  );
}
