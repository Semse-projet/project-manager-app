---
id: "prometeo.jev-human-review-queue"
title: "Bandeja de revisión humana — Jev Decision Layer, Wave: Marketplace confidence gate"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_JEV_ENABLED"
  - "SEMSE_JEV_MARKETPLACE_GATE_ENABLED"
  - "SEMSE_JEV_MARKETPLACE_GATE_MODE"
  - "SEMSE_JEV_MIN_CONFIDENCE"
production_evidence: []
related_files:
  - "apps/api/src/modules/ai-models/decision/decision.types.ts"
  - "apps/api/src/modules/ai-models/decision/decision-flags.ts"
  - "apps/api/src/modules/ai-models/decision/decision-layer.module.ts"
  - "apps/api/src/modules/semse-agents/marketplace-confidence-gate.ts"
  - "apps/api/src/modules/semse-agents/marketplace.agent.ts"
  - "apps/api/src/modules/semse-agents/semse-agents.service.ts"
  - "apps/api/src/modules/semse-agents/semse-agents.controller.ts"
  - "apps/api/src/modules/semse-agents/semse-agents.module.ts"
  - "apps/web/app/(app)/admin/agents/page.tsx"
  - "apps/web/app/api/semse/agents/review/route.ts"
  - "apps/web/app/api/semse/agents/review/[eventId]/approve/route.ts"
  - "apps/web/app/api/semse/agents/review/[eventId]/reject/route.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/marketplace-confidence-gate.test.ts"
  - "apps/api/test/marketplace-agent-review-gate.test.ts"
  - "apps/api/test/jev-decision-layer.test.ts"
related_endpoints:
  - "GET /v1/agents/semse/review"
  - "POST /v1/agents/semse/review/:eventId/approve"
  - "POST /v1/agents/semse/review/:eventId/reject"
related_events: []
related_agents:
  - "marketplace"
  - "prometeo"
last_verified: "2026-09-26"
---

# Spec: Bandeja de revisión humana — Jev Decision Layer, Wave: Marketplace confidence gate

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

**Aprobación:** sign-off explícito del product owner en PR #687, 2026-09-26 —
alcance acotado a §2 (Marketplace únicamente, shadow-mode por defecto, sin
reentrenamiento). No se amplió el alcance en la aprobación.

## 1. Problema y resultado

**Para quién:** operador/OPS_ADMIN que audita la calidad de las clasificaciones automáticas de Marketplace; indirectamente, el cliente y el profesional cuyo proyecto pasa por esa clasificación.

**Problema:** `MarketplaceAgent.classifyJob` ya calcula un `matchScore` (0-100) por cada job publicado, pero nada lo usa como señal de decisión — un job mal clasificado (trade equivocado, presupuesto fuera de rango) se dispara igual hacia Protools/BuildOps y notifica contratistas sin que ningún humano lo vea. El sistema ya tiene un mecanismo diseñado exactamente para esto — el Jev Decision Layer (`prometeo.jev-decision-layer`, `APPROVED`) con acciones `HUMAN_REVIEW`/`ASK_USER`/`ESCALATE` y un `DecisionOutcome.confidence` — pero su registro cerrado de features (`DECISION_FEATURES`) sólo cubre `agent_router` y `vision_gate` hoy. Este spec es la tercera "wave" de ese mismo layer, no un sistema nuevo.

**Resultado esperado:** cuando una clasificación cae por debajo de `SEMSE_JEV_MIN_CONFIDENCE` (ya existe, default 0.7), el evento queda registrado como `JevDecisionEvent` (reutilizando la tabla existente, un nuevo valor de `feature`) y aparece en una bandeja de revisión dentro de `admin/agents`. En modo `shadow` (default) esto es sólo observabilidad: el pipeline sigue corriendo igual, pero un humano ve qué habría necesitado revisión. En modo `live` (flag aparte, apagado por defecto), Marketplace pausa el `dispatch` de `ESTIMATE_REQUESTED`/`PROJECT_PLANNED` hasta que un humano apruebe, corrija o rechace — mismo patrón que `PrometeoProposedAction.approve/reject` para tool invocations.

