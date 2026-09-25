---
id: "prometeo.agent-decision-retrieval"
title: "Retrieval de AgentDecision vía Prometeo (alias histórico SPEC-AGT-003)"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/ops/loops.service.ts
  - apps/api/src/modules/ops/mission-control/mission-control.service.ts
  - apps/api/src/modules/prometeo/prometeo.retrieval.ts
  - apps/api/src/modules/prometeo/prometeo.service.ts
  - apps/api/src/modules/knowledge/agent-memory.service.ts
  - apps/api/src/modules/ai-models/context/operational-context.service.ts
  - packages/autonomy/src/loops/loop-definitions.ts
  - packages/autonomy/src/loops/spec-drift-loop.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
  - pulse
last_verified: "2026-08-17"
---

# Spec: Retrieval de `AgentDecision` vía Prometeo

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

**Deriva de:** `docs/architecture/ADR-021-anatomia-agente-semse.md` §4.4,
`docs/architecture/ADR-023-sense-agentic-architecture-v1.md` §2.3 ítem 4.
**Módulos afectados:** `apps/api/src/modules/prometeo`.
**Alias histórico:** `SPEC-AGT-003`. Child spec de F8 (Domain Loops).

> **Nota sobre ADR-021:** su nota de actualización (2026-08-01) dice "El gap
> de memoria episódica (§4.4) fue cerrado por SPEC-AGT-003". Verificado
> contra código el 2026-08-17: eso es falso a nivel de implementación — es
> una referencia a que el spec **fue escrito**, no a que el retrieval
> exista. `apps/api/src/modules/prometeo/` sigue con cero referencias a
> `AgentDecision`. Esta nota se deja registrada aquí porque es exactamente
> el tipo de drift entre documentación y código que `SOURCE_OF_TRUTH.md`
> pide reconciliar, no repetir.

## 1. Problema y resultado

**Para quién:** operadores (`OPS_ADMIN`) que usan Prometeo/Pulse para
entender el estado de los permanent loops (spec-drift, dedup-abstractions)
sin tener que leer `AgentDecision` directamente en base de datos.

**Problema:** `ADR-021` (2026-07-02) identificó un gap real: existe una
tabla de memoria episódica (`AgentDecision`) pero ningún camino de
retrieval hacia la capa conversacional de Prometeo. Ese gap sigue abierto
en código. Pero verificar contra el código real (2026-08-17) cambia lo que
"cerrar el gap" significa en la práctica respecto a lo que la versión
anterior de este spec asumía — ver §5, hallazgo central de esta revisión.

**Resultado esperado:** un retrieval de solo lectura, acotado a lo que
`AgentDecision` realmente contiene hoy, disponible para Prometeo/Pulse en
contexto operativo — sin inventar una capacidad de negocio (memoria de
decisiones sobre proyectos/milestones/disputas de clientes) que la tabla
todavía no tiene.

## 2. Alcance

### Incluido

- Un método de retrieval de solo lectura sobre `AgentDecision`, filtrado
  por `loopId`/`agentType`/`target`, expuesto a Prometeo en contexto
  operativo (Pulse / `system_health`, `project_report` — ver
  `docs/specs/agents/prometeo-core.spec.md` §5).
- Paginación/resumen por relevancia vía el mismo criterio que
  `agent-memory.service.ts` ya aplica a sus otros tipos de memoria.
- Documentar honestamente qué contiene `AgentDecision` hoy, para que
  cualquier decisión de producto sobre a quién exponérselo se tome con
  datos reales, no con la expectativa original de ADR-021.

### Fuera de alcance

- **No se crea ninguna tabla nueva ni columna nueva** (incluida
  `tenantId`) — ver §5, es exactamente el punto que este spec no puede
  resolver por sí solo.
- **No se propone ninguna escritura nueva a `AgentDecision`** desde ningún
  agente de dominio (Justus/Felix/Marta) — eso sería una expansión de
  alcance de negocio, no un retrieval.
