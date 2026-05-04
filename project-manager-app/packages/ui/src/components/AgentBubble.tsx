"use client";

import { cn } from "../lib/cn";

export interface AgentBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  agentName?: string;
  agentColor?: string;
  agentEmoji?: string;
  /** Preview text shown as tooltip when panel is closed */
  lastMessagePreview?: string;
  /** Whether the agent is currently generating a response */
  thinking?: boolean;
  className?: string;
}

/**
 * Floating launcher button for the SEMSE agent chat panel.
 * Sits fixed bottom-right; use alongside AgentChatPanel.
 * Pure CSS transitions — no framer-motion dependency.
 */
export function AgentBubble({
  isOpen,
  onToggle,
  agentName = "Agente",
  agentColor = "#3b82f6",
  agentEmoji = "✦",
  lastMessagePreview,
  thinking = false,
  className,
}: AgentBubbleProps) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3",
        className
      )}
    >
      {/* Last-message preview tooltip */}
      {!isOpen && lastMessagePreview && (
        <div
          className={cn(
            "max-w-[200px] rounded-2xl border border-white/10 bg-[#1a1d24] p-3 shadow-2xl",
            "translate-x-0 opacity-100 transition-all duration-200",
            "relative mb-1"
          )}
          role="status"
          aria-live="polite"
        >
          <p className="line-clamp-2 text-[11px] leading-relaxed text-white/80">
            {lastMessagePreview}
          </p>
          {/* Tail */}
          <span
            className="absolute -bottom-1.5 right-5 h-3 w-3 rotate-45 border-b border-r border-white/10 bg-[#1a1d24]"
            aria-hidden
          />
        </div>
      )}

      <div className="relative group">
        {/* Hover label */}
        <span
          className={cn(
            "pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2",
            "whitespace-nowrap rounded-xl border border-white/10 bg-[#1a1d24] px-3 py-1.5",
            "text-xs font-semibold text-white shadow-xl",
            "opacity-0 translate-x-2 transition-all duration-150",
            "group-hover:opacity-100 group-hover:translate-x-0"
          )}
          aria-hidden
        >
          {isOpen ? "Cerrar agente" : `Hablar con ${agentName}`}
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Cerrar panel del agente" : `Abrir chat con ${agentName}`}
          aria-expanded={isOpen}
          className={cn(
            "relative h-14 w-14 rounded-2xl",
            "flex items-center justify-center",
            "shadow-xl transition-all duration-200",
            "hover:scale-105 active:scale-95 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-white/30",
            isOpen
              ? "bg-[#1a1d24] border border-white/10"
              : "border-0"
          )}
          style={
            isOpen
              ? undefined
              : {
                  background: `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)`,
                  boxShadow: `0 8px 32px ${agentColor}40`,
                }
          }
        >
          {/* Icon: sparkles when closed, X when open */}
          <span
            className={cn(
              "text-xl leading-none transition-all duration-200",
              isOpen ? "rotate-90 opacity-70" : "rotate-0 opacity-100"
            )}
            aria-hidden
          >
            {isOpen ? "✕" : agentEmoji}
          </span>

          {/* Thinking ping */}
          {thinking && (
            <span
              className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-[#0a0a14] bg-[#ff6a00] animate-ping"
              aria-hidden
            />
          )}

          {/* Online dot */}
          <span
            className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-[#0a0a14] bg-emerald-500"
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}
