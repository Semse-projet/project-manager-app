import type { EvidenceChecklist, EvidenceItem, Milestone, RiskResult, TradeId } from "./types.js";

export function buildEvidenceChecklist(
  trade: TradeId,
  risk: RiskResult,
  milestones: Milestone[],
  extraItems: EvidenceItem[] = []
): EvidenceChecklist {
  const baseItems: EvidenceItem[] = [
    { type: "photo", description: "Estado inicial del sitio", required: true, milestone: 1 },
    { type: "photo", description: "Avance documentado", required: true, milestone: Math.max(1, Math.min(2, milestones.length)) },
    { type: "inspection", description: "Revisión final y cierre", required: risk.requiresInspection, milestone: milestones.length },
  ];

  return {
    trade,
    riskLevel: risk.level,
    requiredCount: [...baseItems, ...extraItems].filter((item) => item.required).length,
    items: [...baseItems, ...extraItems],
    notes: [
      risk.requiresPermit ? "Permiso requerido antes de iniciar." : "Permiso no requerido por umbral base.",
      risk.requiresLicense ? "Verificar licencia del contratista." : "Licencia no marcada como obligatoria por el motor.",
    ],
  };
}