- **No sustituye ni modifica** la lógica de cooldown de `loops.service.ts`
  ni la cola de excepciones de `mission-control.service.ts` — es un tercer
  consumidor de solo lectura.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` vía Pulse/Prometeo | mismo permiso que ya gobierna `GET /v1/ops/mission-control/*` (`ops:dashboard:read`) | sin tenant — ver §5, `AgentDecision` no tiene tenant hoy | Consultar hallazgos/decisiones de los permanent loops (spec-drift, dedup-abstractions) en conversación | Mutar `AgentDecision`; consultar contenido que no existe hoy en la tabla (no hay decisiones de negocio que consultar) |

- **Tenant boundary:** **no aplica hoy** — hallazgo central de esta
  revisión (§5): `AgentDecision` no tiene columna `tenantId`, y su único
  lector existente (`mission-control.service.ts:1068`) tampoco filtra por
  tenant. Este retrieval no puede inventar un boundary que no existe en el
  dato subyacente.
- **Ownership/resource policy:** el contenido real de `AgentDecision`
  (findings de QA sobre `docs/**`/`packages/**`) es propiedad de
  ingeniería/plataforma, no de un tenant de negocio — coherente con la
  ausencia de `tenantId`.
- **Step-up o aprobación humana:** ninguna — solo lectura.
- **Datos `privacyCritical`:** ninguno confirmado en el contenido real de
  hoy (`target` values como `drift:${specRef}:file:${declared}` — ver
  §5).
- **Requisitos de auditoría:** ninguna nueva — es lectura, no genera
  `AuditLog`.

## 4. Escenarios y criterios de aceptación

### P1 — Pulse responde con memoria real de un loop

```gherkin
DADO un OPS_ADMIN conversando con Pulse sobre el loop de spec-drift
CUANDO pregunta "¿qué encontró el último ciclo del loop de spec-drift?"
ENTONCES el retrieval consulta AgentDecision filtrado por
  loopId: "loop.spec-drift"
Y la respuesta usa datos reales (rationale/target/decision), no solo
  conocimiento genérico del modelo
```

Casos borde:

- [ ] `target` inexistente o loop sin actividad reciente — el retrieval
      devuelve vacío, no un error.
- [ ] Volumen — `AgentDecision` puede crecer sin límite con los loops
      permanentes (`aut-001-permanent-loops`, `IMPLEMENTED`); el retrieval
      debe acotar por fecha/relevancia vía `token-budget-engine.ts`, igual
      que el resto de fuentes de `ContextEngine`.
- [ ] Actor sin `ops:dashboard:read` — el retrieval no debe ejecutarse ni
      exponer nada (no hay fallback silencioso a "sin resultados" que
      filtre por permiso incorrectamente).

## 5. Bloqueado por decisión de producto: alcance real vs. alcance imaginado

Esta es la corrección más importante de esta revisión, y la razón por la
que el spec no puede pasar a `APPROVED` tal como estaba redactado.

**Lo que ADR-021/ADR-023 y la versión anterior de este spec asumían:**
`AgentDecision` es memoria de decisiones de agentes en general — el
ejemplo de motivación explícito era "un usuario pregunta a Prometeo/Justus/
Marta '¿por qué se rechazó esto antes?'" sobre un `target` de negocio
(`projectId`, `milestoneId`).

**Lo que el código muestra hoy (verificado 2026-08-17):**

| Pieza | Qué muestra | Evidencia |
|---|---|---|
| Escritores de `AgentDecision` | **Uno solo**, `LoopsService.recordCycleReport()` — confirmado por grep de `agentDecision.` en todo `apps/`, `packages/`: solo aparece en `loops.service.ts` (escribe) y `mission-control.service.ts` (lee) | grep exhaustivo, cero otros hits |
| Loops permanentes activos | Exactamente dos: `loop.spec-drift` (`scope: ["docs/**"]`) y `loop.dedup-abstractions` (`scope: ["packages/**"]`) | `packages/autonomy/src/loops/loop-definitions.ts:11-49` |
| Forma real de `target` | `drift:${specRef}:file:${declared}`, `drift:${specRef}:test:${declared}`, `drift:${specRef}:done-without-tests`, `drift:${specRef}:command:${command}` — referencias a especificaciones/archivos/comandos del propio repo, **no** `projectId`/`milestoneId`/ningún identificador de negocio de tenant | `packages/autonomy/src/loops/spec-drift-loop.ts:109,122,134,148` |
| Columna `tenantId` en `AgentDecision` | **No existe** — el modelo Prisma tiene `id, loopId, runId, agentType, target, kind, decision, rationale, outcome, confidence, evidence, createdAt`, sin ningún campo de tenant/org | `packages/db/prisma/schema.prisma:3511-3528` |
| Scoping por tenant en el único consumidor read existente | `mission-control.service.ts` filtra por `actor.tenantId` en prácticamente todas sus demás queries (signals, events, agent runs, approvals, incidents) — pero su query de `agentDecision.findMany()` (línea 1068) **no** incluye ningún filtro de tenant | `mission-control.service.ts:1068-1076` (comparado contra las ~15 queries con `tenantId` del mismo archivo) |

**Consecuencia:** `AgentDecision` es, en la práctica de hoy, memoria de QA
de ingeniería sobre el propio código/specs de SEMSE — no memoria de
decisiones de negocio sobre proyectos de clientes. No hay ningún
`rationale`/`evidence` de tenant que "filtrar entre tenants" porque no hay
contenido de tenant en la tabla. El riesgo de aislamiento que la versión
anterior de este spec describía como motivo central de `risk: medium` (un
`rationale` mal scopeado filtrando contexto de otro proyecto/tenant) **no
existe con el contenido actual** — pero tampoco existe la capacidad que el
ejemplo motivador prometía (responder "¿por qué se rechazó este milestone
antes?" con datos reales, porque ningún rechazo de milestone se escribe
jamás en esta tabla).

**Las dos rutas posibles, y por qué ninguna es una decisión que este spec
pueda tomar solo:**

- **Opción A — Retrieval acotado a lo que existe hoy.** Exponer
  `AgentDecision` tal cual (hallazgos de spec-drift/dedup-abstractions) a
  Pulse en contexto operativo/`OPS_ADMIN`, sin tocar Justus/Marta/Felix
  (que responden preguntas de negocio a clientes/pros, no de QA interna de
  SEMSE). Es implementable hoy sin migración, sin nueva escritura, y sin
  riesgo de fuga cross-tenant porque no hay dato de tenant que filtrar.
  Valor real pero mucho más angosto que "cerrar el gap de ADR-021" tal
  como se describía originalmente.
- **Opción B — Esperar a que `AgentDecision` tenga contenido de negocio.**
  Extender los agentes de dominio (Sistema A, `packages/agents/src/agent-registry.ts`)
  para que escriban decisiones de negocio reales (por qué se rechazó un
  milestone, por qué se resolvió una disputa así) a esta misma tabla o a
  una nueva. Esto sí cierra el gap que ADR-021 imaginaba, pero requiere: una
  migración (`tenantId` + índice), nuevas escrituras desde módulos de
  dominio (fuera del "no se propone ninguna escritura nueva" que este spec
  se puso a sí mismo como límite), y una revisión de privacidad antes de
  exponerlo a personas conversacionales que hablan con clientes/pros.

**Qué decisión falta y quién la toma:** el owner de producto de Prometeo
(`semse-core`) debe decidir si vale la pena construir la Opción A ahora
como entrega interina de valor limitado, o si el retrieval espera a que
exista una necesidad de negocio concreta que justifique la Opción B
(consistente con el mismo criterio que ADR-023 §2.1 ya aplicó al no crear
agentes de dominio nuevos para Marta/Pulse sin necesidad confirmada). Este
spec no puede tomar esa decisión leyendo código — es priorización de
producto, no un hecho verificable.

Mientras esa decisión no se tome, el spec queda en `REVIEW`: el diseño
técnico de la Opción A (§6-§12) está completo y es correcto para lo que
existe hoy, pero el "para quién / problema" del §1 no puede honestamente
prometer más que la Opción A hasta que alguien elija entre A y B.

## 6. Contratos

### API

No hay endpoint HTTP nuevo — el retrieval se expone como fuente de
contexto adicional dentro de la conversación de Prometeo, consumida
indirectamente por `POST /v1/ai-models/prometeo/chat` cuando la persona
activa es Pulse.

### UI

```yaml
surfaces: []
states: []
required_behavior: []
```

No aplica — sin cambio de UI.

### Agente/Prometeo

```yaml
tools: []
input_schema: "{ loopId?: string; agentType?: string; target?: string; limit?: number }"
output_schema: "AgentDecision[] resumido/paginado por token-budget-engine.ts"
source_citations_required: true
approval_policy: "none — solo lectura"
forbidden_behavior:
  - No se expone a personas que conversan con clientes/pros (Justus/Marta/Felix)
    mientras AgentDecision no contenga decisiones de negocio reales (ver §5).
  - No se inventa un filtro de tenantId sobre una tabla que no lo tiene.
```

## 7. FSM, eventos y reconstrucción

No aplica — sin FSM de dominio afectado, sin eventos nuevos. `AgentDecision`
ya se escribe desde `LoopsService.recordCycleReport()` (SPEC-AUT-001,
`IMPLEMENTED`); este spec no cambia esa escritura.

## 8. Datos y migración

- **Modelos Prisma:** ninguno nuevo — `AgentDecision` se reutiliza tal
  cual, sin migración, para la Opción A (§5). Si en el futuro se elige la
  Opción B, esa migración (`tenantId` + backfill) es una decisión y un
  spec aparte, no implícita a este documento.
- **Migración:** no aplica para la Opción A.
- **Estrategia expand/contract:** no aplica.
- **Backfill:** no aplica — no hay `tenantId` que backfillear en la
  Opción A.
- **Compatibilidad hacia atrás:** ningún consumidor existente
  (`loops.service.ts`, `mission-control.service.ts`) cambia de
  comportamiento — este spec solo añade un tercer consumidor de lectura.
- **Verificación de drift:** §5 fue verificada exhaustivamente el
  2026-08-17 (grep de escritores/lectores, lectura de `loop-definitions.ts`
  y `spec-drift-loop.ts`, comparación de scoping tenant en
  `mission-control.service.ts`).
- **Rollback de código:** trivial — es un consumidor nuevo, sin efecto
  sobre los dos existentes.
- **Rollback/forward-fix de datos:** no aplica.

## 9. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — reutiliza el logging ya existente de
  `ContextEngine`/`token-budget-engine.ts`.
- **Logs/traces/correlation:** el retrieval debe loggear `loopId`/`target`
  consultado, igual que el resto de fuentes de contexto.
- **Health/readiness:** no aplica.
- **Feature flags/allowlists:** ninguno nuevo — expuesto solo a Pulse/
  `OPS_ADMIN` por diseño (Opción A), no requiere flag adicional para
  acotar audiencia más allá del enrutamiento de persona ya existente.
- **Plan de canary:** activar primero solo para `OPS_ADMIN` en contexto
  operativo (no cliente-facing) antes de considerar cualquier extensión.
- **Evidencia de producción requerida:** una pregunta real de Pulse sobre
  el estado de un loop respondida con datos de `AgentDecision`, no con
  conocimiento genérico del modelo.
- **Señal de rollback:** ninguna esperada — es de solo lectura y no
  cambia comportamiento de los consumidores existentes.
- **Owner operativo:** `semse-core`.

## 10. Tests requeridos

- [ ] Unitario: el retrieval nunca falla ni inventa datos cuando
      `AgentDecision` está vacío para un `loopId`/`target` dado.
- [ ] Contrato: el retrieval respeta el presupuesto de
      `token-budget-engine.ts` (no vuelca la tabla completa).
- [ ] Permiso denegado: un actor sin `ops:dashboard:read` no obtiene
      resultados.
- [ ] Regresión: `loops.service.ts` y `mission-control.service.ts` no
      cambian de comportamiento tras añadir este tercer consumidor.
- [ ] UI loading/empty/forbidden/degraded/error — no aplica (sin UI
      nueva); N/A explícito en checklist.
- [ ] Canary o smoke autenticado en producción antes de `VERIFIED`.

## 11. Mapa de implementación

### API

- `apps/api/src/modules/prometeo/prometeo.retrieval.ts` (o un archivo
  hermano `agent-decision-retrieval.service.ts` en el mismo módulo)

### Web

- Ninguno — sin cambio de UI.

### Worker/Packages/DB

- Ninguno — sin cambio de schema ni de workers.

### Tests

- `apps/api/test/prometeo/*` (ubicación exacta a confirmar en
  `/speckit.tasks`)

## 12. Investigación externa

- No se realizó investigación externa nueva — el hallazgo central de esta
  revisión (§5) vino de leer el código propio del repositorio (Prisma
  schema, `loops.service.ts`, `loop-definitions.ts`,
  `spec-drift-loop.ts`, `mission-control.service.ts`), no de fuentes
  externas.

## 13. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado (no
      aplica para Opción A, ver §8)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Decisión de producto Opción A vs. Opción B (§5) tomada y registrada
      — **bloqueante para `APPROVED`**
- [ ] Sólo entonces `status: VERIFIED`
