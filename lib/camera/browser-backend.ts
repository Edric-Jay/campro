import { mapCapabilities, withRejection } from "./probe";
import type { ConstraintEntry } from "./constraints";
import type { CapabilityMap, ControlId, FacingMode, ProbeSources } from "./types";

export type CameraPhase = "idle" | "requesting" | "live" | "denied" | "missing" | "busy" | "error";

export interface OriginalStill {
  blob: Blob;
  width: number;
  height: number;
  source: "image-capture" | "video-frame";
  stillOptions: Record<string, unknown>;
  trackSettings: Record<string, unknown>;
}

interface ImageCaptureLike {
  takePhoto: (settings?: Record<string, unknown>) => Promise<Blob>;
  getPhotoCapabilities: () => Promise<Record<string, unknown>>;
  getPhotoSettings: () => Promise<Record<string, unknown>>;
}

type ApplyResult = {
  probe: CapabilityMap;
  trackSettings: Record<string, unknown>;
  errors: Record<string, string>;
};

function imageCaptureFor(track: MediaStreamTrack) {
  const ctor = (globalThis as unknown as {
    ImageCapture?: new (track: MediaStreamTrack) => ImageCaptureLike;
  }).ImageCapture;
  if (!ctor) return null;
  try {
    return new ctor(track);
  } catch {
    return null;
  }
}

async function probeTrack(track: MediaStreamTrack, capture: ImageCaptureLike | null): Promise<CapabilityMap> {
  const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {};
  const capabilities = track.getCapabilities?.() ?? {};
  const settings = track.getSettings?.() ?? {};
  let photoCapabilities: Record<string, unknown> | null = null;
  let photoSettings: Record<string, unknown> | null = null;
  if (capture) {
    try {
      photoCapabilities = await capture.getPhotoCapabilities();
      photoSettings = await capture.getPhotoSettings();
    } catch {
      photoCapabilities = null;
      photoSettings = null;
    }
  }
  const sources: ProbeSources = {
    supportedConstraints: supported as unknown as Record<string, boolean>,
    trackCapabilities: capabilities as unknown as Record<string, unknown>,
    trackSettings: settings as unknown as Record<string, unknown>,
    photoCapabilities,
    photoSettings,
  };
  return mapCapabilities(sources);
}

