import { ConflictException, HttpException } from "@nestjs/common";

/**
 * ADR-041 slice 2 — nucleo del comando unico de release (C27/C28/C29).
 *
 * Orquesta SOLO reservar -> transferir -> finalizar, sobre puertos, para que el
 * camino manual/agente y el auto-release compartan idempotencia y manejo de
 * resultado ambiguo. La autorizacion economica (ReleaseGovernanceGate /
 * evaluate()) y las comprobaciones de contrato/estado siguen en el llamador.
 *
 * Garantias:
 *  - Idempotencia durable: la referencia de reserva es DETERMINISTA por
 *    (milestone, idempotencyKey) y `PaymentTxn.providerRef` es UNIQUE; ademas
 *    el repositorio rechaza un 2.º RELEASE activo (PENDING/SUCCEEDED) del mismo
 *    milestone. Una llamada repetida devuelve el resultado de la primera.
 *  - Estados explicitos: released | pending | failed | unknown. Un fallo
 *    AMBIGUO del proveedor (timeout/red/5xx) NO libera la reserva: queda
 *    PENDING y se informa `unknown` para reconciliar, porque el dinero pudo
 *    moverse. Solo un rechazo definitivo (4xx) marca FAILED.
 *  - Transferencia OK + fallo al finalizar => `unknown` con
 *    `transferConfirmed:true` (nunca `released:false`, nunca silencio).
 */
export type ReleaseCommandStatus = "released" | "pending" | "failed" | "unknown";

export type ReleaseTransferOutcome = {
  status: "paid" | "processing" | "failed";
  providerRef?: string;
};

export type ReleaseTxnView = { id: string; status: string; providerRef: string };

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
  /** Llama al proveedor con la referencia de reserva como externalRef. */
  transfer(reservationRef: string): Promise<ReleaseTransferOutcome>;
  onCritical?(message: string, ctx: Record<string, unknown>): void;
}

export type ReleaseCommandInput = {
  escrowId: string;
  milestoneId: string;
  amount: number;
  idempotencyKey: string;
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
};

/** 409: el milestone ya tiene un release activo (PENDING/SUCCEEDED). */
export class ReleaseAlreadyActiveError extends ConflictException {
  constructor(public readonly milestoneId: string) {
    super(`milestone '${milestoneId}' already has an active release`);
  }
}

/** PAYMENTS_RELEASE_COMMAND=on activa el comando en los llamadores; apagado = camino anterior. */
export function isReleaseCommandEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PAYMENTS_RELEASE_COMMAND?.trim().toLowerCase() === "on";
}

export function releaseReservationRef(milestoneId: string, idempotencyKey: string): string {
  return `pending_release_${milestoneId}_${idempotencyKey}`;
}

/** Rechazo definitivo del proveedor: la peticion NO se ejecuto. */
export function isDefinitiveProviderFailure(error: unknown): boolean {
  if ((error as { definitive?: boolean } | null)?.definitive === true) return true;
  if (error instanceof HttpException) {
    const status = error.getStatus();
    return status >= 400 && status < 500 && status !== 408;
  }
  return false;
}

function replayResult(existing: ReleaseTxnView): ReleaseCommandResult {
  return {
    status: existing.status === "SUCCEEDED" ? "released" : "pending",
    transactionId: existing.id,
    providerRef: existing.providerRef,
    replay: true,
  };
}

export async function runEscrowRelease(
  ports: ReleaseCommandPorts,
  input: ReleaseCommandInput,
): Promise<ReleaseCommandResult> {
  const existing = await ports.findActiveRelease(input.milestoneId);
  if (existing) return replayResult(existing);

  const reservationRef = releaseReservationRef(input.milestoneId, input.idempotencyKey);
  let reservation: { id: string };
  try {
    reservation = await ports.reserve({
      escrowId: input.escrowId,
      milestoneId: input.milestoneId,
      amount: input.amount,
      providerRef: reservationRef,
    });
  } catch (error) {
    if (error instanceof ReleaseAlreadyActiveError) {
      const raced = await ports.findActiveRelease(input.milestoneId);
      if (raced) return replayResult(raced);
    }
    throw error;
  }

  let outcome: ReleaseTransferOutcome;
  try {
    outcome = await ports.transfer(reservationRef);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isDefinitiveProviderFailure(error)) {
      await ports.finalize({ transactionId: reservation.id, milestoneId: input.milestoneId, status: "FAILED" });
      return { status: "failed", transactionId: reservation.id, replay: false, error: message };
    }
    // Ambiguo: el dinero pudo moverse. Dejar la reserva PENDING.
    ports.onCritical?.(
      "provider outcome unknown after error; reservation kept PENDING for reconciliation",
      { milestoneId: input.milestoneId, transactionId: reservation.id, reservationRef, error: message },
    );
    return { status: "unknown", transactionId: reservation.id, providerRef: reservationRef, replay: false, error: message };
  }

  const finalStatus =
    outcome.status === "paid" ? ("SUCCEEDED" as const)
    : outcome.status === "failed" ? ("FAILED" as const)
    : undefined; // processing: sigue PENDING hasta el webhook

  try {
    const txn = await ports.finalize({
      transactionId: reservation.id,
      milestoneId: input.milestoneId,
      status: finalStatus,
      providerRef: outcome.providerRef,
    });
    return {
      status: finalStatus === "SUCCEEDED" ? "released" : finalStatus === "FAILED" ? "failed" : "pending",
      transactionId: txn.id,
      providerRef: outcome.providerRef ?? reservationRef,
      replay: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ports.onCritical?.(
      "provider outcome known but recording it failed; manual reconciliation required",
      { milestoneId: input.milestoneId, transactionId: reservation.id, providerRef: outcome.providerRef, outcome: outcome.status, error: message },
    );
    return {
      status: "unknown",
      transactionId: reservation.id,
      providerRef: outcome.providerRef ?? reservationRef,
      replay: false,
      transferConfirmed: outcome.status === "paid",
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
