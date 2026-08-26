---
id: "agt-002-prometeo-core"
title: "Prometeo Core — capa de persona y orquestación conversacional"
domain: "agents"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
# ci_status/deploy_status/activation_status: NOT_RUN/NOT_DEPLOYED/INACTIVE is
# about this SDD 2.0 delivery-evidence trail, not the real feature -- Prometeo
# Core has been live for a while, but no CI run or canary is tied to *this*
# documented contract, and "no se inventa evidencia retroactiva"
# (SDD_GOVERNANCE §5) rules out claiming DEPLOYED/ACTIVE without one.
ci_status: "NOT_RUN"
merge_status: "MERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence:
  - "docs/architecture/SEMSE_API_SURFACE_V1.md — POST /v1/ai-models/prometeo/chat, GET /v1/prometeo/tools, POST /v1/prometeo/tools/invoke listados como superficie viva (contexto, no evidencia de un canary/CI run de este spec)"
related_files:
  - apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts
  - apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts
  - apps/api/src/modules/ai-models/context/context-engine.interface.ts
  - apps/api/src/modules/ai-models/context/operational-context.service.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts
  - apps/api/src/modules/knowledge/agent-memory.service.ts
  - packages/agents/src/agent-registry.ts
related_tests:
  - apps/api/test/prometeo-orchestrator.service.test.ts
  - apps/api/test/prometeo.controller.test.ts
  - apps/api/test/prometeo-tool-governance.policy.test.ts
  - apps/api/test/prometeo-tool-execution.service.test.ts
related_endpoints:
  - "POST /v1/ai-models/prometeo/chat"
  - "GET /v1/prometeo/tools"
  - "POST /v1/prometeo/tools/invoke"
  - "POST /v1/prometeo/tools/invocations/:id/approve"
  - "POST /v1/prometeo/tools/invocations/:id/reject"
related_events: []
related_agents:
  - prometeo
  - felix
  - justus
  - marta
  - pulse
  - planner
last_verified: "2026-08-17"
---

# Spec: Prometeo Core — capa de persona y orquestación conversacional

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

**Deriva de:** `docs/architecture/ADR-023-sense-agentic-architecture-v1.md`
(`ACCEPTED`), `docs/architecture/ADR-021-anatomia-agente-semse.md`
(`ACCEPTED`).
**Módulos afectados:** `apps/api/src/modules/ai-models/`,
`apps/api/src/modules/prometeo/`.

## 1. Problema y resultado

**Para quién:** todo usuario autenticado (`CLIENT`, `PRO`, `OPS_ADMIN`) que
conversa con el Prometeo Copilot, y todo desarrollador que necesita saber
dónde vive cada pieza del orquestador antes de tocarla.

**Problema:** Prometeo Core — la capa de persona conversacional y
orquestación de intención del Copilot — existe y funciona, pero de forma
implícita/inline dentro de `prometeo-orchestrator.service.ts`. No había un
contrato que nombrara sus componentes, dijera cuáles ya son piezas reales
(implementadas y probadas por uso) y cuáles son gaps con un spec hijo
propio, ni que declarara explícitamente qué queda fuera de alcance (MCP
externo) para que nadie lo asuma implícitamente.

**Resultado esperado:** un contrato único, verificado contra el código real
línea por línea, que documenta el estado de cada componente de Prometeo
Core, resuelve las referencias cruzadas a los 4 specs hijos con sus rutas e
IDs reales (no codenames obsoletos), y dice sin ambigüedad qué es alcance
de este documento y qué es una decisión de producto todavía pendiente
(MCP externo vía ADR-025).

## 2. Alcance

### Incluido

- Documentar los componentes reales de Prometeo Core: Intent Classifier,
  Agent Router (persona + dominio), Context Engine, Model Router/Gateway,
  Tool Registry + Policy Guard, Approval Gate, Memory Writer, Audit Logger.
- El mapeo intención → persona → agente de dominio (§5), que formaliza
  ADR-023 §2.1.
- El flujo de ejecución end-to-end (§6).
- Las reglas de gobernanza que ya rigen mutaciones críticas (§7).
- Resolver las referencias cruzadas a los 4 specs hijos derivados de
  ADR-023 §2.3 por id/ruta real, reemplazando los codenames
  `SPEC-GTW-001`/`SPEC-GTW-002`/`SPEC-AGT-003`/`SPEC-AGT-002-B` originales.

