import { BadRequestException, ConflictException } from "@nestjs/common";

/**
 * ADR-041 slice 2 — nucleo del comando unico de release (C27/C28/C29).
 *
 * Orquesta SOLO reservar -> transferir -> finalizar, sobre puertos, para que el
 * camino manual/agente y el auto-release compartan idempotencia y manejo de
 * resultado ambiguo. La autorizacion economica (ReleaseGovernanceGate /
 * evaluate()) y las comprobaciones de contrato/estado siguen en el llamador.
 *
 * Identidad de idempotencia (ADR-041: `(milestoneId, amount, source-independent)`):
 *   base = pending_release_{milestoneId}_{amountCents}   (NUNCA incluye `source`)
 *  - con `idempotencyKey` explicita del cliente:  {base}_k_{key}
 *      misma clave => mismo resultado SIEMPRE, tambien tras un FAILED definitivo
 *      (la reserva FAILED conserva su referencia; reintentar de verdad exige otra clave).
 *  - sin clave: {base}_a{n}, n = intentos FAILED previos con esa base, de modo que un
 *      reintento legitimo tras un rechazo definitivo es un intento nuevo, y repetir
 *      el MISMO intento (en vuelo o ya registrado) devuelve el resultado del primero.
 *  Ademas el repositorio impide un 2.º RELEASE activo (PENDING/SUCCEEDED) por milestone,
 *  y un importe distinto sobre un release activo es un conflicto, no un replay.
 *
 * Estados: released | pending | failed | unknown.
 *  - fallo AMBIGUO (red/timeout/5xx/sin senal) => reserva PENDING + `unknown`
 *    (el dinero pudo moverse), nunca FAILED.
 *  - transferencia OK + fallo al registrar => `unknown` + `transferConfirmed`.
 *
 * Limite conocido (requiere la columna de idempotencia de la migracion del slice 3):
 * si una reserva `processing` cambia su providerRef por el real y luego un webhook la
 * marca FAILED, la referencia de idempotencia ya no se puede buscar; esa clave deja de
 * ser reconocible y se trata como intento nuevo.
 */
export type ReleaseCommandStatus = "released" | "pending" | "failed" | "unknown";

/** Resultado NORMALIZADO del proveedor: el comando no conoce excepciones de Nest ni SDKs. */
export type ProviderTransferResult =
  | { kind: "paid"; providerRef?: string }
  | { kind: "processing"; providerRef?: string }
  | { kind: "definitive_failure"; message: string; providerRef?: string; cause?: unknown }
  | { kind: "ambiguous_failure"; message: string; cause?: unknown };

export type ReleaseTxnView = { id: string; status: string; providerRef: string; amount?: number };

export interface ReleaseCommandPorts {
  reserve(input: { escrowId: string; milestoneId: string; amount: number; providerRef: string }): Promise<{ id: string }>;
  finalize(input: {
    transactionId: string;
    milestoneId: string;
    status?: "SUCCEEDED" | "FAILED";
    providerRef?: string;
  }): Promise<{ id: string }>;
  /** RELEASE activo (PENDING/SUCCEEDED) del milestone, si existe. */
  findActiveRelease(milestoneId: string): Promise<ReleaseTxnView | null>;
  /** RELEASE (cualquier estado) cuya providerRef es exactamente `ref`. */
  findReleaseByRef(ref: string): Promise<ReleaseTxnView | null>;
  /** Cuantos RELEASE FAILED conservan una referencia que empieza por `refPrefix`. */
  countFailedAttempts(refPrefix: string): Promise<number>;
  /** Llama al proveedor con la referencia de reserva. NO debe lanzar: normaliza. */
  transfer(reservationRef: string): Promise<ProviderTransferResult>;
  onCritical?(message: string, ctx: Record<string, unknown>): void;
}

export type ReleaseCommandInput = {
  escrowId: string;
  milestoneId: string;
  amount: number;
  /** Clave del cliente (cabecera Idempotency-Key). Opcional; ver identidad arriba. */
  idempotencyKey?: string;
};

export type ReleaseCommandResult = {
  status: ReleaseCommandStatus;
  transactionId?: string;
  providerRef?: string;
  /** true si es la repeticion de una liberacion ya registrada. */
  replay: boolean;
  /** true solo si el proveedor confirmo la transferencia pero no pudimos registrarla. */
  transferConfirmed?: boolean;
  error?: string;
  /** Error original del proveedor en un rechazo definitivo (para relanzarlo con su semantica HTTP). */
  cause?: unknown;
};

/** 409: el milestone ya tiene un release activo (PENDING/SUCCEEDED). */
export class ReleaseAlreadyActiveError extends ConflictException {
  constructor(public readonly milestoneId: string) {
    super(`milestone '${milestoneId}' already has an active release`);
  }
}

/** 409: misma identidad (milestone) reutilizada con otro importe. */
export class ReleaseIdempotencyConflictError extends ConflictException {
  constructor(milestoneId: string) {
    super(`milestone '${milestoneId}' already has an active release with a different amount`);
  }
}

/** PAYMENTS_RELEASE_COMMAND=on activa el comando en los llamadores; apagado = camino anterior. */
export function isReleaseCommandEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PAYMENTS_RELEASE_COMMAND?.trim().toLowerCase() === "on";
}

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function assertValidIdempotencyKey(key: string): void {
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new BadRequestException("Idempotency-Key must be 1-128 chars of [A-Za-z0-9._:-]");
  }
}

