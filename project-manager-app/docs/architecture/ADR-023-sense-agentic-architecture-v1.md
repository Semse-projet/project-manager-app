# ADR-023 — Sense Agentic Architecture v1: reconciliación de vocabulario y capacidades reales pendientes

**Estado:** PROPOSED
**Fecha:** 2026-07-31
**Contexto de origen:** sesión de diseño conversacional sobre una "arquitectura agéntica" (SEMSE Workspace OS / Prometeo Core / Agent Runtime / Business Kernel / Tool & MCP Layer / Model Gateway / Memory System) aterrizada contra el código real de `project-manager-app`.
**Relacionado con:** `docs/architecture/CURRENT_ARCHITECTURE.md`, `docs/architecture/ADR-021-anatomia-agente-semse.md`, `docs/architecture/ADR-022-browser-agent-obscura.md`, `docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md`, `ROADMAP.md`

---

## 1. Contexto

Se propuso una visión de arquitectura agéntica con vocabulario nuevo (Business
Kernel, Context Engine, Prometeo Core, Agent Runtime, Tool & MCP Layer, Model
Gateway, Memory System) para SEMSE/Sense. La verificación contra el
repositorio real mostró que:

1. `docs/architecture/CURRENT_ARCHITECTURE.md` (estado CANONICA) ya define una
   taxonomía oficial (SEMSE Core, Connect, Payments, Trust, AI, Agro, BuildOps,
   Knowledge, Integrations) con una regla explícita: **no se autoriza
   renombramiento masivo** (§3, §13).
2. `ADR-021-anatomia-agente-semse.md` ya hizo un mapeo equivalente del canon
   "Cerebro/Herramientas/Loop/Memoria" contra el código, derivando
   `SPEC-AGT-001` (Verification Loop) y `SPEC-AUT-001` (Permanent Loops) — **ya
   `IMPLEMENTED`** según `docs/SPEC_INDEX.md`.
3. Existen **dos rosters de agentes distintos y no reconciliados** en el
   propio repositorio:
   - **Sistema A** — `docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md`
     (estado `VERIFIED`) + `packages/agents/src/agent-registry.ts`
     (implementado): Marketplace, BuildOps, ProTools, Evidence, Crowd,
     Prometeo. Cada uno con contrato ejecutable real (`capabilities`,
     `forbiddenActions`, `requiredInputs`, `outputs`, `integratesWith`,
     `modules`), acoplado a engines de negocio reales (`escrow-engine.ts`,
     `milestone-builder.ts`, 25 trade engines en `packages/tools`).
   - **Sistema B** —
     `apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts`:
     Prometeo, Pulse, Planner, Felix, Justus, Marta. Cada uno con un
     `system prompt` de persona y un mapeo `intent → agente` para el chat de
     Prometeo Copilot.
   - Los dos rosters se solapan en dominio (evidencia, pagos/disputas,
     BuildOps) pero usan nombres distintos, y ninguno de los dos cubre por
     completo al otro (Marta/Pulse no tienen equivalente en el Sistema A;
     Marketplace/ProTools no tienen persona conversacional en el Sistema B).
4. `MCP` (Model Context Protocol) fue evaluado y descartado explícitamente
   para el tool-calling interno de Prometeo
   (`docs/specs/ui/prometeo-multimodal-workspace.spec.md`), pero
   `ADR-022-browser-agent-obscura.md` **ya planeaba** un "MCP Gateway" para
   exponer herramientas externas al agente de navegador Obscura — nunca
   construido. Es la misma pieza pendiente que un "CLI Agent Adapter"
   (Codex CLI / Claude CLI como tool nodes), no dos decisiones distintas.
5. El "Model Gateway" ya existe (`AiModelGatewayService` +
   `LLMOrchestrator`) pero como dos rutas de resolución de modelo no
   unificadas.
6. No existe un `ToolResult` multimodal tipado (`packages/schemas/src/`), ni
   cache-control declarativo por tool/parte de mensaje fuera del
   prompt-caching nativo de Anthropic, ni retrieval de `AgentDecision` vía
   Prometeo (gap que el propio `ADR-021 §4.4` ya había señalado sin cerrar).

## 2. Decisión

### 2.1 Modelo de dos capas para el agente (resuelve el punto 3)

Se adopta formalmente el siguiente modelo, sin renombrar ni fusionar código
existente:

```
Capa de persona conversacional (Sistema B)
  Prometeo · Pulse · Planner · Felix · Justus · Marta
  — decide tono, system prompt e intención en el chat de Prometeo Copilot —
        │ invoca
        ▼
Capa de agentes de dominio (Sistema A)
  Marketplace · BuildOps · ProTools · Evidence · Crowd · Prometeo
  — contratos ejecutables reales; mutan o consultan el Business Kernel —
```

Una persona conversacional puede invocar uno o varios agentes de dominio; un
agente de dominio no depende de que exista una persona conversacional para
correr (los agentes de dominio ya se invocan también vía
`apps/api/src/modules/semse-agents/` y eventos internos).

