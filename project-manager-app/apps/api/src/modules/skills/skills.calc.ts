import { createHash } from "node:crypto";

/**
 * BO-12 — resumen de experiencia confirmada. Spec: docs/specs/core/skills.spec.md
 *
 * Solo hechos: cuántas tareas confirmó un responsable por oficio y en qué meses.
 * NO hay niveles ni insignias: el plan prohíbe fijar umbrales numéricos sin
 * investigación de oficio y aprobación de producto, y un conteo no es competencia.
 * El resumen portable no lleva empresas, clientes, títulos de tarea ni fotos.
 */
export const SKILLS_DISCLAIMER =
  "Experiencia confirmada en SEMSE por un responsable. No es una licencia, certificación ni autorización para trabajos regulados.";

export type ExperienceFact = { trade: string; decidedAt: Date };

export type TradeSummary = {
  trade: string;
  confirmedCount: number;
  evidenceLevel: "supervisor_reviewed";
  since: string;
  until: string;
};

export type SkillSummary = {
  generatedAt: string;
  disclaimer: string;
  trades: TradeSummary[];
};

export function normalizeTrade(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function month(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Agrupa por oficio con granularidad de mes. `only` filtra a los oficios que la persona decidió compartir. */
export function summarizeExperience(facts: ExperienceFact[], now: Date, only?: string[]): SkillSummary {
  const allowed = only ? new Set(only.map(normalizeTrade)) : null;
  const byTrade = new Map<string, Date[]>();
  for (const fact of facts) {
    const trade = normalizeTrade(fact.trade);
    if (allowed && !allowed.has(trade)) continue;
    const list = byTrade.get(trade) ?? [];
    list.push(fact.decidedAt);
    byTrade.set(trade, list);
  }
  const trades: TradeSummary[] = [...byTrade.entries()]
    .map(([trade, dates]) => {
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      return {
        trade,
        confirmedCount: sorted.length,
        evidenceLevel: "supervisor_reviewed" as const,
        since: month(sorted[0]),
        until: month(sorted[sorted.length - 1])
      };
    })
    .sort((a, b) => (a.trade < b.trade ? -1 : a.trade > b.trade ? 1 : 0));
  return { generatedAt: now.toISOString(), disclaimer: SKILLS_DISCLAIMER, trades };
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function hashSummary(summary: unknown): string {
  return createHash("sha256").update(stableStringify(summary)).digest("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
