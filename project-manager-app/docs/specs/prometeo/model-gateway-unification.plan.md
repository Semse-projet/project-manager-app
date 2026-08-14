---
type: plan
feature: "SPEC-GTW-001 — Unificación del Model Gateway"
domain: "prometeo"
spec: "docs/specs/prometeo/model-gateway-unification.spec.md"
version: "2.1"
status: "APPROVED"
branch: "feat/gtw-001-model-gateway-unification"
date: "2026-08-14"
---

# Plan técnico: SPEC-GTW-001 — Unificación del Model Gateway

> Prerrequisito: spec `APPROVED` (2026-08-14, PR #579 — clasificación de
> providers ya decidida). Este plan no modifica código; convierte el diseño
> de alto nivel del spec (§3-4) en pasos ejecutables, y resuelve una brecha
> de diseño concreta que el spec no especificaba (§3 de este plan).

## 1. Snapshot de verdad

- `origin/main` SHA: `25381275` (2026-08-14, verificado vía `git ls-remote`)
- SHA desplegado API / Web: **no verificado esta sesión** — Railway MCP sin
  autenticar (`railway login` requerido); no se asume ningún estado de
  producción sin evidencia real, por `docs/SDD_GOVERNANCE.md` §9.
- Estado de servicios: no verificado (mismo motivo).
- Estado de migraciones: **N/A** — este spec no toca `packages/db/prisma/schema.prisma`,
  es una reorganización de código de aplicación pura (routing/DI), sin
  columnas ni tablas nuevas.
- Flags/allowlists: ninguno existe todavía para este gateway — se define uno
  nuevo en Fase F (§7).
- Drift o deuda previa: la deuda que este plan cierra ya está descrita en el
  spec §2 completo (dos superficies de selección de modelo desincronizadas)
  — no hay drift adicional descubierto durante esta sesión de planificación.

## 2. Constitution check

