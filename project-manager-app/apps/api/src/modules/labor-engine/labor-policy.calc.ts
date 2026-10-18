/**
 * BO-08 — cálculo puro de tiempo. Spec: docs/specs/core/labor-policy.spec.md
 *
 * Hora real trabajada, tiempo pagable y overtime son categorías separadas.
 * - Real = tiempo transcurrido menos el descanso efectivamente registrado.
 * - Un descanso no tomado no se descuenta (no se inventa una deducción).
 * - El overtime solo se *propone*: requiere aprobación; nunca se paga solo.
 * - Sin nómina: esto no calcula dinero.
 */
export type LaborEntryTimes = { startedAt: Date; endedAt: Date | null; breakMinutes: number };
export type LaborPolicyLike = { overtimeAfterMinutesPerDay: number | null } | null;

export type LaborTimeResult =
  | { open: true; workedMinutes: null; payableMinutes: null; overtimeCandidateMinutes: 0; overtimeNeedsApproval: false }
  | {
      open: false;
      workedMinutes: number;
      payableMinutes: number;
      overtimeCandidateMinutes: number;
      overtimeNeedsApproval: boolean;
    };

export function elapsedMinutes(startedAt: Date, endedAt: Date): number {
  return Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000);
}

export function computeLaborTime(entry: LaborEntryTimes, policy: LaborPolicyLike): LaborTimeResult {
  if (!entry.endedAt) {
    return { open: true, workedMinutes: null, payableMinutes: null, overtimeCandidateMinutes: 0, overtimeNeedsApproval: false };
  }
  const elapsed = elapsedMinutes(entry.startedAt, entry.endedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new RangeError("endedAt must not be before startedAt");
  }
  const breakMinutes = Math.min(Math.max(0, Math.trunc(entry.breakMinutes)), elapsed);
  const workedMinutes = elapsed - breakMinutes;
  const threshold = policy?.overtimeAfterMinutesPerDay ?? null;
  const overtimeCandidateMinutes = threshold === null ? 0 : Math.max(0, workedMinutes - threshold);
  return {
    open: false,
    workedMinutes,
    payableMinutes: workedMinutes,
    overtimeCandidateMinutes,
    overtimeNeedsApproval: overtimeCandidateMinutes > 0
  };
}
