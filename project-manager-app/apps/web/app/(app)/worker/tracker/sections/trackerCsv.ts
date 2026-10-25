/**
 * CSV export helpers for the Time Tracker's currently loaded view.
 *
 * CSV quoting alone does not stop spreadsheet applications from interpreting
 * untrusted notes/project names as formulas. Escape formula-like *text* as
 * literal strings without converting trusted numeric values into text.
 *
 * The CSV export remains a view export: these helpers do not claim completeness
 * or approval of a TimeEntry, and must never provide tenant access.
 */
const FORMULA_LIKE_TEXT = /^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]*[=+\-@]/u;

/** Quote every CSV cell, protecting user-controlled strings against formulas. */
export function safeTrackerCsvCell(value: unknown): string {
  const numeric = typeof value === "number" && Number.isFinite(value);
  const raw = String(value ?? "");
  // A leading tab/newline can be used to confuse some spreadsheet importers;
  // prepend a literal marker even if no formula operator follows immediately.
  const unsafe = !numeric && (FORMULA_LIKE_TEXT.test(raw) || /^[\t\r\n]/u.test(raw));
  const text = unsafe ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Origin of the CSV row, not worker approval or payroll status. */
export function trackerCsvSyncState(status: string): "pendiente_dispositivo" | "guardado_servidor" {
  return status === "pending_sync" ? "pendiente_dispositivo" : "guardado_servidor";
}
