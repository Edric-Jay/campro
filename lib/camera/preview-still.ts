import { coverCrop } from "@/lib/lut/renderer";
import type { ResolvedOrientation } from "@/lib/frames/film";

/**
 * Decode a still in the same pixel orientation as the live video.
 * Phone cameras (and Redmi watermarks) stay upright relative to the sensor/preview;
 * applying EXIF first fights that and is what made landscape captures flip.
 */
export async function decodeStillLikeVideo(
  blob: Blob,
  videoWidth: number,
  videoHeight: number,
): Promise<ImageBitmap> {
  const raw = await createImageBitmap(blob);
  if (videoWidth < 2 || videoHeight < 2) return raw;

  const videoLandscape = videoWidth >= videoHeight;
  if (raw.width >= raw.height === videoLandscape) return raw;

  raw.close();
  const oriented = await createImageBitmap(blob, { imageOrientation: "from-image" });
  if (oriented.width >= oriented.height === videoLandscape) return oriented;

  oriented.close();
  return createImageBitmap(blob);
}

/** High-res output size that matches the live preview aspect (what you see is what you get). */
export function previewOutputSize(srcWidth: number, srcHeight: number, previewWidth: number, previewHeight: number) {
  const aspect = Math.max(previewWidth, 1) / Math.max(previewHeight, 1);
  const longEdge = Math.max(srcWidth, srcHeight, 640);
  if (aspect >= 1) {
    return { width: longEdge, height: Math.max(2, Math.round(longEdge / aspect)) };
  }
  return { width: Math.max(2, Math.round(longEdge * aspect)), height: longEdge };
}

export function previewFacingOf(width: number, height: number): ResolvedOrientation {
  return width >= height ? "landscape" : "portrait";
}

/** Same cover window the viewfinder uses, mapped onto a still buffer. */
export function previewCoverCrop(srcWidth: number, srcHeight: number, previewWidth: number, previewHeight: number) {
  return coverCrop(srcWidth, srcHeight, previewWidth, previewHeight);
}

/** 2D fallback when WebGL grading is unavailable — crop like the live preview. */
export async function rasterizePreviewStill(
  bitmap: ImageBitmap,
  previewWidth: number,
  previewHeight: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const out = previewOutputSize(bitmap.width, bitmap.height, previewWidth, previewHeight);
  const crop = previewCoverCrop(bitmap.width, bitmap.height, out.width, out.height);
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the still.");
  const sx = crop.u0 * bitmap.width;
  const sy = crop.v0 * bitmap.height;
  const sw = (crop.u1 - crop.u0) * bitmap.width;
  const sh = (crop.v1 - crop.v0) * bitmap.height;
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("Could not encode the still."))), "image/jpeg", 0.92);
  });
  return { blob, width: out.width, height: out.height };
}
