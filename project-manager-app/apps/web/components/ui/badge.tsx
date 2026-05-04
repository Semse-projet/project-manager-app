import { cn } from "../../lib/cn";

type BadgeVariant =
  | "default"
  | "success"
  | "info"
  | "warn"
  | "error"
  | "brand";

type BadgeProps = {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-white/[0.06] text-muted border-white/[0.1]",
  success: "bg-green-500/10 text-green-400 border-green-500/25",
  info:    "bg-blue-500/10 text-blue-300 border-blue-500/25",
  warn:    "bg-amber-500/10 text-amber-300 border-amber-500/25",
  error:   "bg-red-500/10 text-red-400 border-red-500/25",
  brand:   "bg-brand/10 text-brand border-brand/25",
};

export function Badge({ variant = "default", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[0.68rem] font-bold tracking-wide uppercase border",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Maps a job/milestone status string to the right Badge variant. */
export function statusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase().replace(/_/g, "-");
  if (["accepted", "approved", "released", "resolved", "completed"].includes(s))
    return "success";
  if (["submitted", "funded", "in-progress"].includes(s)) return "info";
  if (["rejected", "dispute", "open", "error", "cancelled"].includes(s))
    return "error";
  if (["changes-requested", "partially-released", "unfunded"].includes(s))
    return "warn";
  return "default";
}
