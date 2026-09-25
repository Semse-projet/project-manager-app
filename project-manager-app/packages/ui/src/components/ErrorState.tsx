import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ErrorStateProps {
  message: string;
  /** Usually a "retry" button/link. */
  action?: ReactNode;
  /** Inline (fits inside a card/section) or block (fills its container, centered). */
  variant?: "inline" | "block";
  className?: string;
}

/** Minimal alert-circle glyph — packages/ui has no icon-library dependency. */
function AlertGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/**
 * Shared error panel for a failed fetch/mutation inside a page section —
 * same visual language everywhere a `.catch()` or an API error reaches the
 * UI, so an error never renders as unstyled or ad-hoc text.
 */
export function ErrorState({ message, action, variant = "inline", className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] border border-red-500/20 bg-red-500/[0.06] text-[13px] text-[var(--error)]",
        variant === "block" ? "flex-col items-center px-6 py-10 text-center" : "px-4 py-3.5",
        className
      )}
    >
      <span className="shrink-0 text-[var(--error)]">
        <AlertGlyph size={variant === "block" ? 28 : 16} />
      </span>
      <span>{message}</span>
      {action}
    </div>
  );
}