### Fuera de alcance

- **Orquestación de herramientas externas vía MCP** (GitHub, Vercel,
  Railway, Docker, sandboxes) — bloqueado por
  `docs/architecture/ADR-025-mcp-external-tool-gateway.md`, que sigue en
  `PROPOSED` (ver "Bloqueado por decisión de producto" abajo).
- **Rediseñar o fusionar** los dos rosters de agentes (Sistema A —
  `packages/agents/src/agent-registry.ts` — y Sistema B — personas de
  `prometeo-orchestrator.service.ts`) — decisión ya tomada por ADR-023 §2.1
  y §5 (alternativa descartada): quedan como dos capas separadas, no se
  fusionan como efecto implícito de este spec.
- **Renombrar** `packages/agents` o `ai-models/orchestrator` — prohibido
  explícitamente (ver §8/Gates de cierre y `CURRENT_ARCHITECTURE.md` §13).
- **Implementación de los 4 gaps reales** (unificación de gateway, cache
  control, retrieval de `AgentDecision`, `ToolResult` multimodal) — cada
  uno tiene su propio spec hijo (§4), con su propio estado y sus propios
  gates de cierre; este documento no repite su diseño.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `CLIENT` / `PRO` | permisos de la tool invocada (p. ej. `vision:run`, `payments:release:propose`) evaluados por `evaluatePrometeoToolPolicy` | tenant/org resuelto por `resolveRequestContext`, igual que el resto de `/v1` | Conversar con Prometeo, invocar tools de lectura autorizadas, proponer mutaciones que requieran aprobación | Ejecutar tools de escritura sin `approvalPolicy` satisfecha; ver datos fuera de su tenant/org |
| `OPS_ADMIN` | permisos amplios + aprobación de `PrometeoProposedAction` de cualquier actor | sin scoping adicional más allá de tenant | Aprobar/rechazar cualquier `PrometeoProposedAction` pendiente | Saltarse el registro de auditoría (`AuditLog`, `PrometeoToolInvocationAudit`) |

- **Tenant boundary:** todo el contexto operativo (`OperationalContextService.buildContext`)
  se arma con `tenantId`/`orgId` resueltos del token de sesión — confirmado
  en código (`operational-context.service.ts`), no una fuente distinta a la
  de `/v1`.
- **Ownership/resource policy:** cada tool declara sus propios
  `permissions`; `evaluatePrometeoToolPolicy` (`tool-governance.policy.ts`)
  deniega si falta alguno, sin excepción por rol.
- **Step-up o aprobación humana:** toda tool de escritura con
  `approvalPolicy != "none"` crea una `PrometeoProposedAction` en vez de
  ejecutar — `OPS_ADMIN` siempre puede aprobar/rechazar; el actor
  proponente solo si `approvalPolicy: "confirm"` (ver
  `SEMSE_API_SURFACE_V1.md` §Prometeo).
- **Datos `privacyCritical`:** el enrutamiento de modelo hoy pasa por dos
  caminos no unificados — ver `prometeo.model-gateway-unification` (§4) para
  el detalle verificado del gap.
- **Requisitos de auditoría:** toda invocación de tool (lectura o
  escritura, bloqueada o exitosa) pasa por `toolGovernance.recordInvocation`
  → `PrometeoToolInvocationAudit`; toda mutación crítica queda además en
  `AuditLog`.

## 4. Componentes: estado real vs. objetivo, y dependencias resueltas

