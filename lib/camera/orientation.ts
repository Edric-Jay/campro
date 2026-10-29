import type { FrameOrientation, ResolvedOrientation } from "@/lib/frames/film";

/** Prefer the live viewfinder box — it already tracks phone rotation for the preview. */
export function viewfinderOrientation(canvas: { clientWidth: number; clientHeight: number } | null | undefined): ResolvedOrientation | null {
  if (!canvas || canvas.clientWidth < 2 || canvas.clientHeight < 2) return null;
  return canvas.clientWidth >= canvas.clientHeight ? "landscape" : "portrait";
}

/** Phone / viewport orientation used when the viewfinder size is unavailable. */
export function currentViewOrientation(): ResolvedOrientation {
  if (typeof window === "undefined") return "portrait";
  if (window.matchMedia("(orientation: landscape)").matches) return "landscape";
  if (window.matchMedia("(orientation: portrait)").matches) return "portrait";
  const type = window.screen?.orientation?.type;
  if (typeof type === "string") {
    if (type.startsWith("landscape")) return "landscape";
    if (type.startsWith("portrait")) return "portrait";
  }
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (legacy === 90 || legacy === -90 || legacy === 270) return "landscape";
  if (legacy === 0 || legacy === 180) return "portrait";
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  return width >= height ? "landscape" : "portrait";
}

export function resolveCaptureOrientation(
  setting: FrameOrientation,
  canvas?: { clientWidth: number; clientHeight: number } | null,
): ResolvedOrientation {
  if (setting === "portrait" || setting === "landscape") return setting;
  return viewfinderOrientation(canvas) ?? currentViewOrientation();
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
 * Quarter-turns clockwise so a still's pixel aspect matches the target print orientation.
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
    // Portrait pixels → landscape print
    if (angle === 270) return 3;
    return 1;
  }
  // Landscape pixels → portrait print
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

function drawRotated(context: CanvasRenderingContext2D, bitmap: ImageBitmap, turns: 1 | 2 | 3) {
  const width = turns % 2 === 0 ? bitmap.width : bitmap.height;
  const height = turns % 2 === 0 ? bitmap.height : bitmap.width;
  context.canvas.width = width;
  context.canvas.height = height;
  context.translate(width / 2, height / 2);
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
}

function aspectMatches(width: number, height: number, facing: ResolvedOrientation) {
  return facing === "landscape" ? width >= height : height > width;
}

/** Bake EXIF orientation and rotate so the still matches the print/viewfinder orientation. */
export async function normalizeStillToOrientation(
  blob: Blob,
  facing: ResolvedOrientation,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    let turns = quarterTurnsToMatch(bitmap.width, bitmap.height, facing, screenOrientationAngle());
    // Guaranteed aspect match: if the angle heuristic picked a no-op incorrectly, force one quarter turn.
    if (turns === 0 && !aspectMatches(bitmap.width, bitmap.height, facing)) {
      turns = 1;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return { blob, width: bitmap.width, height: bitmap.height };
    if (turns === 0) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      context.drawImage(bitmap, 0, 0);
    } else {
      drawRotated(context, bitmap, turns);
    }
    const next = await canvasToJpeg(canvas);
    return { blob: next, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}
