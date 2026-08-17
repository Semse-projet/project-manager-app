---
id: "prometeo.model-gateway-unification"
title: "Unificación del Model Gateway (alias histórico SPEC-GTW-001)"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts
  - apps/api/src/modules/ai-models/router/ai-model-router.service.ts
  - apps/api/src/modules/ai-models/dto/ai-generate-request.dto.ts
  - apps/api/src/modules/ai-models/types/ai-model.types.ts
  - apps/api/src/infrastructure/llm/orchestrator.ts
  - apps/api/src/infrastructure/llm/router/adaptive-router.ts
  - apps/api/src/infrastructure/llm/router/routing-policy.ts
  - apps/api/src/infrastructure/llm/metrics/provider-metrics.store.ts
  - apps/api/src/infrastructure/llm/types.ts
  - apps/api/src/modules/ai-models/providers/deepseek.provider.ts
  - apps/api/src/modules/ai-models/providers/kimi.provider.ts
  - apps/api/src/modules/ai-models/providers/glm.provider.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-08-17"
---

# Spec: Unificación del Model Gateway

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

**Deriva de:** `docs/architecture/ADR-023-sense-agentic-architecture-v1.md`
§2.3 ítem 1 (`ACCEPTED`).
**Módulos afectados:** `apps/api/src/modules/ai-models/gateway`,
`apps/api/src/infrastructure/llm`.
**Alias histórico:** `SPEC-GTW-001`. Precede a F7 (Prometeo Multimodal);
condición previa de `prometeo.tool-result-multimodal` y
`prometeo.cache-control` (ver `docs/specs/agents/prometeo-core.spec.md` §4).

## 1. Problema y resultado

**Para quién:** cualquier caller interno de Prometeo (personas, agentes de
dominio, tools) que necesita ejecutar una llamada a LLM, y en particular
cualquier flujo marcado como sensible a privacidad.

**Problema:** hoy existen dos superficies de selección de modelo
independientes — `AiModelGatewayService` + `AiModelRouterService` por un
lado, `LLMOrchestrator` + `AdaptiveRouter` por otro — que **no comparten
circuit breaker, métricas ni enforcement de privacidad**. Peor aún
(hallazgo verificado en código, no asumido en la versión anterior de este
spec): existen **dos campos de privacidad distintos y no conectados entre
sí** en la base de código —`AiGenerateRequest.privacyLevel` (enum de 5
valores: `local_only | internal | standard_external | sensitive |
restricted`) del lado del gateway, y `CopilotRoutingContext.privacyCritical`
(booleano) del lado del orquestador — y solo el primero, y solo su valor
`"local_only"`, se verifica antes de resolver a DeepSeek/Kimi/GLM.

**Resultado esperado:** un único punto `resolveModel()` que decida
provider + slug para cualquier tarea — incluyendo DeepSeek, Kimi y GLM, hoy
fuera del alcance del orquestador adaptativo — sin perder ninguna garantía
que ya existe en cualquiera de los dos caminos actuales, y sin dejar
ninguno de los 5 valores de `privacyLevel` sin enforcement.

## 2. Alcance

### Incluido

- Un único `resolveModel()` que aplique hard constraints
  (`localOnly`/`privacyCritical`/`riskLevel`/`requiresTools`) antes de
  elegir slug.
- Registrar `DeepSeekProvider`, `KimiProvider`, `GlmProvider` (variantes
  chat/reasoner/ollama) en `LLMOrchestrator.providers`, para que pasen por
  `ProviderMetricsStore` (circuit breaker + score) igual que
  Anthropic/OpenAI/Ollama.
- Propagar el `taskType` real al `AdaptiveRouter` en el 100% de las rutas
  (hoy `ai-model-gateway.service.ts:130` hardcodea `taskType: "chat"` para
  las ramas Anthropic/OpenAI/Ollama).
- Reconciliar los dos campos de privacidad (`privacyLevel` de 5 valores vs.
  `privacyCritical` booleano) en una sola señal que ambos routers
  entiendan, o mapear explícitamente `privacyLevel` → `privacyCritical` en
  el punto de entrada único.