| Componente | Estado hoy (verificado 2026-08-17) | Archivo real | Spec hijo (dependencia) |
|---|---|---|---|
| Intent Classifier | Implementado, basado en keywords (`INTENT_KEYWORDS`) | `prometeo-orchestrator.service.ts:31` | — |
| Agent Router (persona) | Implementado (`AGENT_ROUTING`) | `prometeo-orchestrator.service.ts:80` | — |
| Agent Router (dominio) | Implementado por separado, sin enlace declarado desde el router de persona | `packages/agents/src/agent-registry.ts` | — |
| Context Engine | Implementado — token budget (`context-engine.interface.ts`) + contexto operativo tenant-scoped (`operational-context.service.ts`) | `ai-models/context/*` | — |
| Model Router/Gateway | Implementado pero **duplicado** — dos rutas de resolución no unificadas (verificado: `AiModelRouterService` no conoce `privacyCritical`, solo el `privacyLevel === "local_only"` de 5 valores posibles; DeepSeek/Kimi/GLM nunca pasan por `LLMOrchestrator`/`ProviderMetricsStore`) | `ai-model-gateway.service.ts` + `infrastructure/llm/orchestrator.ts` | `prometeo.model-gateway-unification` — `docs/specs/prometeo/model-gateway-unification.spec.md` (alias histórico `SPEC-GTW-001`; estado `REVIEW`, bloqueado por sign-off de clasificación de providers) |
| Tool Registry + Policy Guard | Implementado — 31 descriptors confirmados (`grep -c outputKind`), namespaces `agro`/`materials`/`payments`/`time_tracker`/`vision` | `prometeo-tool-registry.ts`, `tool-governance.policy.ts` | — |
| Execution Graph | No existe como grafo explícito — flujo lineal (policy → handler → risk → approvals → output) | `prometeo-tool-execution.service.ts` | Ya cubierto por `docs/specs/agents/verification-loop.spec.md` (`IMPLEMENTED`); no se reabre aquí |
| Approval Gate | Implementado (`PrometeoProposedAction`, endpoints `approve`/`reject`) | `prometeo-tool-execution.service.ts`, `tool-governance.repository.ts` | — |
| Memory Writer | Implementado, multi-tier (`agent-memory.service.ts`, `workspace-memory.repository.ts`) | `apps/api/src/modules/knowledge/agent-memory.service.ts` | — |
| Retrieval de `AgentDecision` | **No existe** — confirmado por grep: cero referencias a `AgentDecision`/`agentDecision` en todo `apps/api/src/modules/prometeo/` y en `agent-memory.service.ts` | — | `prometeo.agent-decision-retrieval` — `docs/specs/prometeo/agent-decision-retrieval.spec.md` (alias histórico `SPEC-AGT-003`; estado `REVIEW`, bloqueado por decisión de alcance — ver ese spec) |
| Audit Logger | Implementado (`AuditLog`, `PrometeoToolInvocationAudit`) | `infrastructure/audit/audit.service.ts`, `tool-governance.repository.ts` | — |
| `ToolResult` multimodal | **No existe tipado** — `resultJson`/`output` viajan como `unknown`; `outputKind` es solo un string descriptivo del tipo TS (`"VisionAnalysisResult"`, etc.), no un schema | `prometeo-tool-execution.service.ts:411`, `prometeo-tool-registry.ts` | `prometeo.tool-result-multimodal` — `docs/specs/prometeo/tool-result-multimodal.spec.md` (alias histórico `SPEC-AGT-004`, **no** `SPEC-AGT-002-B` — ver nota) |
| Cache Control | Solo a nivel de proveedor Anthropic (bloque `systemPrompt`, siempre, incondicional), no declarativo por tool ni por bloque de mensaje | `anthropic.provider.ts:38` | `prometeo.cache-control` — `docs/specs/prometeo/cache-control.spec.md` (alias histórico `SPEC-GTW-002`; estado `REVIEW`, bloqueado por sign-off de la tabla de cacheabilidad) |

> **Nota de corrección de referencias cruzadas (2026-08-17):** la versión
> anterior de este documento citaba al spec de `ToolResult` multimodal como
> `SPEC-AGT-002-B`. `ADR-023-sense-agentic-architecture-v1.md` §6 documenta
> que ese id colisionaba con este mismo documento (`agt-002-prometeo-core`)
> y lo renumeró formalmente a `SPEC-AGT-004`, dejando `SPEC-AGT-003`
> reservado para el retrieval de `AgentDecision`. Esta tabla usa la
> numeración corregida de la ADR, no la original de este spec.

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

## 6. Escenarios y criterios de aceptación

### P1 — Conversación con selección de persona y agente de dominio

```gherkin
DADO un usuario autenticado con un mensaje cuyo intent clasifica como
  "evidence_review"
CUANDO Prometeo Core procesa la solicitud
ENTONCES el Intent Classifier resuelve "evidence_review" (INTENT_KEYWORDS)
Y el Agent Router selecciona la persona Felix (AGENT_ROUTING)
Y el Context Engine arma contexto operativo tenant-scoped
  (OperationalContextService.buildContext)
Y el Model Router resuelve un modelo por capacidad, no por nombre fijo
```

### P2 — Ejecución de tool gobernada con aprobación requerida

