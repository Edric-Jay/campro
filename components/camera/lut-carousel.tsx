"use client";

import { useEffect, useMemo, useState } from "react";
import { LOOKS } from "@/lib/lut/builtin";
import { gradeSample, type Lut3D } from "@/lib/lut/grade";
import type { AppSettings } from "@/lib/storage/settings";

function thumb(lut: Lut3D) {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 72;
  canvas.height = 40;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(72, 40);
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 72; x += 1) {
      const t = x / 71;
      const graded = gradeSample(lut, [0.08 + t * 0.86, 0.07 + t * 0.68, 0.06 + t * 0.5], 1);
      const index = (y * 72 + x) * 4;
      image.data[index] = graded[0] * 255;
      image.data[index + 1] = graded[1] * 255;
      image.data[index + 2] = graded[2] * 255;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function LutCarousel({
  luts,
  settings,
  disabled,
  onSelect,
  onIntensity,
  onFavorite,
  onImport,
  onDelete,
}: {
  luts: Lut3D[];
  settings: AppSettings;
  disabled: boolean;
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
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="font-mono text-[10px] tracking-[0.16em] text-paper/55 uppercase">{active?.name ?? "Natural"}</p>
        <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-paper/55 uppercase">
          {Math.round(settings.lutIntensity)}%
          <input
            aria-label="LUT intensity"
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={settings.lutIntensity}
            onChange={(event) => onIntensity(Number(event.target.value))}
            className="w-24 accent-sage"
          />
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto px-1 pb-1">
        {luts.map((lut) => (
          <button
            key={lut.id}
            type="button"
            disabled={disabled}
            aria-pressed={lut.id === settings.lutId}
            onClick={() => onSelect(lut.id)}
            className={`w-24 shrink-0 overflow-hidden rounded-md border text-left ${
              lut.id === settings.lutId ? "border-sage" : "border-paper/15"
            }`}
          >
            {previews.get(lut.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews.get(lut.id)} alt="" className="h-10 w-full object-cover" />
            ) : (
              <span className="block h-10 bg-ink" />
            )}
            <span className="block px-1.5 py-1 text-[11px]">{lut.name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          className="min-h-8 rounded-full border border-paper/15 px-3 text-[11px]"
          onClick={() => active && onFavorite(active.id)}
        >
          {active && settings.favorites.includes(active.id) ? "Favorited" : "Favorite"}
        </button>
        <label className="min-h-8 cursor-pointer rounded-full border border-paper/15 px-3 text-[11px] leading-8">
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
          <button type="button" className="min-h-8 text-[11px] text-paper/60" onClick={() => onDelete(active.id)}>
            Remove look
          </button>
        ) : null}
        <p className="truncate text-[11px] text-paper/45">{active ? notes.get(active.id) ?? "Imported LUT" : ""}</p>
      </div>
    </div>
  );
}
