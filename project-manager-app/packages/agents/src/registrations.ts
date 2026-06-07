/**
 * Self-registering agent handlers — inspired by Hermes's tools/registry pattern.
 * Import this module once at startup to populate AgentRegistry.
 * Adding a new agent = add one AgentRegistry.register() call here.
 */
import { AgentRegistry } from "./registry.js";
import { executeSpecializedAgent, setDelegateImpl } from "./runtime.js";
import { delegateTo } from "./delegate.js";
import type { RuntimeAgentRole } from "./governance.js";

const SAFE_TOOLS = ["context.read.job", "context.read.trust", "memory.read.agent", "decision.recommend", "audit.record.agent"];
const FULL_TOOLS = [...SAFE_TOOLS, "decision.plan", "decision.classify_risk", "event.emit.domain", "approval.request.human", "runtime.complete_run"];

const defs: Array<{ role: RuntimeAgentRole; description: string; toolsAllowed: string[]; allowsSubdelegation: boolean }> = [
  { role: "pricing",         description: "Calcula precio base con datos de mercado",           toolsAllowed: SAFE_TOOLS,  allowsSubdelegation: false },
  { role: "job-planner",     description: "Genera milestones y cronograma desde el alcance",    toolsAllowed: FULL_TOOLS,  allowsSubdelegation: false },
  { role: "trust-match",     description: "Rankea profesionales por reputación e historial",    toolsAllowed: SAFE_TOOLS,  allowsSubdelegation: false },
  { role: "evidence-coach",  description: "Valida calidad de evidencia y guía la corrección",   toolsAllowed: SAFE_TOOLS,  allowsSubdelegation: false },
  { role: "risk",            description: "Evalúa riesgo de job, contrato y actor",             toolsAllowed: FULL_TOOLS,  allowsSubdelegation: false },
  { role: "dispute",         description: "Triaje asistido de disputas con análisis de evidencia", toolsAllowed: FULL_TOOLS, allowsSubdelegation: false },
  { role: "orchestrator",    description: "Coordina agentes especializados y expone métricas",  toolsAllowed: FULL_TOOLS,  allowsSubdelegation: true  },
  { role: "ecv",             description: "Validación ética constitucional de respuestas",      toolsAllowed: SAFE_TOOLS,  allowsSubdelegation: false },
];

for (const def of defs) {
  AgentRegistry.register({
    ...def,
    handler: (input) => executeSpecializedAgent(def.role, input),
  });
}

// Wire the delegate implementation into the orchestrator after all agents are registered.
// This enables the orchestrator to spawn real subagents without circular module imports.
setDelegateImpl(delegateTo);

export { AgentRegistry };
