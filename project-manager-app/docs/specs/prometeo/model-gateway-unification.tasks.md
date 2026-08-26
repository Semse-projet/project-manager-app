---
type: tasks
feature: "SPEC-GTW-001 — Unificación del Model Gateway"
domain: "prometeo"
plan: "docs/specs/prometeo/model-gateway-unification.plan.md"
version: "2.2"
status: "PENDING"
branch: "feat/gtw-001-model-gateway-unification"
date: "2026-08-14"
---

# Tareas: SPEC-GTW-001 — Unificación del Model Gateway

> Prerrequisito: plan `APPROVED` (PR #580), spec `APPROVED` (PR #579), los
> 7 gates de plan §10 cerrados — incluida la decisión de producto de
> `riskLevel` por `AiTaskType` (2026-08-14).
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.
> **5 PRs, no uno solo** (plan §7 Fase E) — cada fase de abajo mapea a un
> PR reversible por separado, mismo orden que spec §4.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar spec `APPROVED` e indexado — PR #579, 2026-08-14
- [x] [T-002] Registrar SHA Git/producción, migraciones y flags actuales —
      plan §1: `origin/main` en `25381275`; SHA de producción **no
      verificado** (Railway MCP sin autenticar esta sesión, no se asume);
      sin migraciones (spec no toca Prisma); sin flags previos para este
      gateway
- [x] [T-003] Completar plan, análisis y checklist — plan `APPROVED` (PR
      #580); checklist pendiente de generar (T-004b abajo)
- [x] [T-004] Registrar investigación externa y decisiones — plan §9 (N/A,
      investigación 100% interna); decisión de clasificación de providers
      en spec §5 (PR #579); decisión de `riskLevel` por `AiTaskType` en
      plan §3 (PR #580)
- [ ] [T-004b] Generar `model-gateway-unification.checklist.md`
      (`.specify/templates/overrides/semse-checklist.md`) antes de tocar
      código — gate de calidad/entrega, no solo spec↔plan↔tasks

## Fase 1 — Tests y contratos (PR 1/5 — sin código de producción)

- [ ] [T-010] Test rojo: request con `privacyLevel: "local_only"` o
      `"restricted"` nunca resuelve fuera de `{ollama, template, glm-ollama}`
      — parametrizado sobre los 9 slugs reales (plan §7, criterio 2)
- [ ] [T-011] Test rojo: los 5 `AiTaskType` decididos como `riskLevel: "high"`
      (`construction_contract_analysis`, `permit_compliance`,
      `risk_analysis`, `bid_analysis`, `estimate_review`) nunca resuelven a
      `deepseek-chat`/`deepseek-reasoner`/`kimi-k2`/`glm-4` — 5×3 = 15 casos
      (plan §7, criterio 2 parametrizado)
- [ ] [T-012] [P] Test rojo: `requiredCapabilities: ["tool_use"]` deriva
      `requiresTools: true` en `CopilotRoutingContext` (mapeo mecánico,
      plan §3)
- [ ] [T-013] [P] Test rojo: ningún slug (`deepseek-*`/`kimi-k2`/`glm-*`)
      ejecuta sin pasar por `ProviderMetricsStore.score()`/`isCircuitOpen()`
      (plan §7, criterio 1)
- [ ] [T-014] [P] Test rojo: una request sin `taskType` genérico explícito
      no cae siempre en `"chat"` para métricas — el bucket se deriva de
      `riskLevel`/`requiresTools` vía `AdaptiveRouter.inferTaskType()`
      (plan §7, criterio 3)
- [ ] [T-015] Confirmar que los 4 fallos anteriores demuestran el gap real
      (no un error de compilación/import) — correr contra el código actual
      sin `resolveModel()` implementado todavía

## Fase 2 — Dominio: `resolveModel()` y registro de providers (PR 2/5)

- [ ] [T-020] **N/A migración Prisma** — spec no toca `packages/db/prisma/schema.prisma`
- [ ] [T-021] Extender `LLMProviderName` (`apps/api/src/infrastructure/llm/types.ts`)
      con los 5 slugs nuevos: `deepseek-chat`, `deepseek-reasoner`,
      `kimi-k2`, `glm-4`, `glm-ollama` — único cambio de tipo de este spec,
      aditivo (plan §7 Fase B)
- [ ] [T-022] Registrar `DeepSeekProvider`/`KimiProvider`/`GlmProvider` en
      `LLMOrchestrator.providers`, detrás de los flags de entorno ya
      existentes (`DEEPSEEK_API_KEY`/`KIMI_API_KEY`/`GLM_API_KEY`/`GLM_BASE_URL`)
      — sin variables nuevas (spec §4 paso 1)
- [ ] [T-023] Extender `PRIVATE`/`RISK_SAFE`/`TOOL_CAPABLE` en
      `adaptive-router.ts`: `PRIVATE` gana `glm-ollama`; `RISK_SAFE`/
      `TOOL_CAPABLE` sin cambios (decisión spec §5, 2026-08-14)
- [ ] [T-024] Implementar `taskTypeImpliesHighRisk(taskType: AiTaskType): boolean`
      como función pura junto a `resolveModel()` — los 5 valores decididos,
      con exhaustiveness check para que un `AiTaskType` nuevo sin mención
      explícita falle en compilación, no en producción (plan §8, mitigación
      del riesgo de mapeo incompleto)
- [ ] [T-025] Implementar `resolveModel()` en
      `apps/api/src/modules/ai-models/gateway/`: arma `CopilotRoutingContext`
      desde `AiGenerateRequest` vía la tabla de mapeo (plan §3) —
      `privacyLevel→localOnly/privacyCritical`, `requiredCapabilities→requiresTools`,
      `taskTypeImpliesHighRisk()→riskLevel`; reutiliza
      `AdaptiveRouter.applyHardConstraints()` sin reimplementarlo; devuelve
      cadena `primary → fallback → template` (spec §3)
- [ ] [T-026] [P] Mover la tabla de `AiModelRouterService.selectRoute()` a
      ser insumo de capacidad/costo para `AdaptiveRouter.rankByScore()`, no
      un router paralelo (spec §4 paso 3)
- [ ] [T-027] Pasar T-010 a T-014 (verdes)

## Fase 3 — Integración: `AiModelGatewayService` (PR 3/5, detrás de flag)

- [ ] [T-030] **N/A endpoint nuevo** — sin cambio de superficie API/BFF
      (plan §3, "API/BFF/UI: sin cambios")
- [ ] [T-030a] Implementar `isUnifiedModelGatewayEnabled(tenantId, env)` —
      mismo patrón `SEMSE_X_ENABLED`/`SEMSE_X_CANARY_TENANT_IDS` ya usado
      esta sesión (Mission Control/Identity/Originador). **Este es el
      código real detrás de "PR 4/5: flag" (Fase 6) — la propia activación
      en Fase 6 es solo flipear el env var, no escribir el check.**
- [ ] [T-031] Cambiar `AiModelGatewayService.executeWithSlug()` para que,
      **cuando `isUnifiedModelGatewayEnabled()` sea `true` para el tenant
      del caller**, todas las ramas (incluidas `deepseek-*`/`kimi-k2`/
      `glm-*`) pasen por `resolveModel()` + `llmOrchestrator.chat()`, con
      el `taskType` real propagado — no `"chat"` fijo (spec §4 paso 4).
      **Cuando el flag esté apagado, se preserva el comportamiento actual
      sin cambios** (las dos ramas de `executeWithSlug()` tal como existen
      hoy) — sin esto, el flag de Fase 6 no tendría ningún código que
      gatear y la migración sería big-bang pese a que plan §7/spec §4
      paso 5 dicen explícitamente lo contrario. **(Corrección 2026-08-14,
      ver nota de /speckit.analyze abajo — T-031 originalmente no
      mencionaba el flag.)**
- [ ] [T-032] **N/A UI** — sin superficie de usuario nueva; los 16 agentes
      conversacionales y los 8 callers de `executeWithSlug()` (plan §3,
      §5) mantienen su firma pública sin cambios
- [ ] [T-033] Confirmar que `routingReason`/`source`/`agentName` se
      propagan a `CopilotRoutingContext` en vez de quedar `undefined`
      (plan §6, trazabilidad)
- [ ] [T-034] Pasar tests de contrato: `routeReason`/`fallbackUsed` no se
      pierden en `AiGenerateResponse` para ninguno de los 8 callers reales
      (plan §7, criterio 4) — foco explícito en `receipt-ocr.service.ts` y
      `budget-intelligence.service.ts` (impacto de negocio, plan §5)

## Fase 4 — Verificación local (aplica a los 3 PRs de código, 2/5 y 3/5)

- [ ] [T-040] Tests dirigidos: los 5 criterios de aceptación del spec (§6)
      + T-010 a T-014
- [ ] [T-041] Regresión: los 8 callers de `executeWithSlug()` (§5) —
      `assistant.service.ts`, `browser-agent.service.ts`,
      `contractor-estimate.service.ts`, `receipt-ocr.service.ts`,
      `budget-intelligence.service.ts`, `labor-chat.service.ts`,
      `ai-models.controller.ts`
- [ ] [T-042] `pnpm --filter @semse/api build` / `pnpm typecheck` / `pnpm lint`
- [ ] [T-043] `pnpm spec:validate:strict`
- [ ] [T-044] `pnpm spec:coverage` y `pnpm spec:index`
- [ ] [T-045] Actualizar spec a `code_status: COMPLETE` y `status: IMPLEMENTED`
      — **no** `VERIFIED` todavía (sin activación/evidencia de producción)

## Fase 5 — PR, CI y merge (uno por cada fase de código — 2/5, 3/5)

- [ ] [T-050] Revisar diff y secretos — confirmar que ningún
      `DEEPSEEK_API_KEY`/`KIMI_API_KEY`/`GLM_API_KEY` real se filtra en
      logs/tests
- [ ] [T-051] Abrir PR con evidencia (sin migración, sin rollback de datos
      — rollback es el flag, plan §4)
- [ ] [T-052] Esperar CI terminal y registrar `ci_status` — recordar el
      bloqueo conocido de presupuesto de GitHub Actions esta sesión;
      verificación local completa sustituye mientras eso siga bloqueado
- [ ] [T-053] Resolver review sin ampliar scope — especialmente no adelantar
      Fase F (activación) dentro de estos PRs
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`

## Fase 6 — Deploy y activación (PR 4/5: ninguna — solo config; PR 5/5: retiro de instanciación directa)

> **PR 4/5 no tiene código propio** — el check `isUnifiedModelGatewayEnabled()`
> ya se escribió y mergeó en Fase 3 (T-030a, PR 3/5). "PR 4/5" en el conteo
> del spec/plan es en realidad una acción de configuración (flipear el env
> var en Railway), no un PR de código — aclarado acá tras encontrar la
> inconsistencia en `/speckit.analyze` (ver nota al final del documento).

- [ ] [T-060] **N/A pre-deploy/migración** — sin cambio de esquema
- [ ] [T-061] Esperar deployment terminal de `semse-API` (único servicio
      afectado — el gateway es interno al backend)
- [ ] [T-062] Verificar health/readiness y logs — sin acceso a Railway
      verificado esta sesión, requiere reautenticación (`railway login`)
      antes de poder ejecutar este paso
- [ ] [T-063] Activar (no definir — ya definido en T-030a)
      `SEMSE_UNIFIED_MODEL_GATEWAY_ENABLED`/`SEMSE_UNIFIED_MODEL_GATEWAY_CANARY_TENANT_IDS`
      de forma gradual, un tenant canary primero (plan §7 Fase F) — **acción
      humana, no de agente**, mismo criterio ya aplicado esta sesión a
      Mission Control/Originador (`AGENTS.md`: no tocar variables de entorno
      de producción como agente)
- [ ] [T-064] Ejecutar smoke autenticado: al menos un caso real por
      combinación de gate (`privacyCritical`, `riskLevel: "high"`, tarea
      normal) contra el tenant canary
- [ ] [T-065] Validar métricas/SLO: latencia p95 de `ProviderMetricsStore`
      no se degrada tras activar; circuit breaker no abre para múltiples
      providers simultáneamente (plan §8, señal de rollback)
- [ ] [T-066] Promover a `ACTIVE` (más tenants) o revertir/pausar el flag
      según T-065
- [ ] [T-067] Recién entonces: retirar la instanciación directa de
      providers en `AiModelGatewayService` (spec §4 paso 5 — el único paso
      no reversible sin volver a instanciar, por eso va último y separado);
      registrar `production_evidence`, `last_verified` y `status: VERIFIED`

## Criterio de Done

- [ ] Código completo y tests verdes (T-010 a T-041)
- [ ] CI `PASS` en los 3 PRs de código (2/5, 3/5, 5/5)
- [ ] Merge `MERGED` en los 5 PRs
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` primero, `ACTIVE` solo tras T-065 sin señal de
      rollback
- [ ] Migración `NOT_APPLICABLE`
- [ ] `production_evidence` enlazada (T-067) — no inferida de código, merge
      o deploy
- [ ] `SPEC_INDEX.md`/`IMPLEMENTATION_STATUS_MATRIX.md`/`ROADMAP.md`
      actualizados si esto pasa a formar parte de un hito de roadmap visible

## `/speckit.analyze` — consistencia spec↔plan↔tasks↔constitución (2026-08-14)

Pase real de verificación, no solo re-lectura — un hallazgo cambió este
documento:

- **Artículos I, II, VI, VII, VIII, X, XI, XIII de la constitución:**
  consistentes. Artículo VIII (privacy routing) es el propósito central de
  este spec, no solo cumplido incidentalmente. Artículo VII (multi-tenant):
  el gateway en sí no tiene contexto de tenant (correcto, no es un query de
  datos), pero el flag de activación sí es tenant-scoped
  (`_CANARY_TENANT_IDS`, T-030a/T-063) — el artículo se satisface ahí, no
  por irrelevancia.
- **Artículos III, IV, V, IX:** N/A confirmado — sin evidencia, sin
  liberación de fondos, sin transición de FSM, sin datos mock. Ninguno
  contradicho.
- **Hallazgo real — plan↔tasks inconsistentes (corregido):** el plan (§4,
  §7 Fase F) diseña explícitamente un flag de activación gradual porque
  "un error [en cambiar `executeWithSlug()`] puede degradar latencia/
  disponibilidad... para todos los agentes simultáneamente" (spec §5). La
  primera versión de este documento (T-031) cambiaba `executeWithSlug()`
  de forma incondicional — sin flag, sin gate — sería big-bang pese a que
  spec §4 paso 5 y plan §7 Fase E dicen explícitamente lo contrario.
  **Corregido:** T-030a (escribir el check) agregado a Fase 3; T-031
  ahora gatea el cambio detrás de `isUnifiedModelGatewayEnabled()`,
  preservando el comportamiento actual cuando el flag está apagado; Fase 6
  aclarada para no duplicar "PR 4/5" como si tuviera código propio.
- **Hallazgo menor, no bloqueante:** `IMPLEMENTATION_STATUS_MATRIX.md` no
  referencia todavía `prometeo.model-gateway-unification` pese a ser
  `risk: critical` y preceder F7 (spec, "Fase Matriz"). No es una
  contradicción del spec/plan/tasks en sí — es trabajo de documentación
  pendiente, ya reflejado en el último ítem de "Criterio de Done" arriba.
  No se actualiza la matriz en este PR (nada se implementó todavía; hacerlo
  ahora sería documentar una capacidad que no existe en código).