## 2. Alcance

### Incluido

- Nueva feature `marketplace_classify` en `DECISION_FEATURES` (Jev Decision Layer), con sus propias acciones (`AUTO_PROCEED`, `HUMAN_REVIEW`) y flags (`SEMSE_JEV_MARKETPLACE_GATE_ENABLED`, `SEMSE_JEV_MARKETPLACE_GATE_MODE`), siguiendo el mismo patrón shadow/live que `agent_router`/`vision_gate`.
- Registro de cada clasificación como `JevDecisionEvent` (`feature: "marketplace_classify"`), incluyendo `confidence` (mapeado desde `matchScore/100`) y `finalSystemAction`.
- En modo `live`: `MarketplaceAgent.handleMessage` no dispara `ESTIMATE_REQUESTED`/`PROJECT_PLANNED` cuando el evento requiere `HUMAN_REVIEW` — el job queda en estado "pendiente de revisión" hasta una decisión humana.
- Dos endpoints de decisión humana (`approve`/`reject`, con override de campos) sobre un `JevDecisionEvent` pendiente, reusando el patrón de permisos y forma de `prometeo.controller.ts#approveToolInvocation/rejectToolInvocation`.
- Sección "Revisión pendiente" en `admin/agents/page.tsx`: lista de eventos con `finalSystemAction = HUMAN_REVIEW` sin resolver, con acciones aprobar/editar-y-aprobar/rechazar.
- Al aprobar con edición, el valor corregido queda en `outcome: "user_corrected"` — el campo que la tabla ya reserva para esto (reutilizable después para el dataset de "casos curados" del spec de RLHF reformulado, fuera de alcance aquí).

### Fuera de alcance

- Reentrenar o afinar ningún modelo a partir de las correcciones (eso es un spec propio: casos curados / dataset curado).
- Aplicar el mismo gate a BuildOps, Evidence o Crowd — sólo Marketplace.classifyJob en esta wave.
- Cambiar el umbral `SEMSE_JEV_MIN_CONFIDENCE` global compartido con `agent_router`/`vision_gate` — si se necesita un umbral propio para Marketplace, es una decisión de producto explícita, no una wave silenciosa (ver §3, sign-off).
- Notificaciones proactivas (SMS/push) cuando algo cae en la bandeja — la bandeja se consulta, no empuja, en esta wave.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| OPS_ADMIN | `ops:dashboard:read` | tenant propio | Ver la bandeja de revisión y el detalle de un evento | Aprobar/rechazar |
| OPS_ADMIN | `ops:dashboard:write` | tenant propio | Aprobar, editar-y-aprobar, rechazar un `JevDecisionEvent` pendiente | Editar eventos ya resueltos (inmutables tras decisión) |
| Sistema (Marketplace agent) | interno, sin actor humano | tenant del job | Escribir el `JevDecisionEvent`; en modo live, bloquear el dispatch aguas abajo | Auto-resolver un evento marcado `HUMAN_REVIEW` |

- Tenant boundary: todo query/mutación de `JevDecisionEvent` filtra por `tenantId` del actor (mismo patrón que el resto de `semse-agents.controller.ts`).
- Ownership/resource policy: no aplica ownership por usuario individual — es una superficie OPS, no de cliente/profesional.
- Step-up o aprobación humana: **es el propósito del spec** — todo evento `HUMAN_REVIEW` requiere una decisión explícita de un actor con `ops:dashboard:write`; nunca se auto-resuelve por timeout ni por reintento.
- Datos `privacyCritical`: no — el evento guarda clasificación de trabajo (trade, budget, urgencia), no PII sensible más allá de lo que ya expone `JobClassification`.
- Requisitos de auditoría: cada aprobar/rechazar dispara `AuditLog` con actor, `before`/`after` (clasificación original vs. corregida) y `correlationId` del `JevDecisionEvent` — mismo patrón que `audit_log` de Mission Control.

