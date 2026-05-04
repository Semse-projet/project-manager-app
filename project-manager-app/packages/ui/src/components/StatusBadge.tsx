import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type StatusBadgeVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "violet";

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: StatusBadgeVariant;
  text: string;
  size?: "sm" | "md";
  dot?: boolean;
}

const variantClassMap: Record<StatusBadgeVariant, string> = {
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  error: "border-red-500/25 bg-red-500/10 text-red-300",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  neutral: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
};

const sizeClassMap = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
} as const;

export function StatusBadge({
  variant,
  text,
  size = "md",
  dot = false,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-[0.08em] whitespace-nowrap",
        variantClassMap[variant],
        sizeClassMap[size],
        className
      )}
      {...props}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {text}
    </span>
  );
}
