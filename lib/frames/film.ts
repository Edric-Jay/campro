export const FRAME_IDS = ["none", "instax", "instax-wide", "polaroid", "film-35", "classic"] as const;

export type FrameId = (typeof FRAME_IDS)[number];
export type FrameOrientation = "auto" | "portrait" | "landscape";
export type ResolvedOrientation = "portrait" | "landscape";

export interface FrameOption {
  id: FrameId;
  name: string;
  note: string;
}

export interface FrameLayout {
  outerAspect: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  paper: string;
  hole: string;
  sprockets: "none" | "horizontal" | "vertical";
}

export const FRAMES: FrameOption[] = [
  { id: "none", name: "None", note: "Full frame" },
  { id: "instax", name: "Instax", note: "Mini instant" },
  { id: "instax-wide", name: "Instax Wide", note: "Wide instant" },
  { id: "polaroid", name: "Polaroid", note: "Square print" },
  { id: "film-35", name: "35mm", note: "Film strip" },
  { id: "classic", name: "Classic", note: "Matte print" },
];

const FRAME_SET = new Set<string>(FRAME_IDS);
const ORIENTATION_SET = new Set<string>(["auto", "portrait", "landscape"]);

export function isFrameId(value: string): value is FrameId {
  return FRAME_SET.has(value);
}

export function isFrameOrientation(value: string): value is FrameOrientation {
  return ORIENTATION_SET.has(value);
}

export function resolveOrientation(orientation: FrameOrientation, width: number, height: number): ResolvedOrientation {
  if (orientation === "portrait" || orientation === "landscape") return orientation;
  return width >= height ? "landscape" : "portrait";
}

/** Aspect of the printable image window (W/H), without the paper border. */
export function imageWindowAspect(id: FrameId, orientation: ResolvedOrientation): number | null {
  const layout = frameLayout(id, orientation);
  if (!layout) return null;
  const width = 1 - layout.padLeft - layout.padRight;
  const height = 1 - layout.padTop - layout.padBottom;
  return (layout.outerAspect * width) / height;
}

export function frameLayout(id: FrameId, orientation: ResolvedOrientation): FrameLayout | null {
  if (id === "none") return null;
  const landscape = orientation === "landscape";
  if (id === "instax") {
    return landscape
      ? { outerAspect: 86 / 54, padTop: 0.09, padRight: 0.07, padBottom: 0.2, padLeft: 0.07, paper: "#f7f4ee", hole: "#1a1a18", sprockets: "none" }
      : { outerAspect: 54 / 86, padTop: 0.09, padRight: 0.074, padBottom: 0.19, padLeft: 0.074, paper: "#f7f4ee", hole: "#1a1a18", sprockets: "none" };
  }
  if (id === "instax-wide") {
    return landscape
      ? { outerAspect: 108 / 86, padTop: 0.1, padRight: 0.045, padBottom: 0.18, padLeft: 0.045, paper: "#f4f1ea", hole: "#1a1a18", sprockets: "none" }
      : { outerAspect: 86 / 108, padTop: 0.08, padRight: 0.08, padBottom: 0.2, padLeft: 0.08, paper: "#f4f1ea", hole: "#1a1a18", sprockets: "none" };
  }
  if (id === "polaroid") {
    return landscape
      ? { outerAspect: 1.22, padTop: 0.06, padRight: 0.06, padBottom: 0.22, padLeft: 0.06, paper: "#f3f0e7", hole: "#22211e", sprockets: "none" }
      : { outerAspect: 0.84, padTop: 0.055, padRight: 0.08, padBottom: 0.24, padLeft: 0.08, paper: "#f3f0e7", hole: "#22211e", sprockets: "none" };
  }
  if (id === "film-35") {
    return landscape
      ? { outerAspect: 1.7, padTop: 0.1, padRight: 0.04, padBottom: 0.1, padLeft: 0.04, paper: "#141413", hole: "#0c0c0b", sprockets: "horizontal" }
      : { outerAspect: 0.62, padTop: 0.04, padRight: 0.12, padBottom: 0.04, padLeft: 0.12, paper: "#141413", hole: "#0c0c0b", sprockets: "vertical" };
  }
  return landscape
    ? { outerAspect: 1.4, padTop: 0.05, padRight: 0.05, padBottom: 0.09, padLeft: 0.05, paper: "#f4efe4", hole: "#2a2824", sprockets: "none" }
    : { outerAspect: 0.75, padTop: 0.05, padRight: 0.06, padBottom: 0.1, padLeft: 0.06, paper: "#f4efe4", hole: "#2a2824", sprockets: "none" };
}

function cover(srcWidth: number, srcHeight: number, destWidth: number, destHeight: number) {
  const scale = Math.max(destWidth / srcWidth, destHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return { x: (destWidth - width) / 2, y: (destHeight - height) / 2, width, height };
}

function drawSprockets(
  context: CanvasRenderingContext2D,
  layout: FrameLayout,
  outerWidth: number,
  outerHeight: number,
) {
  context.fillStyle = layout.hole;
  const radius = Math.min(outerWidth, outerHeight) * 0.018;
  const count = layout.sprockets === "horizontal" ? 10 : 8;
  const spots =
    layout.sprockets === "horizontal"
      ? [layout.padTop / 2, 1 - layout.padBottom / 2].flatMap((y) =>
          Array.from({ length: count }, (_, index) => ({ x: (index + 0.5) / count, y })),
        )
      : [layout.padLeft / 2, 1 - layout.padRight / 2].flatMap((x) =>
          Array.from({ length: count }, (_, index) => ({ x, y: (index + 0.5) / count })),
        );
  for (const spot of spots) {
    context.beginPath();
    context.arc(spot.x * outerWidth, spot.y * outerHeight, radius, 0, Math.PI * 2);
    context.fill();
  }
}

export async function applyFilmFrame(blob: Blob, frameId: FrameId, orientation: FrameOrientation) {
  if (frameId === "none") return blob;
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const facing = resolveOrientation(orientation, bitmap.width, bitmap.height);
    const layout = frameLayout(frameId, facing);
    if (!layout) return blob;
    const longEdge = Math.max(bitmap.width, bitmap.height, 640);
    const outerWidth = facing === "landscape" ? longEdge : Math.round(longEdge * layout.outerAspect);
    const outerHeight = facing === "landscape" ? Math.round(longEdge / layout.outerAspect) : longEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, outerWidth);
    canvas.height = Math.max(2, outerHeight);
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.fillStyle = layout.paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const windowX = canvas.width * layout.padLeft;
    const windowY = canvas.height * layout.padTop;
    const windowWidth = canvas.width * (1 - layout.padLeft - layout.padRight);
    const windowHeight = canvas.height * (1 - layout.padTop - layout.padBottom);
    const placed = cover(bitmap.width, bitmap.height, windowWidth, windowHeight);
    context.save();
    context.beginPath();
    context.rect(windowX, windowY, windowWidth, windowHeight);
    context.clip();
    context.drawImage(bitmap, windowX + placed.x, windowY + placed.y, placed.width, placed.height);
    context.restore();
    if (layout.sprockets !== "none") drawSprockets(context, layout, canvas.width, canvas.height);
    const framed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((next) => {
        if (!next || next.size === 0) reject(new Error("Could not encode the framed photo."));
        else resolve(next);
      }, "image/jpeg", 0.92);
    });
    return framed;
  } finally {
    bitmap.close();
  }
}
