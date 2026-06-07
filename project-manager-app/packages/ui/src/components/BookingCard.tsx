"use client";

import { cn } from "../lib/cn";

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Booking {
  id: string;
  service: string;
  professionalId: string;
  professionalName?: string;
  professionalAvatar?: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  location: string;
  price: number;
  currency?: string;
  status: BookingStatus;
  notes?: string;
}

export interface BookingCardProps {
  booking: Booking;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onJoinCall?: (id: string) => void;
  className?: string;
}

const statusConfig: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pendiente",   color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  confirmed: { label: "Confirmado",  color: "text-brand",       bg: "bg-brand/10 border-brand/20" },
  completed: { label: "Completado",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  cancelled: { label: "Cancelado",   color: "text-muted",       bg: "bg-white/[0.04] border-white/[0.08]" },
};

function formatBookingDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

function formatPrice(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Card for displaying a booking/appointment in SEMSE.
 * Supports confirm, cancel and join-video-call actions.
 */
export function BookingCard({
  booking,
  onConfirm,
  onCancel,
  onJoinCall,
  className,
}: BookingCardProps) {
  const cfg = statusConfig[booking.status] ?? statusConfig.pending;
  const isVideo =
    booking.location.toLowerCase().includes("video") ||
    booking.location.toLowerCase().includes("llamada") ||
    booking.location.toLowerCase().includes("zoom") ||
    booking.location.toLowerCase().includes("meet");

  const canConfirm  = booking.status === "pending"   && !!onConfirm;
  const canCancel   = (booking.status === "pending" || booking.status === "confirmed") && !!onCancel;
  const canJoin     = booking.status === "confirmed" && isVideo && !!onJoinCall;

  const displayName = booking.professionalName ?? `Profesional #${booking.professionalId}`;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-[#0d1220] p-5 space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {booking.professionalAvatar ? (
            <img
              src={booking.professionalAvatar}
              alt={displayName}
              className="h-12 w-12 rounded-xl object-cover border border-white/10"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-sm font-bold text-white">
              {getInitials(displayName)}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm text-white">{booking.service}</p>
            <p className="text-xs text-muted">{displayName}</p>
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold",
            cfg.bg,
            cfg.color
          )}
        >
          {cfg.label}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[#ff6a00]">📅</span>
          <span>{formatBookingDate(booking.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[#ff6a00]">🕐</span>
          <span>{booking.startTime} — {booking.endTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[#ff6a00]">{isVideo ? "📹" : "📍"}</span>
          <span>{booking.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[#ff6a00]">💳</span>
          <span className="font-semibold text-white">
            {formatPrice(booking.price, booking.currency)}
          </span>
        </div>
      </div>

      {/* Notes */}
      {booking.notes && (
        <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2">
          <p className="text-xs text-muted italic">{booking.notes}</p>
        </div>
      )}

      {/* Actions */}
      {(canJoin || canConfirm || canCancel) && (
        <div className="flex gap-2 pt-1">
          {canJoin && (
            <button
              type="button"
              onClick={() => onJoinCall!(booking.id)}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              📹 Unirse a la llamada
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              onClick={() => onConfirm!(booking.id)}
              className="flex-1 rounded-lg bg-gradient-to-r from-[#ff6a00] to-[#ff8c00] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              ✓ Confirmar
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => onCancel!(booking.id)}
              className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
            >
              ✕ Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