### Fuera de alcance

- Cambiar el proveedor por defecto de ningún `taskType` existente sin
  sign-off explícito (ver §5, bloqueado).
- Tocar `AdaptiveRouter.applyHardConstraints()` en su forma de aplicar
  restricciones — se reutiliza tal cual, no se reimplementa.
- Migrar datos — ningún modelo Prisma cambia en este spec.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Cualquier caller interno de Prometeo (persona, agente, tool) | ninguno nuevo — hereda el permiso ya evaluado para la acción que originó la llamada a LLM | sin scoping propio; el gateway no filtra por tenant, solo por request | Solicitar generación con una `taskType`/`privacyLevel` dados | Forzar un provider fuera de `PRIVATE` cuando `privacyLevel` es `local_only`, `sensitive` o `restricted` (una vez implementado este spec) |

- **Tenant boundary:** no aplica directamente — el gateway no persiste ni
  filtra por tenant; el aislamiento de datos ocurre en la capa que arma el
  `input`/`context` antes de llamar al gateway (`OperationalContextService`).
- **Ownership/resource policy:** no aplica — el gateway no es dueño de
  ningún recurso de negocio.
- **Step-up o aprobación humana:** ninguna en el gateway mismo — la
  aprobación humana, si aplica, ocurre en la capa de tools
  (`PrometeoProposedAction`), no aquí.
- **Datos `privacyCritical`:** es el objeto central de este spec — ver §5
  Estado real.
- **Requisitos de auditoría:** el gateway ya expone `routeReason` y
  `fallbackUsed` en `AiGenerateResponse`; este spec exige no perder esos
  campos al unificar (criterio de aceptación §6).

## 4. Estado real (verificado en código, 2026-08-17)

| Pieza | Qué hace hoy | Evidencia |
|---|---|---|
| `AiModelRouterService.selectRoute()` | Mapeo estático `taskType → modelSlug`; solo verifica `request.privacyLevel === "local_only"` (un valor de cinco) antes de las ramas por `taskType` — `sensitive`/`restricted`/`internal` no tienen ningún efecto en la selección | `ai-model-router.service.ts:14-24` |
| `AiGenerateRequest` | Tiene `privacyLevel?: AiPrivacyLevel` (5 valores). **No tiene** ningún campo `privacyCritical`. | `ai-generate-request.dto.ts:16` |
| `AiModelGatewayService.executeWithSlug()` | Para `deepseek-chat`/`deepseek-reasoner`/`kimi-k2`/`glm-4`/`glm-ollama`: llama al provider directo. **No pasa por `LLMOrchestrator`, `ProviderMetricsStore` ni `AdaptiveRouter`** | `ai-model-gateway.service.ts:88-113` |
| `AiModelGatewayService.executeWithSlug()` (resto) | Para `claude-sonnet`/`openai-gpt4`/`ollama-local`: delega en `llmOrchestrator.chat()`, pero hardcodea `taskType: "chat"` en el contexto — el `taskType` real (`code_generation`, `risk_analysis`, etc.) nunca llega al `AdaptiveRouter` | `ai-model-gateway.service.ts:119-134` |
| `LLMOrchestrator.chat()` | Usa `AdaptiveRouter.rank()` o `buildFallbackChain()`; `LLMProviderName` = `"anthropic" \| "openai" \| "ollama" \| "template"` — **DeepSeek/Kimi/GLM no existen como tipo en este archivo**, confirmando que nunca pueden pasar por aquí sin cambio de tipo | `orchestrator.ts:108-168`, `types.ts:5` |
| `LLMOrchestrator.chat()` — enforcement de privacidad | Sí revisa `ctx?.privacyCritical` (booleano) y quita providers cloud de la cadena | `orchestrator.ts:118-129` |
| `AdaptiveRouter.applyHardConstraints()` | Fuerza `localOnly`/`privacyCritical` → solo `PRIVATE` (ollama/template); `requiresTools` → solo `TOOL_CAPABLE`; `riskLevel: "high"` → solo `RISK_SAFE` | `adaptive-router.ts:51-82` |
| `routing-policy.buildFallbackChain()` | Quita `anthropic`/`openai` de la cadena si `localOnly`/`privacyCritical` | `routing-policy.ts:40-43` |