## 4. Escenarios y criterios de aceptación

### P1 — Clasificación de baja confianza en modo shadow (default)

```gherkin
DADO que SEMSE_JEV_ENABLED=true y SEMSE_JEV_MARKETPLACE_GATE_MODE=shadow (default)
CUANDO un cliente publica un job y MarketplaceAgent.classifyJob devuelve matchScore < 70
ENTONCES se crea un JevDecisionEvent con feature="marketplace_classify", mode="shadow", finalSystemAction="HUMAN_REVIEW"
Y el dispatch normal (ESTIMATE_REQUESTED, PROJECT_PLANNED) ocurre igual, sin bloqueo
Y el evento aparece en la bandeja de admin/agents como "revisado pero no bloqueante"
```

### P2 — Gate activo en modo live

```gherkin
DADO SEMSE_JEV_MARKETPLACE_GATE_MODE=live para el tenant en canary
CUANDO la clasificación cae bajo el umbral
ENTONCES Marketplace NO dispara ESTIMATE_REQUESTED ni PROJECT_PLANNED todavía
Y el job queda visible en la bandeja como "pendiente de revisión"
Y ningún profesional es notificado hasta que se resuelva
```

### P3 — Un OPS_ADMIN aprueba con corrección

```gherkin
DADO un JevDecisionEvent pendiente en modo live
CUANDO el admin edita el trade/budget propuesto y presiona "Aprobar con cambios"
ENTONCES el evento se marca outcome="user_corrected", se persiste el valor corregido
Y AHORA SÍ se disparan ESTIMATE_REQUESTED/PROJECT_PLANNED con la clasificación corregida
Y se registra un AuditLog con el diff clasificación-original vs. corregida
```

### P4 — Un OPS_ADMIN rechaza

```gherkin
DADO un JevDecisionEvent pendiente
CUANDO el admin presiona "Rechazar" con motivo
ENTONCES el job NO avanza a Protools/BuildOps
Y se registra el rechazo con motivo en AuditLog
Y el cliente ve el job en un estado que exige atención manual (fuera de alcance el copy exacto de ese estado — coordinar con el dueño de Jobs)
```

Casos borde:

- [ ] Doble aprobación del mismo evento (duplicado/reintento): la segunda llamada es no-op, responde `duplicate: true` — mismo patrón que `EVIDENCE_READINESS_CONSUMER`.
- [ ] `SEMSE_JEV_ENABLED=false`: el gate nunca se evalúa, Marketplace se comporta exactamente como hoy (comportamiento por defecto sin cambios, igual que el resto del Jev layer).
- [ ] Aislamiento cross-tenant: un admin de tenant A no puede ver ni resolver eventos de tenant B — test explícito, mismo patrón que el resto de `ops:dashboard:*`.
- [ ] Canary parcial: sólo tenants en `SEMSE_JEV_CANARY_TENANT_IDS` entran en modo live; el resto queda en shadow aunque el flag global esté en `live`.

## 5. Contratos

### API — `POST /v1/agents/semse/review/:eventId/approve`

```yaml
auth: required
permissions: ["ops:dashboard:write"]
input_schema:
  override: { trade?: string, suggestedBudgetMin?: number, suggestedBudgetMax?: number, urgency?: string }
output_schema:
  eventId: string
  outcome: "user_corrected" | "user_saved"
  dispatched: boolean
errors:
  400: "override inválido"
  403: "permiso insuficiente o tenant no coincide"
  404: "evento no encontrado o ya resuelto"
  409: "evento ya resuelto por otro actor (duplicate: true, no-op)"
effects:
  audit_log: "ops.jev.marketplace_gate.approved"
  domain_event: null
  sse: "agents:system → agent:message (marketplace, resumed after review)"
  payment_governance: "no aplica — no mueve dinero"
```

### API — `POST /v1/agents/semse/review/:eventId/reject`