export function cameraError(error: unknown): { phase: CameraPhase; message: string } {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      phase: "denied",
      message: "Camera access was blocked. Allow it for this site, then try again.",
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { phase: "missing", message: "No matching camera was found on this device." };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return { phase: "busy", message: "The camera is unavailable. It may be in use by another app." };
  }
  return { phase: "error", message: "The camera could not be opened." };
}

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export class BrowserCameraBackend {
  private stream: MediaStream | null = null;
  private capture: ImageCaptureLike | null = null;
  private generation = 0;
  private probeResult: CapabilityMap | null = null;
  private facing: FacingMode = "environment";
  private recorder: MediaRecorder | null = null;
  private recordChunks: Blob[] = [];
  private recordMime = "video/webm";
  private audioStream: MediaStream | null = null;
  private canvasStream: MediaStream | null = null;

  getStream() {
    return this.stream;
  }

  getFacing() {
    return this.facing;
  }

  getProbe() {
    return this.probeResult;
  }

  async start(facing: FacingMode) {
    const generation = ++this.generation;
    this.stopTracks();
    this.facing = facing;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "OverconstrainedError" && name !== "NotFoundError") throw error;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
    }
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("The camera did not provide a video track.");
    this.capture = imageCaptureFor(track);
    this.probeResult = await probeTrack(track, this.capture);
    if (generation !== this.generation) {
      this.stopTracks();
      return null;
    }
    return this.probeResult;
  }

  stop() {
    this.generation += 1;
    this.stopRecordingTracks();
    this.stopTracks();
  }

  private stopTracks() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.capture = null;
    this.probeResult = null;
  }

  private videoTrack() {
    return this.stream?.getVideoTracks()[0] ?? null;
  }

  async applyEntries(entries: ConstraintEntry[]): Promise<ApplyResult> {
    const track = this.videoTrack();
    if (!track || !this.probeResult) throw new Error("The camera is not live.");
    let probe = this.probeResult;
    const errors: Record<string, string> = {};
    for (const entry of entries) {
      try {
        await track.applyConstraints(entry.constraint as MediaTrackConstraints);
      } catch (error) {
        const detail = error instanceof DOMException ? error.message : "The camera rejected this setting.";
        errors[entry.id] = detail;
        if (entry.id !== "frameRate" && entry.id !== "resolution") {
          probe = withRejection(probe, entry.id as ControlId, `The camera rejected this setting. ${detail}`);
        }
      }
    }
    this.probeResult = probe;
    const trackSettings = (track.getSettings?.() ?? {}) as unknown as Record<string, unknown>;
    probe = { ...probe, trackSettings };
    this.probeResult = probe;
    return { probe, trackSettings, errors };
  }

  async setPoint(x: number, y: number, focusMode: string | null) {
    const track = this.videoTrack();
    if (!track) throw new Error("The camera is not live.");
    const constraint: Record<string, unknown> = { pointsOfInterest: [{ x, y }] };
    if (focusMode) constraint.focusMode = focusMode;
    await track.applyConstraints(constraint as MediaTrackConstraints);
    return (track.getSettings?.() ?? {}) as unknown as Record<string, unknown>;
  }

  async captureOriginal(video: HTMLVideoElement, stillOptions: Record<string, unknown>): Promise<OriginalStill> {
    const track = this.videoTrack();
    const trackSettings = (track?.getSettings?.() ?? {}) as unknown as Record<string, unknown>;
    if (this.capture) {
      try {
        const blob = await this.capture.takePhoto(stillOptions);
        if (blob.size > 0) {
          const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
          const size = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          return { blob, ...size, source: "image-capture", stillOptions, trackSettings };
        }
      } catch {
        // Fall through to a viewfinder frame. The metadata records that source.
      }
    }
    const frame = await videoFrameJpeg(video);
    return { ...frame, source: "video-frame", stillOptions, trackSettings };
  }

  async startRecording(canvas: HTMLCanvasElement, fps: number) {
    if (typeof MediaRecorder === "undefined" || !canvas.captureStream) {
      throw new Error("This browser cannot record the viewfinder.");
    }
    this.stopRecordingTracks();
    this.canvasStream = canvas.captureStream(fps);
    let audio: "live" | "denied" | "unavailable" = "unavailable";
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audio = "live";
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      audio = name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable";
    }
    const tracks = [
      ...this.canvasStream.getVideoTracks(),
      ...(this.audioStream?.getAudioTracks() ?? []),
    ];
    const stream = new MediaStream(tracks);
    const mime = pickRecorderMime();
    this.recordMime = mime || "video/webm";
    this.recordChunks = [];
    this.recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.recordChunks.push(event.data);
    };
    this.recorder.start(250);
    return { audio, mime: this.recorder.mimeType || this.recordMime };
  }

  stopRecording() {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error("Nothing is recording."));
    return new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(this.recordChunks, { type: recorder.mimeType || this.recordMime });
        this.recordChunks = [];
        this.recorder = null;
        this.stopRecordingTracks();
        if (blob.size === 0) reject(new Error("The recording was empty and was not saved."));
        else resolve(blob);
      };
      recorder.onerror = () => {
        this.stopRecordingTracks();
        reject(new Error("Recording failed."));
      };
      if (recorder.state === "inactive") {
        reject(new Error("Recording failed."));
        return;
      }
      recorder.stop();
    });
  }

  private stopRecordingTracks() {
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.canvasStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = null;
    this.canvasStream = null;
  }
}

export async function videoFrameJpeg(video: HTMLVideoElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 2 || height < 2) throw new Error("The camera frame is not ready.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read the camera frame.");
  context.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (!blob) throw new Error("Could not encode the camera frame.");
  return { blob, width, height };
}

export async function readPlatformStatus() {
  let battery: number | null = null;
  const getter = (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery;
  if (getter) {
    try {
      const status = await getter.call(navigator);
      battery = Math.round(status.level * 100);
    } catch {
      battery = null;
    }
  }
  let quota: string | null = null;
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota && typeof estimate.usage === "number") {
      const percent = Math.round((estimate.usage / estimate.quota) * 100);
      quota = `Browser storage ${percent}% used`;
    }
  } catch {
    quota = null;
  }
  return { battery, quota };
}
