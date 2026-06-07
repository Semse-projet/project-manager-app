import type { Milestone, RiskLevel } from "./types.js";

const MILESTONE_SPLITS: Record<RiskLevel, number[]> = {
  low:      [30, 70],
  medium:   [25, 50, 25],
  high:     [20, 30, 30, 20],
  critical: [15, 25, 30, 20, 10],
};

const DEFAULT_TRIGGERS: string[] = [
  "Inicio documentado con fotos",
  "Avance aprobado por cliente",
  "Inspección completada",
  "Entrega final aprobada",
  "Garantía activada",
];

export function buildMilestones(
  totalAmount: number,
  riskLevel: RiskLevel,
  tradePhases: string[],
  evidencePerPhase: string[][]
): Milestone[] {
  const splits = MILESTONE_SPLITS[riskLevel];
  const phases = tradePhases.length >= splits.length
    ? tradePhases.slice(0, splits.length)
    : [...tradePhases, ...DEFAULT_TRIGGERS.slice(tradePhases.length, splits.length)];

  return splits.map((pct, i) => ({
    sequence: i + 1,
    title: phases[i] ?? `Fase ${i + 1}`,
    description: `${pct}% del total — ${phases[i] ?? `Etapa ${i + 1}`}`,
    percentage: pct,
    amount: Math.round(totalAmount * pct / 100 * 100) / 100,
    evidenceRequired: evidencePerPhase[i] ?? ["Foto de avance", "Aprobación del cliente"],
    releaseTrigger: `Cliente aprueba evidencia de fase ${i + 1}`,
  }));
}
