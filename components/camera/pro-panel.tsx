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
import { Dial, LevelBadge, RangeField, StopSlider, TechLabel } from "./controls";

const EXPOSURE_OPTIONS: { id: ExposureChoice; label: string }[] = [
  { id: "auto", label: "Program" },
  { id: "manual", label: "Manual" },
  { id: "shutter-priority", label: "Shutter" },
  { id: "iso-priority", label: "ISO" },
];

const FOCUS_OPTIONS: { id: FocusChoice; label: string }[] = [
  { id: "continuous", label: "Continuous" },
  { id: "single-shot", label: "Single" },
  { id: "manual", label: "Manual" },
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

  return (
    <aside
      className="flex flex-col gap-5 bg-panel p-4"
      data-testid="pro-panel"
    >
      <div className="flex items-baseline justify-between">
        <TechLabel>Pro</TechLabel>
        <div className="flex items-center gap-3">
          {onClose ? (
            <button type="button" className="font-mono text-[10px] tracking-[0.14em] uppercase" onClick={onClose}>
              Close
            </button>
          ) : null}
          <span className="font-mono text-[10px] tracking-[0.14em] text-paper/45 uppercase">Browser camera</span>
        </div>
      </div>

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
            disabled: !manual || !shutterEnabled(stop.id, probe.controls.shutter.range, shutterOn),
          })),
          { id: "bulb", label: "Bulb", disabled: true },
        ]}
        onChange={(id) => update({ shutterId: id })}
      />
      <p className="text-xs text-paper/45">Bulb is not available in the browser.</p>

      <StopSlider
        label="ISO"
        testId="control-iso"
        level={probe.controls.iso.level}
        reason={errors.iso ?? probe.controls.iso.reason}
        value={settings.isoId}
        warning={isoWarning(settings, probe, Boolean(errors.iso))}
        options={[
          { id: "auto", label: "Auto", disabled: !manual || !isoEnabled("auto", probe.controls.iso.range, isoOn) },
          ...ISO_STOPS.map((iso) => ({
            id: String(iso),
            label: String(iso),
            disabled: !manual || !isoEnabled(String(iso), probe.controls.iso.range, isoOn),
          })),
        ]}
        onChange={(id) => update({ isoId: id })}
      />
      {probe.controls.iso.range ? (
        <p className="text-xs text-paper/45">
          Reported range ISO {Math.round(probe.controls.iso.range.min)}–{Math.round(probe.controls.iso.range.max)}. Auto limits cannot be set from the browser.
        </p>
      ) : null}

      <StopSlider
        label="EV"
        testId="control-ev"
        level={manual ? "unavailable" : probe.controls.ev.level}
        reason={
          manual
            ? "Exposure compensation stays off in manual mode. It does not override shutter and ISO."
            : (errors.ev ?? probe.controls.ev.reason)
        }
        value={settings.ev.toFixed(1)}
        options={evStops().map((ev) => ({
          id: ev.toFixed(1),
          label: formatEv(ev),
          disabled: !evOn || !evEnabled(ev, probe.controls.ev.range, probe.controls.ev.level === "supported"),
        }))}
        onChange={(id) => update({ ev: Number(id) })}
      />

      <StopSlider
        label="Focus"
        testId="control-focus"
        level={probe.controls.focus.level}
        reason={errors.focus ?? probe.controls.focus.reason}
        value={settings.focusMode}
        options={FOCUS_OPTIONS.map((option) => ({
          ...option,
          disabled: !(probe.controls.focus.values ?? []).includes(option.id),
        }))}
        onChange={(id) => update({ focusMode: id as FocusChoice })}
      />
      {settings.focusMode === "manual" && probe.controls.focus.range ? (
        <RangeField
          label="Focus distance"
          min={probe.controls.focus.range.min}
          max={probe.controls.focus.range.max}
          step={probe.controls.focus.range.step ?? 0.01}
          value={settings.focusDistance}
          onChange={(focusDistance) => update({ focusDistance })}
        />
      ) : (
        <p className="text-xs text-paper/45">
          Distance units are whatever the camera reports. A sharpening effect is not manual focus.
        </p>
      )}

      <StopSlider
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
      {(settings.whiteBalance === "kelvin" || probe.controls.whiteBalance.level === "preview-only") &&
      probe.controls.whiteBalance.range ? (
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
        className="min-h-9 rounded-full border border-paper/15 px-3 text-xs"
      >
        {settings.wbLock ? "White balance held" : "Hold white balance"}
      </button>
      <p className="text-xs text-paper/45">Tint is not exposed by this browser.</p>

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

      <section className="flex flex-col gap-2" data-testid="control-zoom">
        <div className="flex items-baseline justify-between">
          <TechLabel>Digital zoom</TechLabel>
          <LevelBadge level={probe.controls.zoom.level} />
        </div>
        {probe.controls.zoom.range ? (
          <RangeField
            label="Zoom"
            min={probe.controls.zoom.range.min}
            max={probe.controls.zoom.range.max}
            step={probe.controls.zoom.range.step ?? 0.1}
            value={settings.zoom ?? probe.controls.zoom.range.min}
            onChange={(zoom) => update({ zoom })}
            display={formatZoom(settings.zoom ?? probe.controls.zoom.range.min, probe.controls.zoom.range)}
          />
        ) : null}
        <p className="text-xs leading-relaxed text-paper/55">
          {errors.zoom ?? probe.controls.zoom.reason} Named lenses such as 0.5× and 2× are not separate cameras in the browser.
          {probe.controls.zoom.range
            ? ` Reported range ${probe.controls.zoom.range.min}–${probe.controls.zoom.range.max}.`
            : ""}
          {probe.controls.zoom.range && probe.controls.zoom.range.min >= 50
            ? " A reported value of 100 is 1×, not 100×."
            : ""}
        </p>
        {probe.media.focalLength ? (
          <p className="font-mono text-xs text-paper/70">Focal length {probe.media.focalLength}mm</p>
        ) : null}
      </section>

      <StopSlider
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

      <section className="flex flex-col gap-2">
        <TechLabel>Video</TechLabel>
        <p className="text-xs leading-relaxed text-paper/55">
          Recording writes the graded viewfinder, re-encoded in the browser. It is not the camera’s original stream.
          Mic: {audio}. {confirmedFps ? `Confirmed ${confirmedFps} fps.` : "Frame rate is shown after the camera accepts it."}
        </p>
        <div className="flex flex-wrap gap-1">
          {VIDEO_FRAME_RATES.map((fps) => (
            <button
              key={fps}
              type="button"
              disabled={!frameRateEnabled(fps, probe.media.frameRate)}
              aria-pressed={settings.videoFps === fps}
              onClick={() => update({ videoFps: fps })}
              className="min-h-9 rounded-full border border-paper/15 px-3 font-mono text-xs disabled:text-paper/30"
            >
              {fps}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {VIDEO_RESOLUTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!resolutionEnabled(item.width, item.height, probe.media.width, probe.media.height)}
              aria-pressed={settings.videoWidth === item.width}
              onClick={() => update({ videoWidth: item.width, videoHeight: item.height })}
              className="min-h-9 rounded-full border border-paper/15 px-3 font-mono text-xs disabled:text-paper/30"
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-paper/55">{guide.note}</p>
        {shutterOn ? (
          <button type="button" className="min-h-9 rounded-full border border-paper/15 px-3 text-xs" onClick={() => update({ exposureMode: "manual", shutterId: guide.id })}>
            Use {guide.label} for this frame rate
          </button>
        ) : (
          <p className="text-xs text-paper/45">The shutter cannot be set here, so the 180° figure stays a recommendation.</p>
        )}
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