**Consecuencia real (corregida frente a la versión anterior de este spec):**
la versión anterior decía que una llamada con `privacyCritical: true`
"puede resolver a kimi-k2" — pero `AiGenerateRequest` no tiene ningún campo
`privacyCritical`; ese campo solo existe en `CopilotRoutingContext`, un
tipo distinto usado únicamente dentro de `LLMOrchestrator`/`AdaptiveRouter`.
El riesgo real y verificado es más preciso: una llamada con `taskType:
"construction_contract_analysis"` y `privacyLevel: "sensitive"` (o
`"restricted"`) — no solo `"local_only"` — resuelve a `kimi-k2` vía
`AiModelRouterService` sin pasar por ninguna verificación de
`AdaptiveRouter.applyHardConstraints()`, porque `AiModelRouterService` solo
conoce el valor `"local_only"` de las cinco posibilidades de `privacyLevel`,
y porque el gateway nunca traduce `privacyLevel` a `privacyCritical` para
que el orquestador lo entienda. No es una falla teórica: es la ruta de
código real para esos cinco slugs, y el gap de enforcement es más amplio
(3 de 5 niveles de privacidad, no solo el caso `privacyCritical: true`
del ejemplo original) que lo que la versión anterior de este documento
describía.

## 5. Bloqueado por decisión de producto: clasificación de providers

El diseño técnico (`resolveModel()` único, providers DeepSeek/Kimi/GLM
registrados en `LLMOrchestrator`, `taskType` real propagado) es correcto y
verificable, pero **no puede pasar a `APPROVED` sin una decisión de
negocio que el código no puede resolver**: qué clasificación
(`PRIVATE`/`RISK_SAFE`/`TOOL_CAPABLE`, ver `adaptive-router.ts:6-10`) le
corresponde a DeepSeek, Kimi y GLM (cloud y variante Ollama).

- Hoy `PRIVATE = {ollama, template}`, `RISK_SAFE = {anthropic, openai}`,
  `TOOL_CAPABLE = {anthropic, openai}` — ninguno de los tres conjuntos
  incluye DeepSeek/Kimi/GLM, porque esos providers nunca pasaron por este
  router.
- Decidir que DeepSeek/Kimi/GLM-cloud son `RISK_SAFE` o `TOOL_CAPABLE` es
  una decisión sobre qué proveedor externo puede ver qué tipo de dato de
  SEMSE (contratos de construcción, análisis de riesgo, código) — no una
  decisión técnica. Decidir que GLM-Ollama es `PRIVATE` es más directo
  (corre local) pero igual requiere confirmación explícita antes de
  codificarlo como regla dura.
- Sin esta clasificación, el paso 2 de la migración (§7) no se puede
  ejecutar de forma segura: `AdaptiveRouter.rankByScore()` fallaría
  silenciosamente a incluir estos providers en ningún conjunto restringido,
  lo que equivaldría a tratarlos como si no tuvieran ninguna restricción —
  el peor resultado posible para un spec `risk: critical`.

**Qué decisión falta y quién la toma:** el owner de `tool-governance.policy.ts`
y de la política de privacidad de datos de SEMSE (`semse-core`, con
sign-off explícito, no solo revisión de código) debe completar una tabla
equivalente a esta antes de que el spec pueda pasar a `APPROVED`:

| Provider | `PRIVATE` | `RISK_SAFE` | `TOOL_CAPABLE` | Sign-off |
|---|---|---|---|---|
| `deepseek-chat` / `deepseek-reasoner` | ? | ? | ? | pendiente |
| `kimi-k2` | ? | ? | ? | pendiente |
| `glm-4` (cloud) | ? | ? | ? | pendiente |
| `glm-ollama` | probablemente sí (corre local) | ? | ? | pendiente |

Hasta que esta tabla tenga sign-off, este spec permanece en `REVIEW`, no
`DRAFT` — el resto del contrato (diseño, migración, criterios de
aceptación) ya está completo y no tiene ambigüedad técnica pendiente.