```yaml
auth: required
permissions: ["ops:dashboard:write"]
input_schema:
  reason: string (requerido)
output_schema:
  eventId: string
  outcome: "rejected"
errors:
  400: "reason faltante"
  403: "permiso insuficiente o tenant no coincide"
  404: "evento no encontrado o ya resuelto"
effects:
  audit_log: "ops.jev.marketplace_gate.rejected"
  domain_event: null
  sse: "agents:system → agent:error (motivo del rechazo)"
  payment_governance: "no aplica"
```

### API — `GET /v1/agents/semse/review?status=pending`

```yaml
auth: required
permissions: ["ops:dashboard:read"]
input_schema: { status?: "pending" | "resolved", limit?: number }
output_schema:
  items: "JevDecisionEvent[] (feature=marketplace_classify)"
errors:
  403: "permiso insuficiente"
effects:
  audit_log: null
  domain_event: null
  sse: null
  payment_governance: "no aplica"
```

### UI

```yaml
surfaces:
  - "admin/agents/page.tsx — nueva sección 'Revisión pendiente' entre el live feed y el Playground"
states:
  - loading
  - empty  # "sin eventos pendientes"
  - ready
  - forbidden  # actor sin ops:dashboard:write ve solo lectura
  - degraded  # SEMSE_JEV_ENABLED=false → sección oculta, no rota
  - error
required_behavior:
  - "cada fila muestra: descripción original, clasificación propuesta, confidence, y los 3 botones (aprobar / editar-y-aprobar / rechazar)"
  - "editar-y-aprobar abre el mismo formulario del Playground precargado con los valores propuestos"
  - "resuelto = desaparece de 'pendiente', queda consultable en un historial simple (no en esta wave: paginación completa)"
```

### Agente/Prometeo

```yaml
tools: []
input_schema: "JobClassification (existente, sin cambios de forma)"
output_schema: "DecisionOutcome<'AUTO_PROCEED' | 'HUMAN_REVIEW'> (Jev Decision Layer, tipo existente)"
source_citations_required: false
approval_policy: "human_required cuando finalSystemAction=HUMAN_REVIEW y mode=live; none en shadow"
forbidden_behavior:
  - "Marketplace nunca decide sobre pagos, evidencia ni disputas (ya vigente, sin cambios)"
  - "el gate nunca auto-aprueba por confianza alta reportada por el propio Jev — sólo decide shadow vs. block, la aprobación siempre es humana cuando aplica"
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno de los FSM existentes cambia de forma; se añade un estado implícito "pendiente de revisión" al ciclo de vida del job, expresado como ausencia de `PROJECT_PLANNED`/`ESTIMATE_REQUESTED` hasta la resolución — no se introduce una nueva máquina de estados formal en esta wave.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` — verificar que ninguna invariante existente asuma que `PROJECT_PUBLISHED` siempre dispara el resto de la cadena de forma síncrona (hoy sí lo asume; este spec introduce la primera excepción legítima).
- Eventos declarados: `docs/foundation/EVENT_CATALOG.md` — no se añaden domain events nuevos (el bus de `semse-agents` no es el domain-event/outbox system); si se decide correlacionar con el outbox más adelante, es un spec aparte.
- Productor + outbox atómico: no aplica — `JevDecisionEvent` se escribe directo vía Prisma, mismo patrón que hoy usa `decision-eval.ts` para `agent_router`/`vision_gate`.
- Consumidores + idempotencia: `approve`/`reject` son idempotentes por `eventId` (ver caso borde de doble aprobación).
- Replay/rebuild: no aplica — no hay proyección derivada de este evento en esta wave.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: **ninguno nuevo** — `JevDecisionEvent` ya existe (`packages/db/prisma/schema.prisma:5055`) con todos los campos necesarios (`feature`, `confidence`, `outcome`, `finalSystemAction`, `costUsd`). El único cambio de datos es un nuevo valor de `feature` (`"marketplace_classify"`), que al ser `String` no requiere migración de schema.
- Migración: no aplicable (ver arriba).
- Estrategia expand/contract: no aplica.
- Backfill: no aplica — no hay eventos históricos que reclasificar retroactivamente.
- Compatibilidad hacia atrás: total — el registro cerrado `DECISION_FEATURES` gana una entrada, no modifica las existentes (`agent_router`, `vision_gate` siguen intactas, mismo patrón que exige `decision.types.ts`: "Adding one is a spec change and a new wave").
- Verificación de drift: `pnpm spec:validate:strict` tras indexar este spec.
- Rollback de código: revert del PR; `SEMSE_JEV_MARKETPLACE_GATE_ENABLED` en `false` (default) ya deja el sistema exactamente como hoy sin necesitar revert.
- Rollback/forward-fix de datos: no aplica (sin migración).

