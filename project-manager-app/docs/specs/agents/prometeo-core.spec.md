---
id: agt-002-prometeo-core
title: "SPEC-AGT-002 — Prometeo Core: capa de persona y orquestación conversacional"
type: spec
domain: agents
status: "DRAFT"
owner: semse-core
risk: high
related_files:
  - apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts
  - apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts
  - apps/api/src/modules/ai-models/context/context-engine.interface.ts
  - apps/api/src/modules/ai-models/context/operational-context.service.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
  - apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts
  - apps/api/src/modules/knowledge/agent-memory.service.ts
  - packages/agents/src/agent-registry.ts
related_tests: []
related_endpoints:
  - v1/prometeo/chat
  - v1/prometeo/tools/invocations/:id/approve
  - v1/prometeo/tools/invocations/:id/reject
related_events: []
related_agents:
  - prometeo
  - felix
  - justus
  - marta
  - pulse
  - planner
last_verified: "2026-07-31"
---

# SPEC-AGT-002 — Prometeo Core

**Deriva de:** ADR-023-sense-agentic-architecture-v1.md, ADR-021-anatomia-agente-semse.md
**Módulos afectados:** `apps/api/src/modules/ai-models/`, `apps/api/src/modules/prometeo/`
**Fase Matriz:** F2 (Prometeo Tool Registry gobernado) / F7 (Prometeo Multimodal)

---

## 1. Propósito

Prometeo Core es la capa de persona conversacional y orquestación de intent
del Prometeo Copilot. **No es un backend paralelo**: interpreta la petición
del usuario, arma contexto, selecciona persona/agente de dominio, resuelve
modelo, ejecuta herramientas gobernadas y persiste memoria — pero el
Business Kernel (módulos de dominio) conserva la autoridad y los datos reales
(principio ya vigente, ver `CURRENT_ARCHITECTURE.md` §7).

Este spec formaliza como componentes explícitos lo que hoy existe de forma
implícita/inline en `prometeo-orchestrator.service.ts`, y declara qué falta
para que cada "componente" sea una pieza real y no solo un paso de código
embebido.

## 2. Responsabilidades

- Clasificar la intención del usuario (`PrometeoIntentType`).
- Seleccionar persona conversacional (Prometeo/Pulse/Planner/Felix/Justus/Marta)
  y, cuando la intención lo requiera, invocar el agente de dominio
  correspondiente del Sistema A (`packages/agents/src/agent-registry.ts`).
- Cargar contexto operativo mínimo necesario (`ContextEngine`).
- Resolver modelo según capacidad requerida, no según proveedor fijo.
- Ejecutar herramientas a través del Tool Registry gobernado
  (`evaluatePrometeoToolPolicy`).
- Pedir aprobación humana en mutaciones críticas
  (`PrometeoProposedAction` + `approvalPolicy`).
- Persistir memoria relevante (`agent-memory.service.ts`,
  `workspace-memory.repository.ts`).
- Auditar cada invocación (`PrometeoToolInvocationAudit`, `AuditLog`).

## 3. No-responsabilidades

- Prometeo Core no es la fuente de verdad de datos de negocio; los módulos de
  dominio lo son.
- No libera pagos, no cierra disputas, no modifica contratos ni despliegues
  de producción sin aprobación humana explícita.
- No mantiene una copia paralela del estado de negocio (principio ya vigente).
- No decide el modelo por nombre fijo; decide por capacidad requerida
  (`taskType`, `riskLevel`, `requiresVision`) y el router resuelve.