## 6. Escenarios y criterios de aceptación

### P1 — Ninguna llamada DeepSeek/Kimi/GLM evita el circuit breaker

```gherkin
DADO un AiGenerateRequest con taskType "document_summary"
CUANDO el gateway resuelve a deepseek-chat
ENTONCES la llamada pasa por ProviderMetricsStore (circuit breaker + score)
Y una falla registra recordFailure() igual que Anthropic/OpenAI/Ollama hoy
```

### P2 — Ningún nivel de privacidad sensible escapa a un provider no-privado

```gherkin
DADO un AiGenerateRequest con privacyLevel "sensitive" o "restricted"
  (no solo "local_only")
CUANDO se resuelve el modelo, sin importar el taskType
ENTONCES resolveModel() nunca devuelve un provider fuera de PRIVATE
```

Casos borde:

- [ ] `taskType` con `forceModelSlug` presente — el override explícito debe
      seguir respetando `privacyLevel` (hoy `AiModelRouterService` retorna
      el slug forzado sin verificar privacidad en absoluto — gap adicional
      a cerrar, no mencionado en la versión anterior de este spec).
- [ ] Circuit abierto para todos los providers `PRIVATE` simultáneamente
      con `privacyLevel: "restricted"` — no debe hacer fallback silencioso
      a un provider cloud.
- [ ] `routeReason`/`fallbackUsed` deben seguir presentes en
      `AiGenerateResponse` para los 5 slugs Prometeo-nativos tras pasar por
      `llmOrchestrator.chat()`.

## 7. Contratos

### API

No hay endpoint HTTP nuevo — este spec cambia una función interna
(`resolveModel()`) consumida por `AiModelGatewayService.generate()`, que sí
es invocada indirectamente por `POST /v1/ai-models/prometeo/chat` y por
cualquier caller interno de Prometeo. Ningún contrato de request/response
externo cambia.

### UI

```yaml
surfaces: []
states: []
required_behavior: []
```

No aplica — cambio puramente de infraestructura backend.

### Agente/Prometeo

```yaml
tools: []
input_schema: AiGenerateRequest (sin cambio de forma; sí cambia interpretación de privacyLevel)
output_schema: AiGenerateResponse (sin cambio de forma)
source_citations_required: false
approval_policy: "none — cambio de infraestructura, no de política de negocio en sí (la clasificación de providers sí requiere sign-off, ver §5)"
forbidden_behavior:
  - Ningún slug ejecuta sin pasar por ProviderMetricsStore tras este spec.
  - Ningún privacyLevel sensible/restricted resuelve fuera de PRIVATE.
```

## 8. FSM, eventos y reconstrucción

No aplica — sin FSM de dominio afectado, sin eventos nuevos. El gateway de
modelos no es un agregado con estado persistente propio.

## 9. Datos y migración

- **Modelos Prisma:** ninguno.
- **Migración:** no aplica.
- **Estrategia expand/contract:** la migración de código (§10) es aditiva
  paso a paso — cada paso puede revertirse individualmente.
- **Backfill:** no aplica.
- **Compatibilidad hacia atrás:** `AiGenerateRequest`/`AiGenerateResponse`
  no cambian de forma; ningún caller externo necesita cambiar.
- **Verificación de drift:** §4 fue verificada línea por línea el
  2026-08-17.
- **Rollback de código:** cada paso de §10 es reversible por separado.
- **Rollback/forward-fix de datos:** no aplica.

## 10. Observabilidad, despliegue y activación

- **Métricas/SLO:** `ProviderMetricsStore` ya emite `avgLatencyMs`/
  `successRate`/`circuitState` por provider+taskType — tras este spec debe
  cubrir también DeepSeek/Kimi/GLM.
- **Logs/traces/correlation:** `LLMOrchestrator.logResult()` ya loggea
  `routingReason`/`score`/`successRate` — se extiende a los providers
  nuevos, sin cambio de formato.
- **Health/readiness:** `providerHealthSummary()` debe incluir DeepSeek/
  Kimi/GLM tras el paso 1 de §11.
