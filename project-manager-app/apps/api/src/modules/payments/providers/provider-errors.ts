/**
 * Errores de payout con clasificacion EXPLICITA para el comando de release
 * (ADR-041 slice 2). Un proveedor que sabe que la peticion NO se ejecuto
 * (validacion previa, 4xx) lanza `definitive`; ante red/timeout/5xx lanza
 * `ambiguous`. Un Error sin senal se trata como AMBIGUO (seguro para el dinero).
 */
export type PayoutFailureKind = "definitive" | "ambiguous";

export class PayoutFailureError extends Error {
  constructor(
    message: string,
    public readonly payoutFailure: PayoutFailureKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PayoutFailureError";
  }
}

/** 4xx = la peticion fue rechazada (definitivo), salvo 408/409 que pueden haberse ejecutado. */
export function classifyHttpStatus(status: number): PayoutFailureKind {
  if (status >= 400 && status < 500 && status !== 408 && status !== 409) return "definitive";
  return "ambiguous";
}

export function payoutErrorFromHttp(message: string, status: number): PayoutFailureError {
  return new PayoutFailureError(message, classifyHttpStatus(status), status);
}
