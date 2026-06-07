// ─────────────────────────────────────────────────────────────────────────────
// @semse/shared — ui-helpers.ts
//
// UI utility functions extracted from labsemse/src/lib/utils.ts.
// Covers: status colors, urgency, ratings, initials, debounce/throttle,
// and calendar helpers. Framework-agnostic (no React dependency).
// ─────────────────────────────────────────────────────────────────────────────

// ── Status helpers ─────────────────────────────────────────────────────────────

/** Tailwind bg class for a job/booking/escrow status string. */
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    // job
    draft:       "bg-gray-500",
    posted:      "bg-blue-500",
    published:   "bg-blue-500",
    in_review:   "bg-yellow-500",
    reserved:    "bg-violet-500",
    assigned:    "bg-purple-500",
    accepted:    "bg-violet-500",
    in_progress: "bg-orange-500",
    review:      "bg-yellow-500",
    completed:   "bg-green-500",
    cancelled:   "bg-gray-500",
    disputed:    "bg-red-600",
    dispute:     "bg-red-600",
    // escrow
    pending:     "bg-yellow-500",
    funded:      "bg-green-500",
    held:        "bg-blue-500",
    partially_released: "bg-green-500",
    released:    "bg-green-600",
    refunded:    "bg-gray-500",
    // bookings
    confirmed:   "bg-blue-500",
  };
  return map[status.toLowerCase()] ?? "bg-gray-500";
}

/** Spanish display label for a job/booking/escrow status string. */
export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft:       "Borrador",
    posted:      "Publicado",
    published:   "Publicado",
    in_review:   "En revisión",
    reserved:    "Reservado",
    assigned:    "Asignado",
    accepted:    "Aceptado",
    in_progress: "En progreso",
    review:      "En revisión",
    completed:   "Completado",
    cancelled:   "Cancelado",
    disputed:    "En disputa",
    dispute:     "En disputa",
    pending:     "Pendiente",
    confirmed:   "Confirmado",
    funded:      "Fondos depositados",
    held:        "En custodia",
    partially_released: "Parcialmente liberado",
    released:    "Liberado",
    refunded:    "Reembolsado",
    low:         "Baja",
    medium:      "Media",
    high:        "Alta",
    urgent:      "Urgente",
  };
  return map[status.toLowerCase()] ?? status;
}

// ── Urgency helpers ────────────────────────────────────────────────────────────

/** Tailwind bg class for an urgency level. */
export function getUrgencyColor(urgency: string): string {
  const map: Record<string, string> = {
    low:    "bg-green-500",
    medium: "bg-yellow-500",
    high:   "bg-orange-500",
    urgent: "bg-red-500",
  };
  return map[urgency.toLowerCase()] ?? "bg-gray-500";
}

/** Spanish label for an urgency level. */
export function getUrgencyLabel(urgency: string): string {
  const map: Record<string, string> = {
    low:    "Baja urgencia",
    medium: "Urgencia media",
    high:   "Alta urgencia",
    urgent: "Urgente",
  };
  return map[urgency.toLowerCase()] ?? urgency;
}

// ── Ratings ────────────────────────────────────────────────────────────────────

export interface RatingStars {
  full:  number;
  half:  boolean;
  empty: number;
}

/** Break a 0–5 rating into full, half, and empty star counts. */
export function calculateRatingStars(rating: number): RatingStars {
  const clamped = Math.max(0, Math.min(5, rating));
  const full  = Math.floor(clamped);
  const half  = clamped % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return { full, half, empty };
}

// ── String helpers ─────────────────────────────────────────────────────────────

/** Return 1–2 uppercase initials from a display name. */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Relative time (Spanish) ────────────────────────────────────────────────────

/**
 * Human-readable Spanish relative time string.
 * "Hace 5 minutos", "Hace 2 horas", etc.
 */
export function formatRelativeTime(date: Date | string): string {
  const d   = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60)      return "Hace un momento";
  if (diffSec < 3600)    return `Hace ${Math.floor(diffSec / 60)} minuto${Math.floor(diffSec / 60) !== 1 ? "s" : ""}`;
  if (diffSec < 86400)   return `Hace ${Math.floor(diffSec / 3600)} hora${Math.floor(diffSec / 3600) !== 1 ? "s" : ""}`;
  if (diffSec < 604800)  return `Hace ${Math.floor(diffSec / 86400)} día${Math.floor(diffSec / 86400) !== 1 ? "s" : ""}`;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

// ── Calendar helpers ───────────────────────────────────────────────────────────

/** Return an array of Date objects for each day between start and end (inclusive). */
export function getDaysArray(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    result.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export interface MonthData {
  daysInMonth:     number;
  firstDayOfWeek:  number; // 0=Sunday, 1=Monday, …
}

/** Return total days and weekday of first day for a given year/month (0-indexed month). */
export function getMonthData(year: number, month: number): MonthData {
  return {
    daysInMonth:    new Date(year, month + 1, 0).getDate(),
    firstDayOfWeek: new Date(year, month, 1).getDay(),
  };
}

// ── Functional helpers ─────────────────────────────────────────────────────────

/** Debounce: delay fn execution until after `waitMs` ms since last call. */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

/** Throttle: allow fn to execute at most once per `limitMs` ms. */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let active = false;
  return (...args: Parameters<T>) => {
    if (!active) {
      fn(...args);
      active = true;
      setTimeout(() => { active = false; }, limitMs);
    }
  };
}
