// Helpers de UI para la cola offline de Agro. Equivalentes a
// apps/web/app/(app)/worker/tracker/sections/trackerUi.tsx (isLikelyConnectionError,
// shouldPreserveLocalEvent, PendingSyncBadge) pero sin acoplar el arbol de Agro
// al de worker/tracker: son dos areas de producto distintas que no deben
// depender una de la otra solo por compartir un patron.

/** ¿Es plausible que este fallo sea de conectividad, no un rechazo real del servidor? */
export function isLikelyConnectionError(caught: unknown): boolean {
  return (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    (caught instanceof TypeError && caught.message.toLowerCase().includes("fetch"))
  );
}

/**
 * ¿Debe este fallo encolar el evento localmente en vez de mostrar un error
 * duro? Conectividad, o un 5xx del servidor (transitorio) — nunca un 4xx
 * (rechazo real: farm inexistente, accion no soportada) que reintentar no
 * arreglaria.
 */
export function shouldPreserveAgroLocalEvent(caught: unknown): boolean {
  if (isLikelyConnectionError(caught)) return true;
  if (caught instanceof AgroSyncHttpError) return caught.status >= 500;
  return false;
}

export class AgroSyncHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}
