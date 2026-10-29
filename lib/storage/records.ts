import type { PrintCaption } from "@/lib/frames/caption";
import type { FrameId, FrameOrientation } from "@/lib/frames/film";

export type OriginalSource = "image-capture" | "video-frame" | "none";

export interface CaptureMetadata {
  width: number;
  height: number;
  facingMode: string | null;
  trackSettings: Record<string, unknown>;
  stillOptions: Record<string, unknown>;
  exposureSummary: string;
  whiteBalanceLabel: string;
  gradedNote: string;
  timerSeconds: number;
  burstIndex: number | null;
  videoFps: number | null;
  audio: string | null;
  webgl: string;
  frameId?: FrameId;
  frameOrientation?: FrameOrientation;
  caption?: PrintCaption | null;
}

export interface CaptureRecord {
  id: string;
  kind: "photo" | "video";
  createdAt: number;
  lutId: string;
  lutName: string;
  intensity: number;
  favorite: boolean;
  graded: Blob;
  /** Framed still without handwriting, when a print frame was used. */
  printBase?: Blob | null;
  original: Blob | null;
  thumbnail: Blob;
  originalSource: OriginalSource;
  metadata: CaptureMetadata;
}
