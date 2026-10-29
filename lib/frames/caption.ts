import { frameLayout, type FrameId, type FrameOrientation, type FrameLayout, resolveOrientation } from "./film";

export const CAPTION_FRAME_IDS = ["instax", "instax-wide", "polaroid"] as const;

export type CaptionFrameId = (typeof CAPTION_FRAME_IDS)[number];

export interface HandwritingFont {
  id: string;
  name: string;
  family: string;
}

export const HANDWRITING_FONTS: HandwritingFont[] = [
  { id: "caveat", name: "Caveat", family: "var(--font-caveat), cursive" },
  { id: "patrick", name: "Patrick Hand", family: "var(--font-patrick), cursive" },
  { id: "homemade", name: "Homemade", family: "var(--font-homemade), cursive" },
  { id: "shadows", name: "Shadows", family: "var(--font-shadows), cursive" },
  { id: "reenie", name: "Reenie", family: "var(--font-reenie), cursive" },
];

export interface PrintCaption {
  text: string;
  fontId: string;
  includeDate: boolean;
  /** 0–1 across the white caption band */
  x: number;
  /** 0–1 down the white caption band */
  y: number;
}

export interface CaptionBand {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function isCaptionFrame(id: string | null | undefined): id is CaptionFrameId {
  return CAPTION_FRAME_IDS.includes(id as CaptionFrameId);
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
    const pad = Math.min(bandW, bandH) * 0.08;
    const size = Math.max(14, Math.min(bandH * 0.34, bandW * 0.08));
    await document.fonts.load(`${size}px ${font.family.replace(/var\([^)]+\),?\s*/g, "").trim() || "cursive"}`).catch(() => undefined);
    context.fillStyle = "#2a2824";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = `${size}px ${font.family}`;
    const dateLine = caption.includeDate
      ? new Date(capturedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "";
    const body = caption.text.trim();
    const lines = [...wrapLines(context, body, bandW - pad * 2), ...(dateLine ? [dateLine] : [])];
    if (!lines.length) {
      const framed = await canvasToJpeg(canvas);
      return framed;
    }
    const lineHeight = size * 1.15;
    const blockHeight = lines.length * lineHeight;
    const anchorX = bandX + pad + Math.min(1, Math.max(0, caption.x)) * Math.max(0, bandW - pad * 2);
    const anchorY = bandY + pad + Math.min(1, Math.max(0, caption.y)) * Math.max(0, bandH - pad * 2);
    let startY = anchorY;
    if (startY - blockHeight / 2 < bandY + pad) startY = bandY + pad + blockHeight / 2;
    if (startY + blockHeight / 2 > bandY + bandH - pad) startY = bandY + bandH - pad - blockHeight / 2;
    lines.forEach((line, index) => {
      const y = startY - blockHeight / 2 + lineHeight * (index + 0.5);
      const width = context.measureText(line).width;
      const x = Math.min(Math.max(bandX + pad, anchorX - width / 2), bandX + bandW - pad - width);
      context.fillText(line, x, y);
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
