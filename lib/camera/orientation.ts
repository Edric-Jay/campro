import type { FrameOrientation, ResolvedOrientation } from "@/lib/frames/film";

/** Phone / viewport orientation used for live preview and Auto print. */
export function currentViewOrientation(): ResolvedOrientation {
  if (typeof window === "undefined") return "portrait";
  const type = window.screen?.orientation?.type;
  if (typeof type === "string") {
    if (type.startsWith("landscape")) return "landscape";
    if (type.startsWith("portrait")) return "portrait";
  }
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (legacy === 90 || legacy === -90 || legacy === 270) return "landscape";
  if (legacy === 0 || legacy === 180) return "portrait";
  return window.innerWidth >= window.innerHeight ? "landscape" : "portrait";
}

export function resolvePrintOrientation(setting: FrameOrientation): ResolvedOrientation {
  if (setting === "portrait" || setting === "landscape") return setting;
  return currentViewOrientation();
}

export function screenOrientationAngle(): number {
  if (typeof window === "undefined") return 0;
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === "number" && Number.isFinite(angle)) return ((angle % 360) + 360) % 360;
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (typeof legacy === "number" && Number.isFinite(legacy)) return ((legacy % 360) + 360) % 360;
  return currentViewOrientation() === "landscape" ? 90 : 0;
}

/**
 * Quarter-turns clockwise so a still's pixel aspect matches the phone orientation.
 * ImageCapture / video frames often keep sensor orientation while the UI has rotated.
 */
export function quarterTurnsToMatch(
  width: number,
  height: number,
  facing: ResolvedOrientation,
  screenAngle = 0,
): 0 | 1 | 2 | 3 {
  const isLandscape = width >= height;
  const wantLandscape = facing === "landscape";
  if (isLandscape === wantLandscape) return 0;
  const angle = ((screenAngle % 360) + 360) % 360;
  if (wantLandscape) {
    if (angle === 270) return 3;
    return 1;
  }
  if (angle === 90) return 3;
  if (angle === 270) return 1;
  if (angle === 180) return 2;
  return 1;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (!next || next.size === 0) reject(new Error("Could not encode the oriented still."));
      else resolve(next);
    }, "image/jpeg", quality);
  });
}

function drawRotated(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  turns: 1 | 2 | 3,
) {
  const width = turns % 2 === 0 ? bitmap.width : bitmap.height;
  const height = turns % 2 === 0 ? bitmap.height : bitmap.width;
  context.canvas.width = width;
  context.canvas.height = height;
  context.translate(width / 2, height / 2);
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
}

/** Bake EXIF orientation and rotate so the still matches the held phone orientation. */
export async function normalizeStillToOrientation(blob: Blob, facing: ResolvedOrientation): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const turns = quarterTurnsToMatch(bitmap.width, bitmap.height, facing, screenOrientationAngle());
    if (turns === 0) {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return { blob, width: bitmap.width, height: bitmap.height };
      context.drawImage(bitmap, 0, 0);
      const next = await canvasToJpeg(canvas);
      return { blob: next, width: canvas.width, height: canvas.height };
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return { blob, width: bitmap.width, height: bitmap.height };
    drawRotated(context, bitmap, turns);
    const next = await canvasToJpeg(canvas);
    return { blob: next, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}
