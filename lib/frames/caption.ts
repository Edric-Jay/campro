import { frameLayout, type FrameId, type FrameOrientation, type FrameLayout, resolveOrientation } from "./film";

export const CAPTION_FRAME_IDS = ["instax", "instax-wide", "polaroid"] as const;

export type CaptionFrameId = (typeof CAPTION_FRAME_IDS)[number];

export type CaptionAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface HandwritingFont {
  id: string;
  name: string;
  /** Real family name for canvas baking */
  family: string;
  /** CSS stack for the editor UI */
  css: string;
}

export const HANDWRITING_FONTS: HandwritingFont[] = [
  { id: "caveat", name: "Caveat", family: "Caveat", css: "var(--font-caveat), Caveat, cursive" },
  { id: "patrick", name: "Patrick Hand", family: "Patrick Hand", css: "var(--font-patrick), 'Patrick Hand', cursive" },
  { id: "homemade", name: "Homemade", family: "Homemade Apple", css: "var(--font-homemade), 'Homemade Apple', cursive" },
  { id: "shadows", name: "Shadows", family: "Shadows Into Light", css: "var(--font-shadows), 'Shadows Into Light', cursive" },
  { id: "reenie", name: "Reenie", family: "Reenie Beanie", css: "var(--font-reenie), 'Reenie Beanie', cursive" },
];

