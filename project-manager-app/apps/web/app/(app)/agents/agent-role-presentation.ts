/**
 * Pure derivation logic for the "Especializados" tab of the Agents Catalog
 * (agents/page.tsx). Split out from the page component so it can be
 * exercised by a plain node --test file without a React/JSX test harness —
 * this repo has no existing component-test convention (no jsdom/RTL setup),
 * and inventing one for a single page would be disproportionate. This file
 * carries none of the actual reachability/maturity truth — it only shapes
 * whatever the Capability Registry (ADR-032/037) already returned.
 */
import type { CapabilityRecord } from "@semse/schemas";
import type { CapabilityReachability } from "@semse/schemas";

export type AgentRolePresentation = { name: string; emoji: string; color: string; desc: string };

export const AGENT_ROLE_PRESENTATION: Record<string, AgentRolePresentation> = {
  pricing:           { name: "Pricing Engine",   emoji: "💰", color: "var(--warn)",  desc: "Estimación inteligente de precios por categoría" },
  "job-planner":     { name: "Job Planner",       emoji: "📋", color: "var(--info)",  desc: "Generación automática de milestones y cronogramas" },
  "trust-match":     { name: "Trust Match",       emoji: "🤝", color: "var(--ok)",    desc: "Matching de clientes y profesionales por confianza" },
  "evidence-coach":  { name: "Evidence Coach BE", emoji: "🔬", color: "#14b8a6",      desc: "Validación y clasificación de evidencia fotográfica" },
  risk:              { name: "Risk Analyzer",     emoji: "⚠",  color: "var(--error)", desc: "Evaluación de riesgo en contratos y transacciones" },
  dispute:           { name: "Dispute Resolver",  emoji: "⚖",  color: "var(--violet)",desc: "Análisis y sugerencias para resolución de disputas" },
  orchestrator:      { name: "Orchestrator",      emoji: "◈",  color: "var(--brand)", desc: "Coordinación de flujos multi-agente del backend" },
  ecv:               { name: "ECV Agent",         emoji: "✓",  color: "#22c55e",      desc: "Verificación electrónica de credenciales" },
  "browser-agent":   { name: "Browser Agent",     emoji: "🌐", color: "var(--info)",  desc: "Automatización y verificación en navegador" },
  forge:             { name: "Forge",             emoji: "🔨", color: "var(--brand)", desc: "Generación/modificación de código gobernada, con verificación y rollback" },
  "field-ops":       { name: "Field Ops",         emoji: "🛠",  color: "var(--muted)", desc: "Ruta legacy de campo" },
  "project-copilot": { name: "Project Copilot",   emoji: "🧭", color: "var(--info)",  desc: "Asistente de proyecto" },
  "technical-agent": { name: "Technical Agent",   emoji: "🧩", color: "var(--violet)",desc: "Valida documentación técnica, alcance y cumplimiento de manual" },
  "legal-agent":     { name: "Legal Agent",       emoji: "📄", color: "#6366f1",      desc: "Valida contratos, riesgos legales y exposición a disputas" },
  "financial-agent": { name: "Financial Agent",   emoji: "💵", color: "var(--warn)",  desc: "Monitorea escrow, pagos por hito y salud financiera" },
  "qa-agent":        { name: "QA Agent",          emoji: "✅", color: "#14b8a6",      desc: "Evalúa calidad de evidencia y disposición de hitos" },
};

export function presentationForRole(role: string): AgentRolePresentation {
  return AGENT_ROLE_PRESENTATION[role] ?? { name: role, emoji: "◇", color: "var(--muted)", desc: "" };
}

// Exhaustive over CapabilityReachability's real values, plus one explicit
// fallback for null/unrecognized — a role can never silently read as
// available just because its reachability value wasn't handled.
export const REACHABILITY_PRESENTATION: Record<CapabilityReachability, { label: string; dot: string }> = {
  PRODUCTION_REACHABLE:  { label: "Disponible en producción",        dot: "var(--ok)" },
  INTEGRATION_ONLY:      { label: "Integrado, sin tráfico real",     dot: "var(--warn)" },
  DESIGNED_BUT_UNWIRED:  { label: "Diseñado, no conectado",          dot: "var(--muted)" },
  DEPRECATED:            { label: "En retiro",                      dot: "var(--error)" },
};
export const UNKNOWN_REACHABILITY_PRESENTATION = { label: "Estado no verificado", dot: "var(--faint)" };

export function reachabilityPresentation(reachability: CapabilityReachability | null) {
  if (!reachability) return UNKNOWN_REACHABILITY_PRESENTATION;
  return REACHABILITY_PRESENTATION[reachability] ?? UNKNOWN_REACHABILITY_PRESENTATION;
}

export const AGENT_ROLE_KEY_PREFIX = "agent-role:";

export type SpecializedAgent = AgentRolePresentation & {
  id: string;
  maturity: CapabilityRecord["maturity"];
  reachability: CapabilityReachability | null;
};

/**
 * The ENTIRE role roster shown in the UI is derived from whatever
 * agent-role:* capabilities the registry response contains — nothing here
 * enumerates "the 16 real roles" locally. A role missing from the response
 * simply does not appear (never fabricated), and a role present with a
 * null `reachability` renders through `reachabilityPresentation`'s UNKNOWN
 * branch, never a default "available" state.
 */
export function deriveSpecializedAgents(capabilities: CapabilityRecord[]): SpecializedAgent[] {
  return capabilities
    .filter((c) => c.key.startsWith(AGENT_ROLE_KEY_PREFIX))
    .map((c): SpecializedAgent => {
      const role = c.key.slice(AGENT_ROLE_KEY_PREFIX.length);
      return { id: role, maturity: c.maturity, reachability: c.reachability, ...presentationForRole(role) };
    });
}