> Nunca usar `prisma db push` para producción. Una migración aplicada no se
> edita: se restaura el archivo exacto o se reconcilia con el flujo oficial.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: tasa de eventos `HUMAN_REVIEW` sobre total de clasificaciones (para calibrar si `SEMSE_JEV_MIN_CONFIDENCE` es el umbral correcto para Marketplace específicamente); tiempo medio hasta resolución humana.
- Logs/traces/correlation: reutiliza `correlationId` ya presente en `JevDecisionEvent` y en `SemseAgentMessage`.
- Health/readiness: no introduce nuevo servicio ni dependencia externa — la bandeja lee de Postgres, ya monitoreado.
- Feature flags/allowlists: `SEMSE_JEV_MARKETPLACE_GATE_ENABLED` (apagado por defecto), `SEMSE_JEV_MARKETPLACE_GATE_MODE` (shadow por defecto), reutiliza `SEMSE_JEV_CANARY_TENANT_IDS`/`_USER_IDS`/`_ROLES`/`_PERCENT` ya existentes del layer.
- Plan de canary: shadow global primero (sólo observabilidad, cero riesgo) → live sólo en `tenant_default` → live general tras revisar la tasa de `HUMAN_REVIEW` en shadow durante al menos una semana de tráfico real.
- Evidencia de producción requerida: conteo de eventos `HUMAN_REVIEW` en shadow + al menos un ciclo completo aprobar/rechazar en modo live sobre `tenant_default`.
- Señal de rollback: tasa de `HUMAN_REVIEW` sospechosamente alta (>50%) indicaría umbral mal calibrado, no bug — señal para ajustar `SEMSE_JEV_MIN_CONFIDENCE` antes de expandir canary, no para revertir código.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [ ] Unitarios: nueva entrada `marketplace_classify` en `DECISION_FEATURES` no rompe `agent_router`/`vision_gate` (registro cerrado, tipado).
- [ ] Contrato API/BFF: `approve`/`reject`/`GET review` — schema, permisos, forma de respuesta.
- [ ] Permiso denegado y aislamiento tenant/org: actor sin `ops:dashboard:write` no puede resolver; actor de otro tenant no ve el evento.
- [ ] Validación y conflicto de estado: aprobar un evento ya resuelto → 409 `duplicate: true`.
- [ ] Idempotencia/reintento/concurrencia: doble `approve` concurrente sobre el mismo `eventId` resuelve una sola vez.
- [ ] Migración y compatibilidad: no aplica (sin migración) — sí verificar que `feature: "marketplace_classify"` no rompe queries existentes filtradas por `feature IN ('agent_router','vision_gate')` si las hay.
- [ ] UI loading/empty/forbidden/degraded/error: los 6 estados de la sección "Revisión pendiente".
- [ ] Canary o smoke autenticado en producción: ciclo completo shadow→evento visible, y live→bloqueo real sobre `tenant_default`.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/ai-models/decision/decision.types.ts` — nueva entrada en `DECISION_FEATURES`.
- `apps/api/src/modules/ai-models/decision/decision-flags.ts` — nuevos flags `SEMSE_JEV_MARKETPLACE_GATE_ENABLED`/`_MODE`.
- `apps/api/src/modules/semse-agents/marketplace.agent.ts` — evaluar el gate antes de dispatch; escribir `JevDecisionEvent`.
- `apps/api/src/modules/semse-agents/semse-agents.controller.ts` — endpoints `review`, `review/:id/approve`, `review/:id/reject`.

### Web

- `apps/web/app/api/semse/agents/review/route.ts` (nuevo, BFF).
- `apps/web/app/api/semse/agents/review/[eventId]/approve/route.ts`, `.../reject/route.ts` (nuevos, BFF).
- `apps/web/app/(app)/admin/agents/page.tsx` — sección "Revisión pendiente".

### Worker/Packages/DB

- Sin cambios en `apps/worker` ni migración en `packages/db`.

### Tests

- `apps/api/test/jev-marketplace-gate.test.ts` (nuevo).
- `apps/api/test/semse-agents.test.ts` (extender con el caso de gate activo).

## 11. Investigación externa

- Reporte con tres búsquedas primarias: no aplica — esta wave reutiliza patrones 100% internos ya `APPROVED` (Jev Decision Layer, PrometeoProposedAction); no se introduce ningún proveedor ni librería externa nueva.
- Aplicado ahora: n/a.
- Backlog: si se decide notificar proactivamente (SMS/push) cuando algo cae en la bandeja, ahí sí correspondería investigar proveedor (fuera de alcance, ver §2).
- Descartado: construir un sistema de revisión paralelo al Jev Decision Layer — se descarta explícitamente por duplicar gobernanza ya `APPROVED`.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado (n/a, sin migración)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`