Esta relación **no estaba documentada** en ninguno de los dos specs de origen.
Se registra aquí como el hallazgo de reconciliación de esta ADR. No se toca
código: ambos sistemas siguen viviendo donde están.

Gaps de cobertura que quedan abiertos (no bloquean esta ADR, se anotan para
una fase futura si hay necesidad de negocio real):

- `Marta` (legal/compliance) y `Pulse` (salud del sistema) no tienen agente de
  dominio equivalente en el Sistema A.
- `Marketplace` y `ProTools` no tienen persona conversacional dedicada en el
  Sistema B (hoy resuelven vía `Prometeo` genérico).

### 2.2 Vocabulario nuevo → identidad vigente (glosario, no rename)

| Término propuesto | Identidad vigente en el repo | Evidencia |
|---|---|---|
| SEMSE Workspace OS | SEMSEproject (tesis de producto ya vigente) | `CURRENT_ARCHITECTURE.md` §1 |
| Prometeo Core | Prometeo Runtime + capa de persona/orquestación (Sistema B) | `ai-models/orchestrator/prometeo-orchestrator.service.ts`, `prometeo/prometeo.service.ts` |
| Business Kernel | Módulos de dominio (`jobs`, `projects`, `milestones`, `payments`, `evidence`, `disputes`, `contracts`, ...) | `apps/api/src/modules/*` |
| Agent Runtime | `packages/agents` (runtime, registry, governance, delegate, verification) | `packages/agents/src/*` |
| Tool & MCP Layer | Prometeo Tool Registry (tool-calling nativo) + MCP Gateway planeado (aún no construido) para agentes externos/CLI | `prometeo-tool-registry.ts`, `ADR-022-browser-agent-obscura.md` |
| Model Gateway | `AiModelGatewayService` + `LLMOrchestrator` (hoy no unificados — ver §2.3) | `ai-models/gateway/ai-model-gateway.service.ts`, `infrastructure/llm/orchestrator.ts` |
| Memory System | `agent-memory.service.ts` + `workspace-memory.repository.ts` + RAG de Prometeo | `modules/knowledge/*`, `modules/prometeo/embedding.service.ts` |
| Context Engine | `context-engine.interface.ts` + `operational-context.service.ts` + `token-budget-engine.ts` | `ai-models/context/*` |
| Audit/Governance Layer | `AuditLog` + `tool-governance.policy.ts` + `payment-governance.service.ts` | `infrastructure/audit/audit.service.ts`, `prometeo/tool-governance/*` |

Ningún módulo, carpeta o paquete se renombra como resultado de esta ADR. Este
vocabulario es una capa de documentación/glosario para comunicar la
arquitectura, consistente con la tabla "Normalización de conceptos
históricos" que `CURRENT_ARCHITECTURE.md` §3 ya usa para el mismo propósito.

### 2.3 Capacidades nuevas reales (las únicas que justifican código nuevo)

Verificado contra código que estas cinco **no existen hoy** y sí tienen valor
concreto:

| # | Capacidad | Spec derivado (tentativo) | Encaja en |
|---|---|---|---|
| 1 | Unificar `AiModelGatewayService`/`LLMOrchestrator` en un único `resolveModel` versionado, con tabla de criterios costo/latencia/capacidad/privacidad explícita | `SPEC-GTW-001` | Precede a F7 (Prometeo Multimodal) |
| 2 | `ToolResult` multimodal tipado (text/image/pdf/csv/annotation/approval_request) en `packages/schemas`, pilotado en `vision.analyze_image` y un export de evidencia | `SPEC-AGT-004` | Child spec de F7; depende de SPEC-GTW-001 |
| 3 | Cache-control declarativo por tool/parte de mensaje, cross-provider (hoy solo existe en `anthropic.provider.ts`) | `SPEC-GTW-002` | Child spec de F7; depende de SPEC-GTW-001 |
| 4 | Retrieval de `AgentDecision` vía Prometeo (cerrar `ADR-021 §4.4`; hoy solo lo usa `ops/loops.service.ts`) | `SPEC-AGT-003` | Child spec de F8 (Domain Loops) |
| 5 | CLI Agent Adapter (Codex CLI/Claude CLI como tool nodes, sandbox, allowlist de comandos, diff review) + MCP Gateway externo — cierra el pendiente de `ADR-022` | `SPEC-INT-001` | Extiende `ADR-022-browser-agent-obscura.md`; child spec de SEMSE Integrations |

Cada una se especifica y aprueba por separado siguiendo
`docs/SDD_GOVERNANCE.md` antes de escribir código (regla de cambio de
`CURRENT_ARCHITECTURE.md` §13).

## 3. Principios que gobiernan la decisión

Estos principios ya son ciertos en el código actual; esta ADR los hace
explícitos como contrato de diseño para todo trabajo derivado:

