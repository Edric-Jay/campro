"use client";

import type { ReactNode } from "react";
import type { SupportLevel } from "@/lib/camera/types";

export function TechLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] tracking-[0.16em] text-paper/55 uppercase">{children}</p>;
}

const LEVEL_TEXT: Record<SupportLevel, string> = {
  supported: "Supported",
  partial: "Partial",
  "preview-only": "Preview only",
  unavailable: "Unavailable",
};

export function LevelBadge({ level }: { level: SupportLevel }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.14em] text-sage uppercase" data-level={level}>
      {LEVEL_TEXT[level]}
    </span>
  );
}

export function Dial({
  label,
  testId,
  level,
  reason,
  value,
  options,
  onChange,
  warning,
}: {
  label: string;
  testId: string;
  level: SupportLevel;
  reason: string;
  value: string;
  options: { id: string; label: string; disabled: boolean }[];
  onChange: (id: string) => void;
  warning?: string | null;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <TechLabel>{label}</TechLabel>
        <LevelBadge level={level} />
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
            className={`min-h-9 shrink-0 rounded-full border px-3 font-mono text-xs ${
              option.id === value
                ? "border-sage bg-paper text-ink"
                : "border-paper/15 text-paper disabled:text-paper/30"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-paper/55">{reason}</p>
      {warning ? <p className="text-xs text-amber">{warning}</p> : null}
    </section>
  );
}

export function RangeField({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
  display,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  display?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <TechLabel>{label}</TechLabel>
        <span className="font-mono text-sm text-paper">
          {display ?? `${value}${suffix ?? ""}`}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-sage"
      />
    </label>
  );
}
