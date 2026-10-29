import type { FrameOrientation, ResolvedOrientation } from "@/lib/frames/film";

export type LandscapeSide = "primary" | "secondary";

export interface DeviceRotation {
  facing: ResolvedOrientation;
  angle: number;
  /** Which landscape direction when facing is landscape. */
  landscapeSide: LandscapeSide;
  /** True when the phone is upside-down in portrait. */
  portraitInverted: boolean;
  type: string;
}

/** Prefer the live viewfinder box — it already tracks phone rotation for the preview. */
export function viewfinderOrientation(canvas: { clientWidth: number; clientHeight: number } | null | undefined): ResolvedOrientation | null {
  if (!canvas || canvas.clientWidth < 2 || canvas.clientHeight < 2) return null;
  return canvas.clientWidth >= canvas.clientHeight ? "landscape" : "portrait";
}

/** Visible viewport aspect — matches CSS layout after rotate better than screen.orientation. */
export function layoutOrientation(): ResolvedOrientation {
  if (typeof window === "undefined") return "portrait";
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  if (width >= 2 && height >= 2) return width >= height ? "landscape" : "portrait";
  if (window.matchMedia("(orientation: landscape)").matches) return "landscape";
  if (window.matchMedia("(orientation: portrait)").matches) return "portrait";
  return "portrait";
}

/** Phone / viewport orientation used when the viewfinder size is unavailable. */
export function currentViewOrientation(): ResolvedOrientation {
  return readDeviceRotation().facing;
}

/**
 * Auto follows the live preview facing when provided, then the viewfinder box, then layout.
 * Locked Portrait/Landscape always win.
 */
export function resolveCaptureOrientation(
  setting: FrameOrientation,
  previewFacing?: ResolvedOrientation | null,
  canvas?: { clientWidth: number; clientHeight: number } | null,
): ResolvedOrientation {
  if (setting === "portrait" || setting === "landscape") return setting;
  if (previewFacing === "portrait" || previewFacing === "landscape") return previewFacing;
  return viewfinderOrientation(canvas) ?? layoutOrientation();
}

export function screenOrientationAngle(): number {
  return readDeviceRotation().angle;
}

/**
 * Read rotation for left/right landscape correction.
 * Facing comes from the visible layout (same signal family as the preview), because
 * `screen.orientation.type` often stays portrait on phones after rotate.
 */
export function readDeviceRotation(): DeviceRotation {
  if (typeof window === "undefined") {
    return { facing: "portrait", angle: 0, landscapeSide: "primary", portraitInverted: false, type: "" };
  }

  const type = window.screen?.orientation?.type ?? "";
  let angle = 0;
  const reported = window.screen?.orientation?.angle;
  if (typeof reported === "number" && Number.isFinite(reported)) {
    angle = ((reported % 360) + 360) % 360;
  } else {
    const legacy = (window as Window & { orientation?: number }).orientation;
    if (typeof legacy === "number" && Number.isFinite(legacy)) {
      angle = ((legacy % 360) + 360) % 360;
    }
  }

  const facing = layoutOrientation();
  let landscapeSide: LandscapeSide = "primary";
  let portraitInverted = false;

  if (type === "landscape-secondary") landscapeSide = "secondary";
  else if (type === "landscape-primary") landscapeSide = "primary";
  else if (facing === "landscape") landscapeSide = angle === 270 || angle === 180 ? "secondary" : "primary";

  if (type === "portrait-secondary") portraitInverted = true;
  else if (facing === "portrait") portraitInverted = angle === 180;

  if (facing === "landscape") {
    if (angle === 0 || angle === 180) angle = landscapeSide === "secondary" ? 270 : 90;
  } else if (angle === 90 || angle === 270) {
    angle = portraitInverted ? 180 : 0;
  }

  return { facing, angle, landscapeSide, portraitInverted, type };
}

/**
 * Quarter-turns clockwise so a still matches the held phone.
 * Landscape-right (primary) and landscape-left (secondary) share the same aspect,
 * so secondary adds a half-turn or the still looks flipped.
 */
export function quarterTurnsToMatch(
  width: number,
  height: number,
  facing: ResolvedOrientation,
  screenAngle = 0,
  landscapeSide: LandscapeSide = "primary",
  portraitInverted = false,
): 0 | 1 | 2 | 3 {
  const isLandscape = width >= height;
  const wantLandscape = facing === "landscape";
  // First fix aspect with a single quarter turn when needed (primary / upright sense).
  let turns = isLandscape === wantLandscape ? 0 : 1;

  const angle = ((screenAngle % 360) + 360) % 360;
  const secondary = wantLandscape && (landscapeSide === "secondary" || angle === 270);
  const inverted = !wantLandscape && (portraitInverted || angle === 180);

  // Opposite landscape / upside-down portrait = same aspect, opposite "up".
  if (secondary || inverted) turns = (turns + 2) % 4;

  return turns as 0 | 1 | 2 | 3;
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
  const rotation = readDeviceRotation();
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    let turns = quarterTurnsToMatch(
      bitmap.width,
      bitmap.height,
      facing,
      rotation.angle,
      rotation.landscapeSide,
      rotation.portraitInverted,
    );
    if (turns === 0 && !aspectMatches(bitmap.width, bitmap.height, facing)) {
      turns = facing === "landscape" && rotation.landscapeSide === "secondary" ? 3 : 1;
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
