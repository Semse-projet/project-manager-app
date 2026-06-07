import type { ElementType } from "react";
import { cn } from "../lib/cn";
import { HtmlInCanvasPanel } from "./HtmlInCanvasPanel";

type IconType = ElementType;

export type StatCardColor = "blue" | "green" | "amber" | "red" | "violet" | "cyan" | "orange";

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    label?: string;
    inverted?: boolean;
  };
  icon?: IconType;
  color?: StatCardColor;
  description?: string;
  loading?: boolean;
  className?: string;
}

const colorMap: Record<StatCardColor, string> = {
  blue: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  red: "border-red-500/20 bg-red-500/10 text-red-300",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
};

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  color = "blue",
  description,
  loading = false,
  className,
}: StatCardProps) {
  const isPositiveDelta = delta ? (delta.inverted ? delta.value < 0 : delta.value > 0) : null;
  const deltaClass =
    isPositiveDelta === null ? "text-slate-400" : isPositiveDelta ? "text-emerald-300" : "text-red-300";

  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-white/10 bg-[#0d1220] p-5", className)}>
        <div className="mb-3 h-3 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-8 w-16 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  return (
    <HtmlInCanvasPanel
      as="section"
      className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1220] p-5", className)}
      canvasClassName="rounded-2xl"
      minHeight={148}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-white/10" />
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        </div>
        {Icon ? (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", colorMap[color])}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-3xl font-extrabold tracking-[-0.03em] text-white">{value}</p>
        {description ? <p className="text-xs text-slate-400">{description}</p> : null}
      </div>

      {delta ? (
        <div className={cn("mt-4 flex items-center gap-1.5 text-xs font-semibold", deltaClass)}>
          <span>{delta.value > 0 ? "+" : ""}{delta.value}%</span>
          {delta.label ? <span className="font-normal text-slate-400">{delta.label}</span> : null}
        </div>
      ) : null}
    </HtmlInCanvasPanel>
  );
}