- **Fuera de alcance por ahora — herramientas externas vía MCP.** Prometeo
  Core no orquesta GitHub, Vercel, Railway, Docker ni ningún servidor MCP
  externo. `SPEC-INT-001` (CLI Agent Adapter + MCP Gateway externo) está
  retirado (ver `ROADMAP.md`, "Programa transversal — Consolidación
  Cognitiva"); reabrirlo es una decisión pendiente de
  `docs/architecture/ADR-025-mcp-external-tool-gateway.md` (`PROPOSED`),
  no algo que este spec pueda asumir. Mientras esa ADR no pase a
  `ACCEPTED`, el Tool Registry gobernado (§4, fila "Tool Registry + Policy
  Guard") sigue acotado a herramientas internas de SEMSE.

## 4. Componentes: estado real vs. objetivo

| Componente | Estado hoy | Archivo real | Gap a cerrar |
|---|---|---|---|
| Intent Classifier | Implementado, basado en keywords (`INTENT_KEYWORDS`) | `prometeo-orchestrator.service.ts:31-78` | Ninguno bloqueante; evaluar clasificador por embeddings solo si el keyword-matching muestra tasa de error alta en producción |
| Agent Router (persona) | Implementado (`AGENT_ROUTING`) | `prometeo-orchestrator.service.ts:80-98` | Ninguno |
| Agent Router (dominio) | Implementado por separado, sin enlace declarado desde el router de persona | `packages/agents/src/agent-registry.ts` | Documentar explícitamente qué intención dispara qué agente de dominio (tabla §5) |
| Context Engine | Implementado | `context-engine.interface.ts`, `operational-context.service.ts`, `token-budget-engine.ts` | Ninguno bloqueante |
| Model Router/Gateway | Implementado pero **duplicado** (dos rutas de resolución) | `ai-model-gateway.service.ts` + `infrastructure/llm/orchestrator.ts` | `SPEC-GTW-001` |
| Tool Registry + Policy Guard | Implementado/parcial (31 descriptors, 23/24 read, 7/7 write) | `prometeo-tool-registry.ts`, `tool-governance.policy.ts` | `vision.analyze_video` pendiente (capacidad separada, no deuda de gobernanza) |
| Execution Graph | **No existe como grafo explícito** — el flujo hoy es lineal (policy → handler → risk → approvals → output) | `prometeo-tool-execution.service.ts` | Ya cubierto por `SPEC-AGT-001` (verification loop, `IMPLEMENTED`); no se reabre aquí |
| Approval Gate | Implementado | `PrometeoProposedAction`, endpoints `approve`/`reject` | Ninguno |
| Memory Writer | Implementado (multi-tier) | `agent-memory.service.ts`, `workspace-memory.repository.ts` | Retrieval de `AgentDecision` vía Prometeo: `SPEC-AGT-003` |
| Audit Logger | Implementado | `AuditLog`, `PrometeoToolInvocationAudit` | Ninguno |
| Tool Result (multimodal) | **No existe tipado** — resultados viajan como JSON/texto plano | — | `SPEC-AGT-002-B` (ver nota) |
| Cache Control | Solo a nivel de proveedor Anthropic, no declarativo por tool | `anthropic.provider.ts` | `SPEC-GTW-002` |

> Nota: el `ToolResult` multimodal y el cache-control se mencionan aquí como
> dependencias, pero se especifican en detalle en `SPEC-AGT-002` (tabla de
> ADR-023 §2.3, ítems 2 y 3) — este documento no repite su diseño para evitar
> mantener dos fuentes de verdad del mismo contrato.

## 5. Mapeo intención → persona → agente de dominio (formaliza ADR-023 §2.1)

| `PrometeoIntentType` | Persona (Sistema B) | Agente de dominio invocado (Sistema A) |
|---|---|---|
| `evidence_review` | Felix | Evidence |
| `payment_status`, `dispute_status`, `budget_estimate` | Justus | Crowd |
| `legal_compliance` | Marta | — (gap de cobertura, ver ADR-023 §2.1; hoy Marta responde sin agente de dominio dedicado) |
| `project_report`, `system_health` | Pulse | BuildOps (parcial; Pulse también cubre salud de infraestructura sin agente de dominio dedicado) |
| `schedule_plan` | Planner | BuildOps |
| `operational_summary`, `estimate_generation`, `price_suggestion`, `materials_list`, `client_message`, `project_summary_client`, `unknown` | Prometeo | Prometeo / ProTools (para estimados) |

Este mapeo es descriptivo del comportamiento actual, no prescriptivo de una
reescritura. Donde el agente de dominio invocado dice "gap de cobertura", el
comportamiento actual es que la persona responde directamente sin delegar a
un agente de dominio con contrato propio — aceptable mientras no haya
necesidad de negocio confirmada para crear uno nuevo (ver ADR-023 §4).

## 6. Flujo de ejecución

```
User request
  → Intent Classifier (keyword match)
  → Context Engine (arma contexto mínimo autorizado)
  → Agent Router: selecciona persona + agente(s) de dominio si aplica
  → Model Router: resuelve modelo por capacidad, no por nombre
  → Tool Registry: ejecuta con Policy Guard (pre-check)
  → Approval Gate: si la tool es `requires_approval`, se detiene y espera humano
  → Policy Guard (post-check): valida que la salida no exceda permisos
  → Memory Writer: persiste en la memoria correspondiente (session/workspace/operational/long-term)
  → Audit Logger: registra modelo, tool, input/output, aprobador, timestamp
```

## 7. Gobernanza

- Toda mutación crítica requiere `approvalPolicy != none` y aprobación humana
  registrada (ya implementado; no se relaja aquí).
- Ninguna tool nueva se declara `executable` sin adapter real (regla F2 ya
  vigente).
- Cambios a este spec que afecten el mapeo intención→agente (§5) o que creen
  agentes de dominio nuevos requieren actualizar
  `docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md` en el mismo cambio,
  para no volver a divergir los dos rosters.

## 8. Criterios de aceptación

- [ ] Este documento pasa de `DRAFT` a `APPROVED` tras revisión humana.
- [ ] La tabla §5 se valida contra el comportamiento real del orquestador
      (test de contrato, no solo lectura de código).
- [ ] `SPEC-GTW-001`, `SPEC-AGT-003` quedan referenciados como dependencias
      explícitas antes de implementarse.
- [ ] Ningún cambio de este spec renombra `packages/agents` ni
      `ai-models/orchestrator` (regla de no-rename de `CURRENT_ARCHITECTURE.md` §13).