export function toAmountCents(amount: number): number {
  return Math.round(amount * 100);
}

export function releaseRefBase(milestoneId: string, amount: number): string {
  return `pending_release_${milestoneId}_${toAmountCents(amount)}`;
}

function replayResult(existing: ReleaseTxnView): ReleaseCommandResult {
  const status: ReleaseCommandStatus =
    existing.status === "SUCCEEDED" ? "released" : existing.status === "FAILED" ? "failed" : "pending";
  return { status, transactionId: existing.id, providerRef: existing.providerRef, replay: true };
}

function isUniqueOrSerializationConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "P2002" || code === "P2034";
}

export async function runEscrowRelease(
  ports: ReleaseCommandPorts,
  input: ReleaseCommandInput,
): Promise<ReleaseCommandResult> {
  if (input.idempotencyKey !== undefined) assertValidIdempotencyKey(input.idempotencyKey);
  const cents = toAmountCents(input.amount);

  const replayActive = async (): Promise<ReleaseCommandResult | null> => {
    const active = await ports.findActiveRelease(input.milestoneId);
    if (!active) return null;
    if (active.amount !== undefined && toAmountCents(active.amount) !== cents) {
      throw new ReleaseIdempotencyConflictError(input.milestoneId);
    }
    return replayResult(active);
  };

  const active = await replayActive();
  if (active) return active;

  const base = releaseRefBase(input.milestoneId, input.amount);
  let reservationRef: string;
  if (input.idempotencyKey !== undefined) {
    reservationRef = `${base}_k_${input.idempotencyKey}`;
    const existing = await ports.findReleaseByRef(reservationRef);
    if (existing) return replayResult(existing); // incluye FAILED definitivo: sin 2.ª transferencia
  } else {
    const failedBefore = await ports.countFailedAttempts(`${base}_a`);
    reservationRef = `${base}_a${failedBefore}`;
  }

  let reservation: { id: string };
  try {
    reservation = await ports.reserve({
      escrowId: input.escrowId,
      milestoneId: input.milestoneId,
      amount: input.amount,
      providerRef: reservationRef,
    });
  } catch (error) {
    if (error instanceof ReleaseAlreadyActiveError || isUniqueOrSerializationConflict(error)) {
      const raced = await replayActive();
      if (raced) return raced;
      const sameRef = await ports.findReleaseByRef(reservationRef);
      if (sameRef) return replayResult(sameRef);
    }
    throw error;
  }

  let outcome: ProviderTransferResult;
  try {
    outcome = await ports.transfer(reservationRef);
  } catch (error) {
    // El puerto no debe lanzar; si lo hace no sabemos si el dinero se movio.
    outcome = {
      kind: "ambiguous_failure",
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    };
  }

  if (outcome.kind === "ambiguous_failure") {
    ports.onCritical?.(
      "provider outcome unknown; reservation kept PENDING for reconciliation",
      { milestoneId: input.milestoneId, transactionId: reservation.id, reservationRef, error: outcome.message },
    );
    return {
      status: "unknown",
      transactionId: reservation.id,
      providerRef: reservationRef,
      replay: false,
      error: outcome.message,
      cause: outcome.cause,
    };
  }

  if (outcome.kind === "definitive_failure") {
    // La reserva FAILED CONSERVA su referencia (no se cambia por la del proveedor):
    // asi repetir la misma clave la reconoce y no vuelve a transferir.
    await ports.finalize({ transactionId: reservation.id, milestoneId: input.milestoneId, status: "FAILED" });
    return {
      status: "failed",
      transactionId: reservation.id,
      providerRef: reservationRef,
      replay: false,
      error: outcome.message,
      cause: outcome.cause,
    };
  }

  const finalStatus = outcome.kind === "paid" ? ("SUCCEEDED" as const) : undefined; // processing: PENDING hasta el webhook
  try {
    const txn = await ports.finalize({
      transactionId: reservation.id,
      milestoneId: input.milestoneId,
      status: finalStatus,
      providerRef: outcome.providerRef,
    });
    return {
      status: finalStatus === "SUCCEEDED" ? "released" : "pending",
      transactionId: txn.id,
      providerRef: outcome.providerRef ?? reservationRef,
      replay: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ports.onCritical?.(
      "provider outcome known but recording it failed; manual reconciliation required",
      { milestoneId: input.milestoneId, transactionId: reservation.id, providerRef: outcome.providerRef, outcome: outcome.kind, error: message },
    );
    return {
      status: "unknown",
      transactionId: reservation.id,
      providerRef: outcome.providerRef ?? reservationRef,
      replay: false,
      transferConfirmed: outcome.kind === "paid",
      error: message,
    };
  }
}

/** Reconciliacion (solo informe): RELEASE PENDING antiguos que requieren revision. */
export function classifyStalePendingRelease(
  txn: { providerRef: string; createdAt: Date },
  now: Date,
  staleAfterMs: number,
): "fresh" | "stale_no_provider_ref" | "stale_awaiting_webhook" {
  if (now.getTime() - txn.createdAt.getTime() < staleAfterMs) return "fresh";
  return txn.providerRef.startsWith("pending_") ? "stale_no_provider_ref" : "stale_awaiting_webhook";
}