1. **El Business Kernel manda.** Los módulos de dominio son la fuente de
   verdad; deben poder seguir funcionando si Prometeo está apagado.
2. **Prometeo interpreta, no decide.** Clasifica intención, arma contexto,
   enruta a agente(s), pide aprobación cuando corresponde.
3. **Los agentes de dominio ejecutan bajo contrato y permisos.** Cada uno
   declara `capabilities`/`forbiddenActions` (ya en `SemseAgentDefinition`) y
   corre bajo RBAC (`packages/auth/src/rbac.ts`).
4. **Las mutaciones críticas requieren política y, cuando aplica, aprobación
   humana** (`tool-governance.policy.ts`, `PrometeoProposedAction`).
5. **Todo queda auditado**: modelo usado, herramienta usada, input/output,
   aprobador, timestamp (`AuditLog`, `PrometeoToolInvocationAudit`).
6. **No vendor lock-in**: el código no debe pedir un proveedor específico,
   sino una capacidad (`taskType`, `riskLevel`, `requiresVision`); el router
   resuelve. Esto ya es el diseño de `AiModelRouterService`; `SPEC-GTW-001`
   lo hace consistente entre las dos rutas actuales.

## 4. Consecuencias

**Positivas:** se cierra la ambigüedad entre los dos rosters de agentes sin
mover código; el vocabulario nuevo queda disponible para comunicación y specs
sin violar la regla de no-rename; los cinco gaps reales quedan acotados y
priorizados en vez de disolverse en una reescritura general.

**Negativas/costos:** cinco specs nuevos por escribir y aprobar antes de
tocar código; el gap de cobertura Marta/Pulse ↔ Sistema A queda abierto (no se
resuelve aquí a propósito, para no inventar agentes de dominio sin necesidad
de negocio confirmada).

**Riesgos aceptados:** si en el futuro se decide fusionar los dos rosters de
agentes en uno solo, esa fusión es un cambio de alto impacto (afecta
`agent-registry.ts`, el orquestador de intents, specs y tests de ambos
sistemas) y requiere su propia ADR con impacto en datos y plan de migración —
no se autoriza como consecuencia implícita de esta ADR.

## 5. Alternativas descartadas

- **Renombrar big-bang** (Business Kernel, Agent Runtime, etc. como carpetas
  reales nuevas): descartado, viola `CURRENT_ARCHITECTURE.md` §3/§13 sin
  justificación de negocio ni plan de migración de datos.
- **Fusionar los dos rosters de agentes en uno solo ahora**: descartado por
  esta ADR; el modelo de dos capas (§2.1) es reversible y no requiere tocar
  código, la fusión sí.
- **Adoptar Koog (u otro framework agéntico externo) como runtime central**:
  descartado, igual que en `ADR-021` — `packages/agents` ya gobierna con más
  rigor (risk scoring + approvals persistidos) que los frameworks evaluados;
  se reevalúa solo si el costo de mantener el runtime propio supera el
  beneficio. Frameworks externos (Koog, LangGraph, Claude/Codex CLI) se
  conectan como adapters reemplazables detrás de una interfaz propia, nunca
  como el núcleo irreversible.
- **Reabrir MCP para el tool-calling interno de Prometeo**: descartado, sigue
  vigente la decisión de `prometeo-multimodal-workspace.spec.md`. MCP solo se
  retoma para el caso específico ya planeado en `ADR-022` (herramientas
  externas para agentes tipo CLI/browser), vía `SPEC-INT-001`.

## 6. Specs derivados

- `SPEC-GTW-001` — Unificación del Model Gateway. **Escrito y mergeado**:
  `docs/specs/prometeo/model-gateway-unification.spec.md` (PR #495).
- `SPEC-AGT-004` — `ToolResult` multimodal tipado (spec adjunto:
  `docs/specs/agents/prometeo-core.spec.md` lo referencia como dependencia).
  Renumerado de `SPEC-AGT-002` a `SPEC-AGT-004`: ese ID ya lo ocupa
  `docs/specs/agents/prometeo-core.spec.md` (`id: agt-002-prometeo-core`);
  `SPEC-AGT-003` está reservado para el ítem siguiente. Corrección de drift
  propio, documentada aquí para no repetirla.
- `SPEC-GTW-002` — Cache-control declarativo. **Escrito**:
  `docs/specs/prometeo/cache-control.spec.md`.
- `SPEC-AGT-003` — Retrieval de `AgentDecision` vía Prometeo.
- `SPEC-INT-001` — CLI Agent Adapter + MCP Gateway externo.
- `docs/specs/agents/prometeo-core.spec.md` — spec de la capa de persona/orquestación (Sistema B), adjunto a esta ADR.

Registrar los specs pendientes en `docs/SPEC_INDEX.md` (vía
`pnpm spec:index`, no a mano — el índice es generado) cuando cada uno pase de
`DRAFT` a `APPROVED`.
