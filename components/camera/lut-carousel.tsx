"use client";

import { useEffect, useMemo, useState } from "react";
import { BUILTIN_LOOK_INDEX, LOOKS } from "@/lib/lut/builtin";
import type { Rgb } from "@/lib/lut/color";
import { gradeBuiltinColor, gradeSample, type Lut3D } from "@/lib/lut/grade";
import type { AppSettings } from "@/lib/storage/settings";

const PREVIEW_WIDTH = 120;
const PREVIEW_HEIGHT = 80;

function sceneColor(x: number, y: number): Rgb {
  const u = x / (PREVIEW_WIDTH - 1);
  const v = y / (PREVIEW_HEIGHT - 1);
  const sunX = u - 0.78;
  const sunY = v - 0.22;
  if (sunX * sunX + sunY * sunY < 0.012) return [0.98, 0.84, 0.42];
  if (v < 0.46) {
    const sky = v / 0.46;
    return [0.34 + sky * 0.28, 0.58 - sky * 0.12, 0.86 - sky * 0.16];
  }
  if (u < 0.34 && v > 0.5 && v < 0.86) return [0.74, 0.5, 0.38];
  if (u >= 0.34 && u < 0.72 && v > 0.5 && v < 0.84) return [0.2, 0.4, 0.22];
  return [0.16 + u * 0.08, 0.12, 0.09];
}

function thumb(lut: Lut3D) {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(PREVIEW_WIDTH, PREVIEW_HEIGHT);
  for (let y = 0; y < PREVIEW_HEIGHT; y += 1) {
    for (let x = 0; x < PREVIEW_WIDTH; x += 1) {
      const source = sceneColor(x, y);
      const look = BUILTIN_LOOK_INDEX[lut.id];
      const graded = look == null ? gradeSample(lut, source, 1) : gradeBuiltinColor(source, look);
      const index = (y * PREVIEW_WIDTH + x) * 4;
      image.data[index] = graded[0] * 255;
      image.data[index + 1] = graded[1] * 255;
      image.data[index + 2] = graded[2] * 255;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export function LutCarousel({
  luts,
  settings,
  disabled,
  layout = "row",
  onSelect,
  onIntensity,
  onFavorite,
  onImport,
  onDelete,
}: {
  luts: Lut3D[];
  settings: AppSettings;
  disabled: boolean;
  layout?: "row" | "grid";
  onSelect: (id: string) => void;
  onIntensity: (value: number) => void;
  onFavorite: (id: string) => void;
  onImport: (file: File) => void;
  onDelete: (id: string) => void;
}) {
  const notes = useMemo(() => new Map(LOOKS.map((look) => [look.id, look.note])), []);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    setPreviews(new Map(luts.map((lut) => [lut.id, thumb(lut)])));
  }, [luts]);
  const active = luts.find((lut) => lut.id === settings.lutId) ?? luts[0];

  return (
    <div className="flex flex-col gap-2" data-testid="lut-carousel">
      <div className="flex flex-col gap-2 px-3">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10px] tracking-[0.16em] text-paper/55 uppercase">{active?.name ?? "Natural"}</p>
          <p className="font-mono text-sm text-paper">{Math.round(settings.lutIntensity)}%</p>
        </div>
        <input
          aria-label="LUT intensity"
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          value={settings.lutIntensity}
          onChange={(event) => onIntensity(Number(event.target.value))}
          className="h-8 w-full accent-sage"
        />
      </div>
      <div className={layout === "grid" ? "grid grid-cols-3 gap-2 px-3" : "flex gap-2 overflow-x-auto px-3 pb-1"}>
        {luts.map((lut) => (
          <button
            key={lut.id}
            type="button"
            disabled={disabled}
            aria-pressed={lut.id === settings.lutId}
            onClick={() => onSelect(lut.id)}
            className={`overflow-hidden rounded-md border bg-ink text-left ${
              layout === "grid" ? "min-w-0" : "w-28 shrink-0"
            } ${lut.id === settings.lutId ? "border-sage" : "border-paper/15"}`}
          >
            {previews.get(lut.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews.get(lut.id)} alt="" className="aspect-[3/2] w-full object-cover" />
            ) : (
              <span className="block aspect-[3/2] bg-ink" />
            )}
            <span className="block truncate px-1.5 pt-1 text-[11px]">{lut.name}</span>
            <span className="block truncate px-1.5 pb-1.5 text-[10px] text-paper/45">
              {notes.get(lut.id) ?? "Imported LUT"}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3">
        <button
          type="button"
          className="min-h-8 shrink-0 rounded-full border border-paper/15 px-3 text-[11px]"
          onClick={() => active && onFavorite(active.id)}
        >
          {active && settings.favorites.includes(active.id) ? "Favorited" : "Favorite"}
        </button>
        <label className="min-h-8 shrink-0 cursor-pointer rounded-full border border-paper/15 px-3 text-[11px] leading-8">
          Import .cube
          <input
            type="file"
            accept=".cube,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = "";
            }}
          />
        </label>
        {active && active.id.startsWith("custom-") ? (
          <button type="button" className="min-h-8 shrink-0 text-[11px] text-paper/60" onClick={() => onDelete(active.id)}>
            Remove look
          </button>
        ) : null}
      </div>
    </div>
  );
}
