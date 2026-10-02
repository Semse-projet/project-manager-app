import { classifyHttpStatus, type PayoutFailureKind } from "./providers/provider-errors.js";
import type { ProviderTransferResult } from "./escrow-release.command.js";

/**
 * ADR-041 slice 2 — normaliza lo que devuelve/lanza un proveedor al resultado
 * del puerto del comando. El comando NO conoce excepciones de Nest ni de
 * ningun SDK: solo ve paid | processing | definitive_failure | ambiguous_failure.
 */
export function normalizePayoutIntent(intent: { status: string; providerRef?: string }): ProviderTransferResult {
  if (intent.status === "paid") return { kind: "paid", providerRef: intent.providerRef };
  if (intent.status === "failed" || intent.status === "cancelled") {
    return {
      kind: "definitive_failure",
      message: `provider reported payout ${intent.status}`,
      providerRef: intent.providerRef,
    };
  }
  return { kind: "processing", providerRef: intent.providerRef };
}

function statusOf(error: unknown): number | undefined {
  const e = error as { status?: unknown; statusCode?: unknown; getStatus?: unknown } | null;
  if (!e || typeof e !== "object") return undefined;
  if (typeof e.statusCode === "number") return e.statusCode; // SDKs (p. ej. Stripe)
  if (typeof e.status === "number") return e.status;
  if (typeof e.getStatus === "function") {
    const s = (e.getStatus as () => unknown).call(e);
    return typeof s === "number" ? s : undefined; // HttpException, sin importarla
  }
  return undefined;
}

export function classifyProviderError(error: unknown): PayoutFailureKind {
  const explicit = (error as { payoutFailure?: unknown } | null)?.payoutFailure;
  if (explicit === "definitive" || explicit === "ambiguous") return explicit;
  const status = statusOf(error);
  if (status !== undefined) return classifyHttpStatus(status);
  return "ambiguous"; // sin senal: asumir que el dinero pudo moverse
}

export function normalizeProviderError(error: unknown): ProviderTransferResult {
  const message = error instanceof Error ? error.message : String(error);
  return classifyProviderError(error) === "definitive"
    ? { kind: "definitive_failure", message, cause: error }
    : { kind: "ambiguous_failure", message, cause: error };
}
