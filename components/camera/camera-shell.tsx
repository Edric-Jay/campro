"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { kelvinGains } from "@/lib/lut/color";
import { builtinLuts } from "@/lib/lut/builtin";
import { canvasToJpeg } from "@/lib/lut/renderer";
import { trackConstraintsFor } from "@/lib/camera/constraints";
import { viewPointToSensor } from "@/lib/camera/geometry";
import { buildStillOptions } from "@/lib/camera/still-options";
import { exposureSummary } from "@/lib/camera/summary";
import { shutterById } from "@/lib/camera/stops";
import { kelvinFor } from "@/lib/camera/wb";
import { readPlatformStatus } from "@/lib/camera/browser-backend";
import type { AppSettings } from "@/lib/storage/settings";
import type { CaptureRecord } from "@/lib/storage/records";
import { listCaptures, saveCapture } from "@/lib/storage/db";
import { LutCarousel } from "./lut-carousel";
import { OverlayLayer, type FocusMark } from "./overlay";
import { ProPanel } from "./pro-panel";
import { SettingsSheet } from "./settings-sheet";
import { useCamera } from "./use-camera";
import { useSettings } from "./use-settings";
import { useViewfinder } from "./use-viewfinder";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function previewGains(settings: AppSettings, level: string | undefined) {
  if (level !== "preview-only" || settings.whiteBalance === "auto") return [1, 1, 1] as [number, number, number];
  return kelvinGains(kelvinFor(settings));
}

function wbLabel(settings: AppSettings, level: string | undefined) {
  if (level === "preview-only" && settings.whiteBalance !== "auto") return `Preview ${Math.round(kelvinFor(settings))}K`;
  if (settings.whiteBalance === "kelvin") return `${Math.round(settings.kelvin)}K`;
  return settings.whiteBalance;
}

async function ensureJpeg(blob: Blob) {
  if (blob.type === "image/jpeg") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not encode JPEG.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToJpeg(canvas, 0.92);
}