export const CAPTION_ANCHORS: { id: CaptionAnchor; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "center-left", label: "Center left" },
  { id: "center", label: "Center" },
  { id: "center-right", label: "Center right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

export type CaptionPlacement = "anchor" | "freehand";

export interface PrintCaption {
  text: string;
  fontId: string;
  includeDate: boolean;
  placement: CaptionPlacement;
  anchor: CaptionAnchor;
  /** Normalized position inside the caption band when placement is freehand. */
  x: number;
  y: number;
  /** Relative text scale. 1 is the default print size. */
  size: number;
}

export const CAPTION_SIZE_MIN = 0.6;
export const CAPTION_SIZE_MAX = 1.8;
export const CAPTION_SIZE_DEFAULT = 1;

export interface CaptionBand {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function isCaptionFrame(id: string | null | undefined): id is CaptionFrameId {
  return CAPTION_FRAME_IDS.includes(id as CaptionFrameId);
}

export function isCaptionAnchor(value: string): value is CaptionAnchor {
  return CAPTION_ANCHORS.some((item) => item.id === value);
}

export function captionBand(layout: FrameLayout): CaptionBand {
  return {
    left: 0,
    top: 1 - layout.padBottom,
    width: 1,
    height: layout.padBottom,
  };
}

export function fontById(id: string) {
  return HANDWRITING_FONTS.find((font) => font.id === id) ?? HANDWRITING_FONTS[0];
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function anchorToPoint(anchor: CaptionAnchor): { x: number; y: number } {
  return {
    x: anchor.endsWith("left") ? 0.12 : anchor.endsWith("right") ? 0.88 : 0.5,
    y: anchor.startsWith("top") ? 0.2 : anchor.startsWith("bottom") ? 0.8 : 0.5,
  };
}

export function normalizeCaption(input: Partial<PrintCaption> | null | undefined): PrintCaption {
  const anchor =
    input && typeof input.anchor === "string" && isCaptionAnchor(input.anchor)
      ? input.anchor
      : "bottom-center";
  const placement: CaptionPlacement = input?.placement === "freehand" ? "freehand" : "anchor";
  const point = anchorToPoint(anchor);
  const rawX = typeof input?.x === "number" && Number.isFinite(input.x) ? input.x : point.x;
  const rawY = typeof input?.y === "number" && Number.isFinite(input.y) ? input.y : point.y;
  const rawSize = typeof input?.size === "number" && Number.isFinite(input.size) ? input.size : CAPTION_SIZE_DEFAULT;
  const size = Math.min(CAPTION_SIZE_MAX, Math.max(CAPTION_SIZE_MIN, rawSize));
  return {
    text: typeof input?.text === "string" ? input.text : "",
    fontId: typeof input?.fontId === "string" ? input.fontId : "caveat",
    includeDate: Boolean(input?.includeDate),
    placement,
    anchor,
    x: clamp01(rawX),
    y: clamp01(rawY),
    size,
  };
}

export function captionFontPx(bandW: number, bandH: number, sizeScale: number) {
  const base = Math.max(14, Math.min(bandH * 0.34, bandW * 0.085));
  return Math.max(12, base * sizeScale);
}

/** CSS px that matches the baked print when shown at `displayWidth`. */
export function captionPreviewFontPx(
  naturalWidth: number,
  naturalHeight: number,
  band: CaptionBand,
  displayWidth: number,
  sizeScale: number,
) {
  if (naturalWidth < 1 || naturalHeight < 1 || displayWidth < 1) {
    return captionFontPx(band.width * Math.max(displayWidth, 1), band.height * Math.max(displayWidth, 1), sizeScale);
  }
  const baked = captionFontPx(band.width * naturalWidth, band.height * naturalHeight, sizeScale);
  return baked * (displayWidth / naturalWidth);
}

/** Inner padding of the caption band, as fractions of band width/height (matches bake). */
export function captionBandPad(band: CaptionBand) {
  const bandW = Math.max(band.width, 1e-6);
  const bandH = Math.max(band.height, 1e-6);
  const pad = Math.min(bandW, bandH) * 0.1;
  return { x: pad / bandW, y: pad / bandH };
}

export function anchorStyle(anchor: CaptionAnchor): {
  left: string;
  top: string;
  transform: string;
  textAlign: CanvasTextAlign;
} {
  const horizontal = anchor.endsWith("left") ? "left" : anchor.endsWith("right") ? "right" : "center";
  const vertical = anchor.startsWith("top") ? "top" : anchor.startsWith("bottom") ? "bottom" : "center";
  const left = horizontal === "left" ? "0%" : horizontal === "right" ? "100%" : "50%";
  const top = vertical === "top" ? "0%" : vertical === "bottom" ? "100%" : "50%";
  const tx = horizontal === "left" ? "0%" : horizontal === "right" ? "-100%" : "-50%";
  const ty = vertical === "top" ? "0%" : vertical === "bottom" ? "-100%" : "-50%";
  return {
    left,
    top,
    transform: `translate(${tx}, ${ty})`,
    textAlign: horizontal,
  };
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [] as string[];
  const lines: string[] = [];
  let line = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const next = `${line} ${words[index]}`;
    if (context.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = words[index];
    }
  }
  lines.push(line);
  return lines.slice(0, 4);
}

async function resolveCanvasFont(font: HandwritingFont, size: number) {
  let family = font.family;
  if (typeof document !== "undefined") {
    const varName = font.css.match(/var\((--font-[\w-]+)/)?.[1];
    if (varName) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      const resolved = value.replace(/['"]/g, "").split(",")[0]?.trim();
      if (resolved) family = resolved;
    }
  }
  const stack = family.includes(" ") ? `"${family}"` : family;
  try {
    await document.fonts.load(`${size}px ${stack}`);
    await document.fonts.ready;
  } catch {
    // Canvas falls back to cursive if the face is still unavailable.
  }
  return `${size}px ${stack}, cursive`;
}

export async function bakePrintCaption(
  blob: Blob,
  frameId: FrameId,
  orientation: FrameOrientation,
  caption: PrintCaption,
  capturedAt: number,
) {
  if (!isCaptionFrame(frameId)) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const facing = resolveOrientation(orientation, bitmap.width, bitmap.height);
    const layout = frameLayout(frameId, facing);
    if (!layout) return blob;
    const band = captionBand(layout);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.drawImage(bitmap, 0, 0);
    const font = fontById(caption.fontId);
    const bandX = band.left * canvas.width;
    const bandY = band.top * canvas.height;
    const bandW = band.width * canvas.width;
    const bandH = band.height * canvas.height;
    const pad = Math.min(bandW, bandH) * 0.1;
    const size = captionFontPx(bandW, bandH, caption.size || CAPTION_SIZE_DEFAULT);
    context.font = await resolveCanvasFont(font, size);
    context.fillStyle = "#2a2824";
    const freehand = caption.placement === "freehand";
    const place = anchorStyle(caption.anchor);
    context.textAlign = freehand ? "center" : place.textAlign;
    context.textBaseline = "middle";
    const dateLine = caption.includeDate
      ? new Date(capturedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "";
    const body = caption.text.trim();
    const lines = [...wrapLines(context, body, bandW - pad * 2), ...(dateLine ? [dateLine] : [])];
    if (!lines.length) return canvasToJpeg(canvas);
    const lineHeight = size * 1.2;
    const blockHeight = lines.length * lineHeight;
    let originX: number;
    let originY: number;
    if (freehand) {
      const x = clamp01(typeof caption.x === "number" ? caption.x : 0.5);
      const y = clamp01(typeof caption.y === "number" ? caption.y : 0.5);
      originX = bandX + pad + (bandW - pad * 2) * x;
      originY = bandY + pad + (bandH - pad * 2) * y;
    } else {
      const horizontal = caption.anchor.endsWith("left") ? "left" : caption.anchor.endsWith("right") ? "right" : "center";
      const vertical = caption.anchor.startsWith("top") ? "top" : caption.anchor.startsWith("bottom") ? "bottom" : "center";
      originX = horizontal === "left" ? bandX + pad : horizontal === "right" ? bandX + bandW - pad : bandX + bandW / 2;
      originY =
        vertical === "top"
          ? bandY + pad + blockHeight / 2
          : vertical === "bottom"
            ? bandY + bandH - pad - blockHeight / 2
            : bandY + bandH / 2;
    }
    originY = Math.min(Math.max(originY, bandY + pad + blockHeight / 2), bandY + bandH - pad - blockHeight / 2);
    lines.forEach((line, index) => {
      const y = originY - blockHeight / 2 + lineHeight * (index + 0.5);
      context.fillText(line, originX, y);
    });
    return canvasToJpeg(canvas);
  } finally {
    bitmap.close();
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (!next || next.size === 0) reject(new Error("Could not encode the captioned print."));
      else resolve(next);
    }, "image/jpeg", 0.92);
  });
}