## 13. Nota de implementación (post-código, 2026-09-26)

Escrita después de implementar, para que el spec no quede desincronizado con el código real (Artículo XII).

- **Desviación deliberada de §5/§7**: el gate NO llama a `DecisionLayerService.decide()`. Ese método está diseñado para pedirle una segunda opinión a Jev (LLM externo) sobre un baseline determinístico, con su propia máquina de circuit-breaker/provider/canary. La decisión AUTO_PROCEED/HUMAN_REVIEW de esta wave ya es 100% determinística (`matchScore` vs. `SEMSE_JEV_MIN_CONFIDENCE`) — no hay ninguna pregunta que hacerle a un LLM. En cambio, `marketplace-confidence-gate.ts` (función pura, sin DI, sin red) reutiliza `isFeatureActive`/`resolveCanary`/`config.minConfidence` del mismo `decision-flags.ts`, y persiste directo vía `DECISION_TELEMETRY` (el mismo repositorio Prisma detrás de `decide()`). Esto significa que el flujo shadow de esta wave **no requiere credenciales de Jev AI configuradas** para producir telemetría — una diferencia real respecto a `agent_router`/`vision_gate`, que si las requieren.
- **`JevDecisionEvent.inputClass` reutilizado como payload pendiente**: para poder reanudar el dispatch retenido al aprobar, se serializa un JSON compacto (`jobId`, `projectId`, `originalPayload`, `classification`) en `inputClass` en vez de crear una tabla nueva (evita migración). Es un uso más allá de su comentario original ("short telemetry label"); si esta wave gradúa a `live` general, una columna JSON dedicada sería más limpio.
- **Gap conocido**: no hay test de contrato HTTP de punta a punta para los 3 endpoints nuevos (`GET review`, `approve`, `reject`) — la cobertura actual ejercita los métodos del agente (`listPendingReviews`/`approveReview`/`rejectReview`) directamente, no a través del controller/BFF. Ver tasks.md T-034.
- **Hallazgo no relacionado, reportado por separado**: `pnpm typecheck` del workspace completo y `pnpm --filter @semse/api build` fallan hoy en `main` por ~20 errores preexistentes en `@semse/schemas` (`AdminIntegrationId`/`AdminIntegrationStatus` no exportados) que afectan `admin-integrations.service.ts`, `admin.service.ts`, `apps/web/.../admin/settings/page.tsx` y varios archivos de `agro/`. No causado por esta feature, no arreglado aquí — código de esta wave verificado limpio de forma aislada (`grep` del output de `tsc` por los archivos tocados, cero coincidencias).