```gherkin
DADO una tool de escritura con approvalPolicy != "none"
CUANDO el usuario la invoca vía POST /v1/prometeo/tools/invoke
ENTONCES evaluatePrometeoToolPolicy devuelve "require_approval"
Y se crea una PrometeoProposedAction en vez de ejecutar
Y OPS_ADMIN (o el proponente si approvalPolicy es "confirm") puede
  aprobar/rechazar vía los endpoints dedicados
Y toda la secuencia queda en PrometeoToolInvocationAudit
```

Casos borde:

- [ ] Tool desconocida (`namespace.name` no registrado) — `400`, sin
      llegar a `evaluatePrometeoToolPolicy` (ya cubierto por
      `prometeo-tool-execution.service.ts`).
- [ ] Permiso faltante — `403` con `missingPermissions` explícito, se
      registra como `blocked` en `PrometeoToolInvocationAudit` incluso
      cuando la tool nunca se ejecuta.
- [ ] Aislamiento cross-tenant — todo el contexto operativo se arma con
      `tenantId` del actor; ningún componente de este spec construye
      contexto con un `tenantId` distinto al de la sesión.

## 7. Contratos

### API — endpoints ya existentes, sin contrato nuevo en este spec

Ver `docs/architecture/SEMSE_API_SURFACE_V1.md` §Prometeo para el contrato
completo de `POST /v1/ai-models/prometeo/chat`, `GET /v1/prometeo/tools`,
`POST /v1/prometeo/tools/invoke` y los endpoints de `approve`/`reject`. Este
documento no redefine esos contratos — los referencia como ya vigentes.

### UI

```yaml
surfaces:
  - Prometeo Copilot (apps/web, ver ui.prometeo-multimodal-workspace.spec.md)
states:
  - loading
  - ready
  - forbidden
  - error
required_behavior:
  - No aplica cambio de UI en este spec — documenta comportamiento ya vigente.
```

### Agente/Prometeo

```yaml
tools: [] # ver prometeo-tool-registry.ts para el catálogo completo (31 descriptors)
input_schema: PrometeoRequest (multimodal legacy-compatible)
output_schema: PrometeoToolExecutionResult (parcialmente tipado — ver prometeo.tool-result-multimodal)
source_citations_required: true
approval_policy: por-tool (none | confirm | human_required), ver tool-governance.policy.ts
forbidden_behavior:
  - Ninguna tool nueva se declara "executable" sin adapter real (regla F2 ya vigente).
  - Ninguna orquestación de herramientas externas vía MCP mientras ADR-025 siga PROPOSED.
```