export function CameraShell() {
  const store = useSettings();
  const { settings, ready } = store;
  const camera = useCamera(settings.facingMode, ready);
  const luts = useMemo(() => [...builtinLuts(), ...store.customLuts], [store.customLuts]);
  const lut = luts.find((item) => item.id === settings.lutId) ?? luts[0];
  const view = useViewfinder(camera.videoRef, lut ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audio, setAudio] = useState("off");
  const [notice, setNotice] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusMark | null>(null);
  const [thumb, setThumb] = useState<{ id: string; url: string } | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [quota, setQuota] = useState<string | null>(null);
  const [tilt, setTilt] = useState<number | null>(null);
  const [levelPermission, setLevelPermission] = useState<"unknown" | "needed" | "granted" | "denied">("unknown");
  const cancelTimer = useRef(false);
  const shooting = useRef(false);
  const keyActions = useRef({
    shutter: () => {},
    grid: () => {},
    clean: () => {},
    flip: () => {},
    lut: (_direction: 1 | -1) => {},
  });

  const gains = previewGains(settings, camera.probe?.controls.whiteBalance.level);
  view.drawRef.current = {
    intensity: view.kind === "none" ? 0 : settings.lutIntensity / 100,
    mirror: settings.facingMode === "user",
    magnify: settings.previewMagnify,
    wbGains: gains,
    analyze: true,
    analysis: {
      highlight: settings.zebraHighlight,
      shadow: settings.zebraShadow,
      peakingSensitivity: settings.peakingSensitivity,
    },
  };

  useEffect(() => {
    if (camera.phase !== "live" || !camera.probe) return;
    void camera.apply(trackConstraintsFor(settings, camera.probe, settings.captureMode));
    // The probe object is read from this render. Reapplying after apply() must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    camera.phase,
    camera.generation,
    settings.zoom,
    settings.ev,
    settings.focusMode,
    settings.focusDistance,
    settings.whiteBalance,
    settings.kelvin,
    settings.wbLock,
    settings.flash,
    settings.exposureMode,
    settings.shutterId,
    settings.isoId,
    settings.videoFps,
    settings.videoWidth,
    settings.videoHeight,
    settings.captureMode,
  ]);

  useEffect(() => {
    let cancelled = false;
    listCaptures()
      .then((captures) => {
        const latest = captures[0];
        if (!cancelled && latest) setThumb({ id: latest.id, url: URL.createObjectURL(latest.thumbnail) });
      })
      .catch(() => undefined);
    readPlatformStatus().then((status) => {
      if (cancelled) return;
      setBattery(status.battery);
      setQuota(status.quota);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings.level) return;
    const orientation = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof orientation.requestPermission === "function") setLevelPermission("needed");
    const onTilt = (event: DeviceOrientationEvent) => {
      if (typeof event.gamma === "number") setTilt(event.gamma);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [settings.level]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === " ") {
        event.preventDefault();
        keyActions.current.shutter();
      } else if (event.key.toLowerCase() === "g") {
        keyActions.current.grid();
      } else if (event.key.toLowerCase() === "h") {
        keyActions.current.clean();
      } else if (event.key.toLowerCase() === "f") {
        keyActions.current.flip();
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        keyActions.current.lut(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function remember(record: CaptureRecord) {
    setThumb((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { id: record.id, url: URL.createObjectURL(record.thumbnail) };
    });
  }

  async function takeOne(index: number) {
    if (!camera.probe || !lut) throw new Error("The camera is not ready.");
    const stillOptions = buildStillOptions(settings, camera.probe);
    const original = await camera.captureOriginal(stillOptions);
    let graded: Blob;
    let gradedNote: string;
    if (view.kind === "none" || !view.rendererRef.current) {
      graded = await ensureJpeg(original.blob);
      gradedNote = "Look was not applied because WebGL is unavailable. The saved JPEG is ungraded.";
    } else {
      const bitmap = await createImageBitmap(original.blob);
      try {
        graded = await view.rendererRef.current.gradeSource(bitmap, bitmap.width, bitmap.height, {
          intensity: settings.lutIntensity / 100,
          mirror: false,
          wbGains: gains,
          crop: { u0: 0, v0: 0, u1: 1, v1: 1 },
        });
      } finally {
        bitmap.close();
      }
      gradedNote =
        "Graded JPEG from the captured frame. This is not a RAW file. The viewfinder crop is not baked into the file.";
    }
    let thumbnail = graded;
    try {
      if (view.rendererRef.current) thumbnail = await view.rendererRef.current.snapshot();
    } catch {
      thumbnail = graded;
    }
    const record: CaptureRecord = {
      id: crypto.randomUUID(),
      kind: "photo",
      createdAt: Date.now(),
      lutId: lut.id,
      lutName: lut.name,
      intensity: settings.lutIntensity,
      favorite: false,
      graded,
      original: original.blob,
      thumbnail,
      originalSource: original.source,
      metadata: {
        width: original.width,
        height: original.height,
        facingMode: settings.facingMode,
        trackSettings: original.trackSettings,
        stillOptions: original.stillOptions,
        exposureSummary: exposureSummary(settings, camera.probe, camera.confirmed),
        whiteBalanceLabel: wbLabel(settings, camera.probe.controls.whiteBalance.level),
        gradedNote,
        timerSeconds: settings.timerSeconds,
        burstIndex: settings.burstCount > 1 ? index + 1 : null,
        videoFps: null,
        audio: null,
        webgl: view.kind,
      },
    };
    await saveCapture(record);
    remember(record);
  }

  async function shutter() {
    if (camera.phase !== "live" || shooting.current) return;
    if (countdown !== null) {
      cancelTimer.current = true;
      setCountdown(null);
      return;
    }
    if (settings.captureMode === "video") {
      if (recording) await finishVideo();
      else await beginVideo();
      return;
    }
    shooting.current = true;
    setBusy(true);
    try {
      if (settings.timerSeconds > 0) {
        cancelTimer.current = false;
        for (let second = settings.timerSeconds; second > 0; second -= 1) {
          setCountdown(second);
          await wait(1000);
          if (cancelTimer.current) return;
        }
        setCountdown(null);
      }
      for (let index = 0; index < settings.burstCount; index += 1) {
        await takeOne(index);
        if (index < settings.burstCount - 1) await wait(160);
      }
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The photo was not saved.");
    } finally {
      shooting.current = false;
      setBusy(false);
      setCountdown(null);
    }
  }

  async function beginVideo() {
    const canvas = view.canvasRef.current;
    if (!canvas || view.kind === "none") {
      setNotice("Recording needs the graded viewfinder. WebGL is unavailable, so video stays off.");
      return;
    }
    try {
      const status = await camera.startRecording(canvas, settings.videoFps);
      setAudio(status.audio);
      setElapsed(0);
      setRecording(true);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Recording could not start.");
    }
  }

  async function finishVideo() {
    if (!lut) return;
    setBusy(true);
    try {
      const blob = await camera.stopRecording();
      const thumbnail = view.rendererRef.current ? await view.rendererRef.current.snapshot() : blob;
      const record: CaptureRecord = {
        id: crypto.randomUUID(),
        kind: "video",
        createdAt: Date.now(),
        lutId: lut.id,
        lutName: lut.name,
        intensity: settings.lutIntensity,
        favorite: false,
        graded: blob,
        original: null,
        thumbnail: thumbnail instanceof Blob && thumbnail.type.startsWith("image/") ? thumbnail : blob,
        originalSource: "none",
        metadata: {
          width: settings.videoWidth,
          height: settings.videoHeight,
          facingMode: settings.facingMode,
          trackSettings: camera.confirmed,
          stillOptions: {},
          exposureSummary: exposureSummary(settings, camera.probe, camera.confirmed),
          whiteBalanceLabel: wbLabel(settings, camera.probe?.controls.whiteBalance.level),
          gradedNote: "Graded viewfinder recording. This is not the camera’s original stream.",
          timerSeconds: 0,
          burstIndex: null,
          videoFps: typeof camera.confirmed.frameRate === "number" ? camera.confirmed.frameRate : null,
          audio,
          webgl: view.kind,
        },
      };
      if (!record.thumbnail.type.startsWith("image/")) {
        throw new Error("The recording poster was not created, so nothing was saved.");
      }
      await saveCapture(record);
      remember(record);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The recording was not saved.");
    } finally {
      setRecording(false);
      setBusy(false);
    }
  }

  function onViewTap(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, label")) return;
    const video = camera.videoRef.current;
    const probe = camera.probe;
    if (!video || !probe) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const mark = { x: localX / rect.width, y: localY / rect.height };
    const sensor = viewPointToSensor(
      localX,
      localY,
      rect.width,
      rect.height,
      video.videoWidth,
      video.videoHeight,
      settings.facingMode === "user",
    );
    const canFocus = probe.controls.focus.level !== "unavailable";
    const canPoint = probe.controls.metering.level === "partial" || canFocus;
    if (!sensor || !canPoint) {
      setFocus({ ...mark, color: "amber", label: "Focus unavailable" });
      return;
    }
    setFocus({ ...mark, color: "white", label: "Focusing" });
    const mode = (probe.controls.focus.values ?? []).includes("single-shot") ? "single-shot" : null;
    void camera
      .setPoint(sensor.x, sensor.y, mode)
      .then(() => setFocus({ ...mark, color: "green", label: mode ? "Focus sent" : "Point sent" }))
      .catch(() => setFocus({ ...mark, color: "amber", label: "Focus rejected" }));
  }

  async function askLevel() {
    const orientation = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (!orientation.requestPermission) return;
    const result = await orientation.requestPermission();
    setLevelPermission(result === "granted" ? "granted" : "denied");
  }

  keyActions.current = {
    shutter: () => void shutter(),
    grid: () =>
      store.update({
        grid: settings.grid === "thirds" ? "golden" : settings.grid === "golden" ? "off" : "thirds",
      }),
    clean: () => store.update({ cleanViewfinder: !settings.cleanViewfinder }),
    flip: () => store.update({ facingMode: settings.facingMode === "user" ? "environment" : "user" }),
    lut: (direction) => {
      const index = luts.findIndex((item) => item.id === lut?.id);
      const chosen = luts[(index + direction + luts.length) % luts.length];
      if (chosen) store.selectLut(chosen.id);
    },
  };

  const summary = exposureSummary(settings, camera.probe, camera.confirmed);
  const confirmedFps = typeof camera.confirmed.frameRate === "number" ? camera.confirmed.frameRate : null;
  const longExposure =
    busy &&
    settings.captureMode === "photo" &&
    settings.exposureMode === "manual" &&
    camera.probe?.controls.shutter.level !== "unavailable" &&
    settings.shutterId !== "auto" &&
    shutterById(settings.shutterId).seconds !== "auto" &&
    (shutterById(settings.shutterId).seconds as number) >= 1;

  const dock = (labelled: boolean) => (
    <div className="flex items-end justify-between gap-3 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <Link href="/gallery" data-testid={labelled ? "last-capture" : undefined} className="pointer-events-auto h-12 w-12 overflow-hidden border border-paper/20 bg-ink">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.url} alt="Latest capture" className="h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full" />
        )}
      </Link>
      <button
        type="button"
        data-testid={labelled ? "shutter" : undefined}
        aria-label={settings.captureMode === "video" ? "Record" : "Shutter"}
        disabled={camera.phase !== "live" || (busy && !recording)}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          void shutter();
        }}
        className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border-2 border-paper/80 disabled:opacity-40"
      >
        <span className={`block h-12 w-12 rounded-full ${recording ? "h-5 w-5 bg-danger" : settings.captureMode === "video" ? "bg-danger" : "bg-paper"}`} />
      </button>
      <div className="pointer-events-auto flex w-24 flex-col items-end gap-1">
        <button
          type="button"
          className="font-mono text-[10px] tracking-widest uppercase"
          onClick={() => store.update({ captureMode: settings.captureMode === "photo" ? "video" : "photo" })}
        >
          {settings.captureMode}
        </button>
        <button type="button" data-testid="pro-toggle" className="font-mono text-[10px] tracking-widest uppercase lg:hidden" onClick={() => setProOpen((open) => !open)}>
          Pro
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-dvh overflow-hidden bg-ink text-paper">
      <div className="grid h-full lg:grid-cols-[200px_minmax(0,1fr)_320px]">
        <aside className="hidden flex-col gap-3 border-r border-paper/15 p-4 lg:flex">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase">camLUT Pro</p>
          <button type="button" className="min-h-9 rounded-full border border-paper/15" onClick={() => store.update({ facingMode: settings.facingMode === "user" ? "environment" : "user" })}>
            {settings.facingMode === "user" ? "Front" : "Rear"}
          </button>
          <button type="button" className="min-h-9 rounded-full border border-paper/15" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <p className="text-xs leading-relaxed text-paper/45">Space shutter. G grid. H clean. F flip. Arrows change the look.</p>
        </aside>

        <section className="relative flex min-h-0 flex-col">
          <div className="relative min-h-0 flex-1 bg-black" onPointerDown={onViewTap}>
            <video
              ref={camera.videoRef}
              playsInline
              muted
              autoPlay
              data-testid="camera-video"
              className={view.kind === "none" ? "absolute inset-0 h-full w-full object-cover" : "pointer-events-none absolute inset-0 h-full w-full opacity-0"}
            />
            <canvas ref={view.canvasRef} data-testid="viewfinder" className={view.kind === "none" ? "hidden" : "absolute inset-0 h-full w-full"} />
            <OverlayLayer
              settings={settings}
              analysis={view.analysis}
              focus={focus}
              tilt={tilt}
              levelPermission={levelPermission}
              onAskLevel={() => void askLevel()}
            />
            <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-3 pt-[max(12px,env(safe-area-inset-top))]">
              <div>
                <p className="font-mono text-[11px] tracking-[0.22em] uppercase">camLUT Pro</p>
                <p data-testid="status" className="font-mono text-[10px] tracking-widest text-sage uppercase">
                  {camera.phase === "live" ? "Live" : camera.message}
                </p>
              </div>
              <div className="pointer-events-auto flex items-center gap-2">
                {battery != null ? <span className="font-mono text-[10px]">{battery}%</span> : null}
                {quota ? <span className="hidden font-mono text-[10px] text-paper/50 sm:inline">{quota}</span> : null}
                {camera.probe?.controls.torch.level === "supported" ? (
                  <button type="button" className="min-h-8 rounded-full border border-paper/20 px-2 text-[10px] tracking-widest uppercase" onClick={() => store.update({ flash: settings.flash === "torch" ? "off" : "torch" })}>
                    {settings.flash === "torch" ? "Torch on" : "Torch"}
                  </button>
                ) : null}
                <button type="button" className="min-h-8 rounded-full border border-paper/20 px-2 text-[10px] tracking-widest uppercase lg:hidden" onClick={() => store.update({ facingMode: settings.facingMode === "user" ? "environment" : "user" })}>
                  Flip
                </button>
                <button type="button" className="min-h-8 rounded-full border border-paper/20 px-2 text-[10px] tracking-widest uppercase lg:hidden" onClick={() => setSettingsOpen(true)}>
                  Set
                </button>
              </div>
            </header>
            {camera.phase !== "live" && camera.phase !== "idle" && camera.phase !== "requesting" ? (
              <div className="absolute inset-0 z-20 grid content-center justify-items-center gap-3 bg-ink/80 px-6 text-center">
                <p className="max-w-xs text-sm">{camera.message}</p>
                <button type="button" className="min-h-10 rounded-full border border-paper/30 px-4" onClick={() => void camera.retry()}>
                  Try again
                </button>
              </div>
            ) : null}
            {countdown !== null ? <p className="absolute inset-0 grid place-items-center font-mono text-6xl">{countdown}</p> : null}
            {longExposure ? <p className="absolute bottom-28 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest uppercase">Exposing {shutterById(settings.shutterId).label}</p> : null}
            {recording ? <p className="absolute top-16 left-3 font-mono text-xs text-danger">Rec {Math.floor(elapsed / 1000).toString().padStart(2, "0")}s</p> : null}
            {view.slow ? <p className="absolute bottom-28 left-3 text-[10px] tracking-widest text-amber uppercase">Preview running slow</p> : null}
            {(notice || store.notice) && !settings.cleanViewfinder ? (
              <p className="absolute top-16 left-3 right-16 text-xs text-paper/80">{notice || store.notice}</p>
            ) : null}
            {!settings.cleanViewfinder ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-ink/80 to-transparent pt-10 lg:hidden">
                <p className="pointer-events-none px-3 font-mono text-[10px] tracking-widest text-paper/70 uppercase">{summary}</p>
                <div className="pointer-events-auto">
                  <LutCarousel
                    luts={luts}
                    settings={settings}
                    disabled={view.kind === "none"}
                    onSelect={store.selectLut}
                    onIntensity={(lutIntensity) => store.update({ lutIntensity })}
                    onFavorite={store.toggleFavorite}
                    onImport={(file) => void store.importCube(file)}
                    onDelete={(id) => void store.deleteCustomLut(id)}
                  />
                </div>
                {dock(false)}
              </div>
            ) : (
              <div className="absolute inset-x-0 bottom-0 lg:hidden">{dock(false)}</div>
            )}
            {settings.cleanViewfinder ? (
              <button type="button" className="absolute right-3 bottom-24 min-h-8 rounded-full border border-paper/20 px-3 text-[10px] tracking-widest uppercase" onClick={() => store.update({ cleanViewfinder: false })}>
                Show controls
              </button>
            ) : null}
            {settings.facingMode === "user" ? (
              <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[9px] tracking-widest text-paper/40 uppercase">Front preview is mirrored. Saved photos are not.</p>
            ) : null}
          </div>
          <div className={`hidden border-t border-paper/15 bg-ink lg:block ${settings.cleanViewfinder ? "lg:hidden" : ""}`}>
            <div className="py-2">
              <LutCarousel
                luts={luts}
                settings={settings}
                disabled={view.kind === "none"}
                onSelect={store.selectLut}
                onIntensity={(lutIntensity) => store.update({ lutIntensity })}
                onFavorite={store.toggleFavorite}
                onImport={(file) => void store.importCube(file)}
                onDelete={(id) => void store.deleteCustomLut(id)}
              />
            </div>
            <p className="px-3 pb-1 font-mono text-[10px] tracking-widest text-paper/60 uppercase">{summary}</p>
            {dock(true)}
          </div>
        </section>

        <div className={`${proOpen ? "fixed inset-x-0 bottom-0 z-30" : "max-lg:hidden"} lg:static lg:z-auto lg:block`}>
          <ProPanel
            settings={settings}
            probe={camera.probe}
            errors={camera.errors}
            update={store.update}
            audio={audio}
            confirmedFps={confirmedFps}
            onClose={() => setProOpen(false)}
          />
        </div>
      </div>
      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        presets={store.presets}
        probe={camera.probe}
        battery={battery}
        quota={quota}
        onClose={() => setSettingsOpen(false)}
        update={store.update}
        onPreset={store.applyPreset}
        onSavePreset={(name) => void store.saveCurrentPreset(name)}
        onRename={(id, name) => void store.rename(id, name)}
        onDuplicate={(id) => void store.duplicate(id)}
        onDeletePreset={(id) => void store.removePresetById(id)}
        onRestore={() => void store.restore()}
        onExport={store.exportFile}
        onImport={(file) => void store.importFile(file)}
      />
    </div>
  );
}