- [x] Spec `APPROVED` antes de código (PR #579, 2026-08-14)
- [x] Tenant/org/ownership y RBAC definidos — **N/A para este spec**: el
      gateway de modelos no tiene contexto de tenant/org propio, opera sobre
      el `AiGenerateRequest` que el caller ya arma con su propio contexto de
      autorización (sin cambios de RBAC en este plan)
- [ ] Evidence/Payment Governance revisados si aplica — N/A, este spec no
      toca evidencia ni pagos
- [x] Audit/events definidos para cambios críticos — **decisión de este
      plan (§6):** cada resolución de `resolveModel()` emite un log
      estructurado con `provider`/`modelSlug`/`taskType`/`routeReason`/
      `privacyLevel` — no un `AuditLog` de dominio (no es una transición de
      FSM ni un cambio de dato de negocio), consistente con cómo ya se
      loguea en `adaptive-router.ts`/`orchestrator.ts` hoy
- [x] Tests preceden implementación — ver Fase A (§7)
- [x] No se expone secreto ni se agrega backend paralelo — los 3 providers
      (DeepSeek/Kimi/GLM) reutilizan las env vars ya existentes
      (`DEEPSEEK_API_KEY`/`KIMI_API_KEY`/`GLM_API_KEY`/`GLM_BASE_URL`), sin
      variables nuevas
- [x] Código, CI, merge, deploy y activación se medirán por separado — flag
      de activación nuevo en Fase F, no reemplazo simultáneo (spec §4 paso 5)

## 3. Arquitectura y autoridad

- **Fuente de verdad de escritura:** N/A (sin persistencia nueva)
- **Read models/proyecciones:** N/A
- **Módulos afectados:** `apps/api/src/modules/ai-models/gateway`,
  `apps/api/src/modules/ai-models/router`, `apps/api/src/infrastructure/llm`
- **Contratos Zod:** ninguno nuevo — `AiGenerateRequest`/`AiGenerateResponse`
  son interfaces TypeScript planas, no schemas Zod, y no cambian de forma
  pública (ver brecha de diseño abajo, resuelta sin tocar el DTO)
- **API/BFF/UI:** sin cambios de superficie — este spec es interno al
  backend, ningún endpoint ni ruta BFF cambia de contrato
- **Worker/queues:** N/A
- **Agentes/tools:** los 16 agentes conversacionales (`/agents`, ver
  `pro-flows-remediation.spec.md` G-PRO-05) siguen llamando
  `AiModelGatewayService` igual que hoy — cero cambio de superficie para
  ellos, el cambio es interno a la fachada
- **ADR requerido:** no — este plan implementa `ADR-023` §2.3 ítem 1, ya
  aprobado; no introduce una decisión de arquitectura nueva

### Brecha de diseño resuelta en este plan (no estaba en el spec)

El spec dice "el `taskType` real llega al `AdaptiveRouter`" (§3, §6) sin
especificar el mapeo — investigado en esta sesión de planning:

`AiGenerateRequest` (el DTO que arma cada caller — `assistant.service.ts`,
`browser-agent.service.ts`, `contractor-estimate.service.ts`,
`receipt-ocr.service.ts`, `budget-intelligence.service.ts`,
`labor-chat.service.ts`, `ai-models.controller.ts`) y
`CopilotRoutingContext` (lo que `AdaptiveRouter`/`LLMOrchestrator` consumen)
son **formas incompatibles hoy**:

| Campo `AiGenerateRequest` | Campo `CopilotRoutingContext` | Mapeo propuesto |
|---|---|---|
| `taskType: AiTaskType` (19 valores de dominio: `construction_contract_analysis`, `risk_analysis`, `code_generation`, etc.) | `taskType?: TaskType` (6 valores genéricos: `chat`\|`tool_use`\|`high_risk_action`\|`low_risk_action`\|`search`\|`unknown`) | **No se mapea 1:1.** Se deja `ctx.taskType` sin setear y se deja que `AdaptiveRouter.inferTaskType()` lo derive de `riskLevel`/`requiresTools` (mismo mecanismo que ya existe, hoy sub-utilizado porque `ai-model-gateway.service.ts:115-134` nunca pasa esos campos). El valor de `AiTaskType` se usa **solo** para elegir el slug candidato (`AiModelRouterService.selectRoute()`, sin cambios), no para gating. |
| `privacyLevel?: AiPrivacyLevel` (`local_only`\|`internal`\|`standard_external`\|`sensitive`\|`restricted`) | `localOnly?: boolean`, `privacyCritical?: boolean` | `privacyLevel === "local_only"` → `localOnly: true`. `privacyLevel === "sensitive" \| "restricted"` → `privacyCritical: true`. `"internal"`/`"standard_external"` → ninguno de los dos (comportamiento actual, sin restricción de privacidad). |
| `requiredCapabilities?: AiModelCapability[]` (incluye `"tool_use"` como capability) | `requiresTools?: boolean` | `requiredCapabilities?.includes("tool_use")` → `requiresTools: true` |
| — (no existe hoy) | `riskLevel?: "low"\|"medium"\|"high"` | **Decidido (owner, 2026-08-14):** `AiTaskType` ∈ `{construction_contract_analysis, permit_compliance, risk_analysis, bid_analysis, estimate_review}` → `riskLevel: "high"`. Los otros 14 valores de `AiTaskType` (`general_chat`, `project_planning`, `field_report_generation`, `rfi_generation`, `predictive_maintenance`, `code_generation`, `architecture_review`, `rag_answer`, `document_summary`, `training_data_generation`, `model_evaluation`, `receipt_ocr`, `invoice_generation`, `submittal_review`) quedan en riesgo normal — pueden resolver a cualquier provider habilitado, incluidos DeepSeek/Kimi/GLM-cloud, sujeto solo al resto de hard constraints (`privacyLevel`, `requiresTools`). Este mapeo vive como una función pura (`taskTypeImpliesHighRisk(taskType: AiTaskType): boolean`) en el mismo módulo que `resolveModel()`, no como una tabla de datos externa — cambiarlo es una decisión de producto, debe requerir el mismo nivel de revisión que esta, no un edit silencioso. |

Esta tabla es el contenido real de "Extender `AdaptiveRouter`... con la
clasificación real de estos providers" (spec §4 paso 2) a nivel de mapeo de
contexto, no solo de clasificación de provider.

## 4. Datos y migración

- Cambio Prisma: ninguno
- SQL y checksum: N/A
- Expand/contract: N/A
- Backfill/shadow read: N/A
- Compatibilidad durante deploy: sin cambios de esquema, deploy estándar
- Pre-deploy command: ninguno
- Rollback o forward-fix: revertir el flag de activación (Fase F) es
  suficiente — ningún dato persistido cambia de forma
- Prueba de migración: N/A

## 5. Seguridad y política

- **Permisos:** sin cambios — el gateway no gatea por rol, los callers ya
  aplican su propio `@RequirePermissions` antes de llegar acá
- **Tenant/org/resource scope:** N/A, el gateway no lee ni escribe datos de
  tenant
- **Step-up/aprobación:** N/A
- **Auditoría:** logging estructurado por resolución (ver §2 arriba), no
  `AuditLog` de dominio
- **Riesgos de pagos/evidencia:** ninguno directo — pero **`receipt-ocr.service.ts`**
  y **`budget-intelligence.service.ts`** son callers reales de
  `executeWithSlug()` con impacto de negocio (OCR de recibos, estimados de
  presupuesto) — deben quedar en la matriz de pruebas de regresión de Fase D,
  no solo los agentes conversacionales
- **Abuse cases:** un fallback mal configurado no debe poder degradar
  silenciosamente de un provider `PRIVATE`/`RISK_SAFE` a uno que no lo es —
  cubierto por el criterio de aceptación del spec ("nunca resuelve a un
  provider fuera de `PRIVATE`, sin importar el `taskType`"), verificado con
  test dirigido en Fase A

## 6. Eventos, idempotencia y reconstrucción

- **Productores:** ninguno — este spec no emite domain events
- **Outbox atómico:** N/A
- **Consumers/receipts:** N/A
- **Replay:** N/A
- **DLQ:** N/A
- **Rebuild:** N/A
- **Correlation/traces:** cada llamada a `resolveModel()` debe loguear
  `routingReason`/`source`/`agentName` (campos que `CopilotRoutingContext`
  ya tiene) para poder rastrear qué caller disparó qué decisión — sin
  infraestructura nueva, solo asegurar que `AiModelGatewayService` los
  propague en vez de dejarlos `undefined` (hoy no los setea)

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Tests rojos derivados de los 5 criterios de aceptación del spec (§6):
  1. Ningún slug (`deepseek-*`/`kimi-k2`/`glm-*`) ejecuta sin pasar por
     `ProviderMetricsStore` — test de integración que registra los 3
     providers en `LLMOrchestrator`, dispara `resolveModel()` + `chat()`, y
     verifica `ProviderMetricsStore.score()` fue consultado/actualizado
     para el slug real.
  2. `privacyCritical: true` u `localOnly: true` nunca resuelve fuera de
     `PRIVATE` — test parametrizado sobre los 9 slugs (`ollama-local`,
     `claude-sonnet`, `openai-gpt4`, `deepseek-chat`, `deepseek-reasoner`,
     `kimi-k2`, `glm-4`, `glm-ollama`, `template`), confirma que con
     `privacyLevel: "local_only"` o `"restricted"` el candidato resuelto
     está siempre en `{ollama, template, glm-ollama}` (los 3 miembros reales
     de `PRIVATE` tras el sign-off).
  3. El `taskType` real llega al `AdaptiveRouter` — test que verifica
     `ProviderMetricsStore` registra métricas bajo el `TaskType` genérico
     derivado (no siempre `"chat"`) para una request con
     `requiredCapabilities: ["tool_use"]`.
  4. Ningún `routeReason`/`fallbackUsed` se pierde — test de contrato sobre
     `AiGenerateResponse` antes/después para los 5 slugs que hoy van
     directo (deepseek/kimi/glm).
  5. Rollback por paso — no es un test automatizado, es una propiedad del
     diseño (cada paso de migración detrás de su propio punto de reversión
     explícito, ver Fase F).
- El test 2 se parametriza con los 5 `AiTaskType` decididos como
  `riskLevel: "high"` (tabla §3) cruzados contra los 3 providers no-`RISK_SAFE`
  (`deepseek-chat`/`deepseek-reasoner`, `kimi-k2`, `glm-4`) — confirma que
  ninguno de los 15 casos (5×3) resuelve a esos providers.
- Contratos: no se crean schemas Zod nuevos — se documenta el mapeo de
  tipos TypeScript de la tabla §3 como contrato interno (comentario en
  código + este plan), dado que `AiGenerateRequest`/`CopilotRoutingContext`
  son interfaces internas del backend, sin superficie pública.

### Fase B — Datos y dominio

- N/A — sin migración. La "Fase B" real de este spec es de servicio, no de
  dominio: implementar la función `resolveModel()` (spec §3) en
  `apps/api/src/modules/ai-models/gateway/` como el único punto de decisión,
  aplicando la tabla de mapeo de §3 de este plan antes de llamar a
  `AdaptiveRouter.applyHardConstraints()` (reutilizado, no reimplementado).
- Registrar `DeepSeekProvider`/`KimiProvider`/`GlmProvider` (los 5 slugs:
  `deepseek-chat`, `deepseek-reasoner`, `kimi-k2`, `glm-4`, `glm-ollama`) en
  `LLMOrchestrator.providers`, extendiendo el tipo `LLMProviderName` (hoy
  `"anthropic" | "openai" | "ollama" | "template"`, un union type — este
  cambio de tipo es el único "contrato" que realmente se modifica en este
  plan, y es aditivo).
- Extender `PRIVATE`/`RISK_SAFE`/`TOOL_CAPABLE` en `adaptive-router.ts` con
  la clasificación ya decidida (spec §5): `PRIVATE` gana `glm-ollama`;
  `RISK_SAFE`/`TOOL_CAPABLE` no ganan ningún miembro nuevo.

### Fase C — API/BFF/UI

- N/A — sin endpoint ni ruta BFF nueva. `AiModelGatewayService.executeWithSlug()`
  cambia de implementación interna (deja de instanciar providers propios,
  pasa siempre por `resolveModel()` + `llmOrchestrator.chat()`) pero
  mantiene su firma pública — los 8 callers listados en §5 no cambian una
  línea.
- Estados UX explícitos: N/A, sin UI.

### Fase D — Verificación local/CI

- Tests dirigidos (Fase A) + regresión explícita sobre los 8 callers reales
  de `executeWithSlug()` (§5) — con foco particular en
  `receipt-ocr.service.ts`/`budget-intelligence.service.ts` (impacto de
  negocio) y `labor-chat.service.ts` (ya tiene su propia suite,
  `labor-chat.service.test.ts`, según convención de este repo).
- Build/typecheck/lint: `pnpm --filter @semse/api build`, `pnpm typecheck`,
  `pnpm lint`.
- Spec tooling: `pnpm spec:validate:strict` tras mover este plan a
  `tasks.md`.

### Fase E — Integración

- Un PR por paso de migración (spec §4, 5 pasos) — no un PR único
  "big-bang", consistente con "sin big-bang" del propio spec y con el
  patrón ya usado esta sesión (un fix = un PR reversible).
- PR y checks, merge SHA, config/migración pre-deploy: se documentan por PR
  al momento de abrirlos, no en este plan (evita inventar SHAs que no
  existen todavía).

### Fase F — Producción

- **Flag nuevo:** `SEMSE_UNIFIED_MODEL_GATEWAY_ENABLED` +
  `SEMSE_UNIFIED_MODEL_GATEWAY_CANARY_TENANT_IDS`, mismo patrón
  `isXEnabled(tenantId, env)` ya usado en Mission Control/Identity/Originador
  esta sesión — apagado por defecto. Mientras esté apagado,
  `AiModelGatewayService` sigue con el comportamiento actual (ambas
  superficies desincronizadas); cuando se activa por tenant, pasa a usar
  `resolveModel()`.
- Deployment terminal / health / canary autenticado / métricas / activación
  gradual / rollback: se documentan al ejecutar Fase F real, no se inventan
  acá — este plan no autoriza activación en producción por sí mismo (mismo
  principio que el resto de flags de esta sesión: `no declarar VERIFIED sin
  activación y evidencia de producción`).

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Paso 4 (todas las ramas pasan por `llmOrchestrator.chat()`) degrada latencia/disponibilidad para todo el tráfico de IA simultáneamente (spec §5) | Media | Crítico — único punto de fallo | Flag de activación por tenant (canary), no reemplazo simultáneo; cada paso reversible por separado | Circuit breaker abre para múltiples providers a la vez / latencia p95 sube en `ProviderMetricsStore` tras activar el flag en un tenant canary |
| El mapeo de `AiTaskType`→`riskLevel` (tabla §3, decidido 2026-08-14) resulta incompleto en producción — un `AiTaskType` nuevo se agrega a `ai-task.types.ts` sin actualizar `taskTypeImpliesHighRisk()` | Baja-media | Alto — reabre el mismo bug que este spec cierra | `taskTypeImpliesHighRisk()` vive junto a `resolveModel()`, un solo archivo — agregar un test que falle si `AiTaskType` crece sin que la función lo mencione explícitamente (exhaustiveness check) | Auditoría manual de logs de `routeReason` post-activación, por tenant canary, antes de expandir |
| Callers con impacto de negocio (`receipt-ocr`, `budget-intelligence`) pierden un campo de `AiGenerateResponse` que no está en la lista ya identificada (`routeReason`/`fallbackUsed`) | Baja | Medio | Test de contrato explícito por caller en Fase D, no solo por los 2 campos ya conocidos | Test de regresión falla en CI antes de merge |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| N/A | — | Este plan es 100% investigación de código interno (spec §2 + esta sesión) — sin necesidad de research externa, mismo que el spec ya establecía |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (spec §2 + related_files, mapeo de §3
      de este plan)
- [x] Migración y rollback definidos — N/A migración; rollback = flag +
      reversión por paso
- [x] Tests ordenados antes del código (Fase A)
- [x] Canary/feature flag definidos (`SEMSE_UNIFIED_MODEL_GATEWAY_ENABLED`)
- [x] Evidencia requerida para cada estado de entrega — logging estructurado
      por resolución (§2/§6)
- [x] Scope cabe en un PR reversible — **no**, cabe en 5 PRs reversibles por
      separado (spec §4), documentado explícitamente en Fase E
- [x] Lista explícita de qué `AiTaskType` de dominio implican
      `riskLevel: "high"` — decidido por el owner 2026-08-14 (tabla §3):
      `construction_contract_analysis`, `permit_compliance`,
      `risk_analysis`, `bid_analysis`, `estimate_review`.

Todos los gates cerrados — listo para `/speckit.tasks`.