## 8. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno directamente — Prometeo Core interpreta
  y propone, no posee FSM propio. Las mutaciones que sí tocan FSM (pagos,
  milestones) lo hacen a través de los módulos de dominio bajo su propia
  policy, no de un FSM nuevo de Prometeo.
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md` — Prometeo Core
  no autoriza por sí solo ninguna transición; delega a los módulos de
  dominio.
- **Eventos declarados:** `docs/foundation/EVENT_CATALOG.md` §"Productores
  — Prometeo (Orchestrator / Copilot)" — reutiliza `agent.action_logged` y
  `agent.human_review_requested`; no introduce nombres nuevos.
- **Productor + outbox atómico:** vía `DomainEventBus` (audit + routing
  canónico), ya vigente.
- **Consumidores + idempotencia:** no aplica cambio en este spec.
- **Replay/rebuild:** no aplica.
- **DLQ/compensación:** no aplica — la aprobación humana ya es el
  mecanismo de compensación para mutaciones bloqueadas.

## 9. Datos y migración

- **Modelos Prisma:** ninguno nuevo en este spec — usa `PrometeoProposedAction`,
  `PrometeoToolInvocationAudit`, `AgentMemoryRecord`/`WorkspaceMemoryRecord`
  (vía `packages/knowledge`), todos ya existentes.
- **Migración:** no aplica.
- **Estrategia expand/contract:** no aplica.
- **Backfill:** no aplica.
- **Compatibilidad hacia atrás:** este documento es puramente descriptivo
  de código ya en `main`; no cambia ningún contrato de datos.
- **Verificación de drift:** ver §4 — cada fila fue verificada contra
  código real el 2026-08-17 (grep + lectura de archivo), no asumida desde
  la versión anterior del spec.
- **Rollback de código:** no aplica (sin código nuevo).
- **Rollback/forward-fix de datos:** no aplica.

## 10. Observabilidad, despliegue y activación

- **Métricas/SLO:** logging estructurado ya existente en
  `prometeo-orchestrator.service.ts`/`prometeo-tool-execution.service.ts`
  (sin cambio en este spec).
- **Logs/traces/correlation:** `requestId` propagado en toda invocación de
  tool (`auditRef: "prometeo-tool:${requestId}:${id}"`), ya vigente.
- **Health/readiness:** `GET /v1/prometeo/tools` es uno de los nueve probes
  canónicos de módulo (`SEMSE_API_SURFACE_V1.md` §"Probes canónicos") —
  debe responder `401` sin sesión, nunca `404`.
- **Feature flags/allowlists:** ninguno propio de este spec.
- **Plan de canary:** no aplica — describe comportamiento ya en producción,
  no un rollout nuevo.
- **Evidencia de producción requerida:** este spec no introduce código, por
  lo que no requiere evidencia de producción adicional a la ya citada en
  `production_evidence` (la superficie de API documentada).
- **Señal de rollback:** no aplica.
- **Owner operativo:** `semse-core`.

## 11. Tests requeridos

- [ ] Test de contrato que valide la tabla §5 (mapeo intención → persona →
      agente) contra el comportamiento real del orquestador — sigue
      pendiente, es el propio criterio de aceptación #2 de la versión
      anterior de este spec y no se cierra solo con esta reescritura.
- [ ] Ningún test nuevo de dominio/proyección — este spec no introduce
      lógica nueva.
- [ ] Los 4 specs hijos (§4) declaran sus propios tests requeridos; no se
      duplican aquí.

## 12. Mapa de implementación

### API

- `apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts`
- `apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts`
- `apps/api/src/modules/ai-models/context/*`
- `apps/api/src/modules/prometeo/*`

### Web

- Consumido por el Prometeo Copilot (`apps/web`, ver
  `docs/specs/ui/prometeo-multimodal-workspace.spec.md`) — sin cambios en
  este spec.

### Worker/Packages/DB

- `packages/agents/src/agent-registry.ts` (Sistema A, no se toca)

### Tests

- Ninguno nuevo en este spec (ver §11).

## Bloqueado por decisión de producto: orquestación de herramientas externas (MCP)

El Tool Registry (§4) gobierna hoy únicamente tools internas de SEMSE. La
posibilidad de que Prometeo Core invoque herramientas externas de uso
general (GitHub, Vercel, Railway, Docker, sandboxes vía MCP) — parte de la
visión descrita en `docs/vision/VISION_PROMETEO_OS_2026.md` — **no es
alcance de este spec** mientras
`docs/architecture/ADR-025-mcp-external-tool-gateway.md` siga en
`PROPOSED` (verificado: el archivo declara `Estado: PROPOSED`, fecha
2026-08-04, sin decisión tomada entre sus tres opciones evaluadas). Esto no
es una omisión: es la misma decisión que ya se tomó al retirar
`SPEC-INT-001` (ver `ROADMAP.md` §"Consolidación Cognitiva"), declarada
aquí explícitamente para que ningún cambio futuro a este spec dé por hecho
que ese alcance ya fue aprobado.

**Qué decisión falta y quién la toma:** un humano (Samuel, según la propia
ADR-025 §2.1) debe elegir entre las tres opciones que la ADR ya deja
planteadas (extender el Tool Registry interno, un Gateway MCP separado, o
no construirlo ahora) y mover `ADR-025` de `PROPOSED` a `ACCEPTED`. Si eso
ocurre, este spec requiere una revisión explícita antes de que cualquier
tool externa se registre — no se autoriza como consecuencia implícita de
un cambio a esta tabla.

## Gates de cierre

- [x] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes (plan/tasks/checklist
      SDD 2.0 aún no generados para este documento — el spec en sí ya está
      `APPROVED`, pero implementar cualquier gap de §4 requiere generarlos
      primero)
- [ ] Tests derivados del spec y verdes (ver §11 — pendiente el test de
      contrato de §5)
- [ ] `pnpm spec:validate:strict` verde
- [x] Ningún cambio de este spec renombra `packages/agents` ni
      `ai-models/orchestrator` (regla de no-rename de
      `CURRENT_ARCHITECTURE.md` §13)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado (para el propio cambio de este spec)
- [ ] Deployment terminal `DEPLOYED` (ya cierto para el código que este
      spec documenta; no para el spec en sí, que es documentación)
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