- **Feature flags/allowlists:** el paso 5 de §11 (retirar instanciación
  directa) debe ir detrás de un flag de activación explícito, no un
  reemplazo simultáneo — regla ya declarada en el diseño original.
- **Plan de canary:** por paso, no big-bang — cada uno de los 5 pasos de
  §11 se activa y verifica independientemente antes del siguiente.
- **Evidencia de producción requerida:** confirmar en producción que
  ningún caller que hoy depende de `routeReason`/`fallbackUsed` para
  DeepSeek/Kimi/GLM pierde esos campos.
- **Señal de rollback:** aumento de tasa de error o latencia en cualquiera
  de los 5 slugs Prometeo-nativos tras el paso 4.
- **Owner operativo:** `semse-core`.

## 11. Tests requeridos

- [ ] Unitario: `resolveModel()` nunca devuelve provider fuera de `PRIVATE`
      para `privacyLevel` en `{local_only, sensitive, restricted}` — no
      solo `local_only` (corrige el criterio original, que solo probaba
      `privacyCritical: true`).
- [ ] Unitario: `forceModelSlug` sigue respetando `privacyLevel`.
- [ ] Contrato: los 5 slugs Prometeo-nativos pasan por
      `ProviderMetricsStore` (circuit breaker) tras el cambio.
- [ ] Idempotencia/reintento: fallback chain se comporta igual que hoy para
      Anthropic/OpenAI/Ollama.
- [ ] Migración y compatibilidad: `AiGenerateRequest`/`AiGenerateResponse`
      no cambian de forma (test de contrato, no solo de tipos).
- [ ] Canary o smoke autenticado en producción antes de `VERIFIED`.

## 12. Mapa de implementación

### Migración por pasos (aditiva, sin big-bang)

1. Registrar `DeepSeekProvider`, `KimiProvider`, `GlmProvider` (chat y
   reasoner/ollama variants) en `LLMOrchestrator.providers`, detrás de los
   mismos flags de entorno que ya usan (`DEEPSEEK_API_KEY`, `KIMI_API_KEY`,
   `GLM_API_KEY`/`GLM_BASE_URL`). Sin esto no hay circuit breaker posible
   para ellos.
2. Extender `AdaptiveRouter` (`TOOL_CAPABLE`/`RISK_SAFE`/`PRIVATE`) con la
   clasificación real de estos providers — **bloqueado por §5**, no
   ejecutar sin la tabla firmada.
3. Mover la tabla de `AiModelRouterService.selectRoute()` a ser el insumo
   de capacidad/costo que `AdaptiveRouter.rankByScore()` combina con las
   métricas reales — no un router paralelo.
4. Cambiar `AiModelGatewayService.executeWithSlug()` para que **todas**
   las ramas pasen por `llmOrchestrator.chat()` con el `taskType` real (no
   `"chat"` fijo), y traducir `privacyLevel` → `privacyCritical`/`localOnly`
   en el punto de entrada.
5. Retirar la instanciación directa de providers en
   `AiModelGatewayService` solo después de que el paso 4 esté probado en
   paralelo (flag de activación, no reemplazo simultáneo).

### API

- `apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts`
- `apps/api/src/modules/ai-models/router/ai-model-router.service.ts`
- `apps/api/src/infrastructure/llm/orchestrator.ts`
- `apps/api/src/infrastructure/llm/router/adaptive-router.ts`
- `apps/api/src/infrastructure/llm/router/routing-policy.ts`

### Tests

- `apps/api/test/ai-models/*` (ubicación exacta a confirmar en `/speckit.tasks`)

## 13. Investigación externa

- No se realizó investigación externa nueva en esta revisión — el diseño
  reutiliza patrones ya vigentes en el propio repo (circuit breaker,
  hard-constraints router). Backlog: ninguno. Descartado: ninguno.

## 14. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado (ver §12,
      cada paso reversible)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Tabla de clasificación de providers (§5) firmada — **bloqueante para
      `APPROVED`, no solo para `VERIFIED`**
- [ ] Sólo entonces `status: VERIFIED`
