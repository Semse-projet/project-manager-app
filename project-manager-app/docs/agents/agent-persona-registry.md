# Agent Persona Registry

**Fecha:** 2026-04-27
**Fuente canónica:** `packages/agents/src/index.ts` → `NAMED_AGENTS`

## Origen

Los 16 agentes nombrados de SEMSE fueron originalmente definidos en `labsemse/src/lib/ai.ts`
como el roster de personas del Vite app legacy con Supabase.

Fueron migrados y expandidos a `packages/agents/src/index.ts` con:
- `contextTriggers` — páginas/módulos donde el agente es contextualmente relevante
- `SpecializedAgentRole` — agentes de backend separados de los de UX
- Iconos via dicebear seeds consistentes con la identidad de cada agente

## Los 16 Named Agents (UX layer)

| Role | Nombre | Dominio | Color | Context |
|---|---|---|---|---|
| `assistant` | SEMSE | Central — marketplace, jobs | `#3b82f6` | dashboard, marketplace, jobs |
| `marta` | Marta | Gestión de proyectos y milestones | `#10b981` | milestones, projects, contracts |
| `planner` | Planner | Planificación y estimaciones | `#8b5cf6` | jobs/new, proposals, bids |
| `felix` | Felix | Soporte técnico de campo | `#f59e0b` | units, evidence, worklogs |
| `escrow` | Escrow | Pagos y escrow | `#ff6a00` | escrow, payments, milestones |
| `justus` | Justus | Contratos digitales | `#06b6d4` | contracts, legal |
| `legal` | Legal | Normativas y cumplimiento | `#64748b` | compliance, contracts |
| `vesper` | Vesper | Análisis de riesgo | `#ec4899` | trust, disputes, professionals |
| `security` | Security | Seguridad de cuenta | `#ef4444` | auth, settings, admin |
| `pulse` | Pulse | Métricas y KPIs | `#22d3ee` | dashboard, reports, analytics |
| `binary` | Binary | Integraciones y API | `#a3e635` | api, integrations, webhooks |
| `tech` | Tech | Arquitectura del sistema | `#7c3aed` | architecture, cortex |
| `design` | Design | UX/UI y flujos | `#f472b6` | dashboard, marketplace |
| `marketing` | Marketing | Crecimiento y perfil | `#fb923c` | professionals, profile |
| `health` | Health | Incidentes y bienestar | `#34d399` | incidents, worklogs |
| `evidence_coach` | Evidence Coach | Documentación de evidencia | `#fbbf24` | evidence, milestones |

## 8 Specialized Agents (backend/sistema)

| Role | Nombre | Función |
|---|---|---|
| `pricing` | Pricing Agent | Cálculo de precios con datos de mercado |
| `job-planner` | Job Planner | Genera milestones y cronograma desde scope |
| `trust-match` | Trust Match | Matching profesional por reputación verificada |
| `evidence-coach` | Evidence Coach | Coaching de evidencia con checklist adaptativo |
| `risk` | Risk Assessment | Evaluación de riesgo por job y actor |
| `dispute` | Dispute Resolution | Resolución asistida con análisis de evidencia |
| `orchestrator` | Orchestrator | Coordina agentes especializados |
| `ecv` | ECV | Validación ética constitucional de respuestas |

## Cómo usar

### Importar en frontend
```ts
import { NAMED_AGENTS, getAgentsForContext, getAgentColor } from "@semse/agents";

// Agente para contexto actual
const agents = getAgentsForContext("escrow"); // → [escrow, felix]
const color  = getAgentColor("marta");        // → "#10b981"
```

### Conectar con el motor agentivo

Los `NAMED_AGENTS` son la **capa de identidad UX** encima del motor técnico:

```
Usuario → UI (AgentBubble + AgentChatPanel) → NAMED_AGENTS persona
  → ProjectCopilotHarness → AgentMemoryService + PlanModeService
  → LLMOrchestrator (AnthropicProvider / OpenAIProvider)
  → Respuesta + plan + acciones propuestas
```

La `personality` de cada agente nombrado se inyecta como instrucción de tono
en `buildSystemPrompt()` dentro del harness.

## Pendiente

- [ ] `AgentBubble` debería recibir el agente activo desde `NAMED_AGENTS` para mostrar el color correcto
- [ ] `AgentChatPanel` debería poder cambiar de agente según `contextTriggers` de la ruta activa
- [ ] Los agentes especializados del backend deberían tener sus system prompts documentados
