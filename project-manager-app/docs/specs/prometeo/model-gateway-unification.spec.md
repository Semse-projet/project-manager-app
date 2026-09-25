---
id: "prometeo.model-gateway-unification"
title: "SPEC-GTW-001 — Unificación del Model Gateway"
type: spec
domain: "prometeo"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-31"
related_files:
  - apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts
  - apps/api/src/modules/ai-models/router/ai-model-router.service.ts
  - apps/api/src/infrastructure/llm/orchestrator.ts
  - apps/api/src/infrastructure/llm/router/adaptive-router.ts
  - apps/api/src/infrastructure/llm/router/routing-policy.ts
  - apps/api/src/infrastructure/llm/metrics/provider-metrics.store.ts
  - apps/api/src/modules/ai-models/providers/deepseek.provider.ts
  - apps/api/src/modules/ai-models/providers/kimi.provider.ts
  - apps/api/src/modules/ai-models/providers/glm.provider.ts
related_tests:
  - apps/api/test/ai-model-router-privacy.test.ts
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-08-27"
---

# SPEC-GTW-001 — Unificación del Model Gateway

**Deriva de:** `ADR-023-sense-agentic-architecture-v1.md` §2.3 ítem 1
**Módulos afectados:** `apps/api/src/modules/ai-models/gateway`,
`apps/api/src/infrastructure/llm`
**Fase Matriz:** precede a F7 (Prometeo Multimodal); condición previa de
`SPEC-AGT-002` (ToolResult multimodal) y `SPEC-GTW-002` (cache control)

---

## 1. Propósito

Hoy existen dos superficies de selección de modelo (`AiModelGatewayService` +
`AiModelRouterService` por un lado, `LLMOrchestrator` + `AdaptiveRouter` por
otro) que no comparten circuit breaker, métricas ni enforcement de
privacidad. Este spec define un único punto `resolveModel()` que decida
provider + slug para cualquier tarea — incluyendo DeepSeek, Kimi y GLM, hoy
fuera del alcance del orquestador adaptativo — sin perder ninguna garantía
que ya existe en cualquiera de los dos caminos actuales.

## 2. Estado real (verificado en código, no supuesto)

| Pieza | Qué hace hoy | Evidencia |
|---|---|---|
| `AiModelRouterService.selectRoute()` | Mapeo estático `taskType → modelSlug` (p. ej. `construction_contract_analysis` → `kimi-k2`, `project_planning`/`code_generation` → `deepseek-reasoner`) | `ai-model-router.service.ts:14-80` |
| `AiModelGatewayService.executeWithSlug()` | Para `deepseek-chat`/`deepseek-reasoner`/`kimi-k2`/`glm-4`/`glm-ollama`: llama al provider directo. **No pasa por `LLMOrchestrator`, `ProviderMetricsStore` ni `AdaptiveRouter`** | `ai-model-gateway.service.ts:87-114` |
| `AiModelGatewayService.executeWithSlug()` (resto) | Para `claude-sonnet`/`openai-gpt4`/`ollama-local`: delega en `llmOrchestrator.chat()`, pero hardcodea `taskType: "chat"` en el contexto — el `taskType` real (`code_generation`, `risk_analysis`, etc.) nunca llega al `AdaptiveRouter` | `ai-model-gateway.service.ts:115-134` |
| `LLMOrchestrator.chat()` | Usa `AdaptiveRouter.rank()` (ranking por métricas + circuit breaker) o `buildFallbackChain()` estático; solo conoce providers Ollama/Anthropic/OpenAI/Template | `orchestrator.ts:108-168` |
| `AdaptiveRouter.applyHardConstraints()` | Fuerza `localOnly`/`privacyCritical` → solo providers `PRIVATE` (Ollama/Template); `requiresTools` → solo `TOOL_CAPABLE`; `riskLevel: high` → solo `RISK_SAFE` | `adaptive-router.ts:51-82` |
| `routing-policy.buildFallbackChain()` | Quita providers cloud de la cadena si `localOnly`/`privacyCritical` | `routing-policy.ts:40-43` |

**Consecuencia real:** una llamada con `taskType: "construction_contract_analysis"`
y `privacyCritical: true` puede resolver a `kimi-k2` vía
`AiModelRouterService` (que no conoce `privacyCritical`) y ejecutarse sin
pasar por ninguna de las verificaciones de `AdaptiveRouter.applyHardConstraints()`.
No es una falla teórica: es la ruta de código real para esos cinco slugs.

## 3. Diseño propuesto

```
AiGenerateRequest (taskType, riskLevel, privacyLevel, requiresVision, ...)
        │
        ▼
resolveModel()  ← única función de decisión
  1. Aplica hard constraints (localOnly/privacyCritical/riskLevel/requiresTools)
     — reutiliza AdaptiveRouter.applyHardConstraints(), no se reimplementa
  2. Resuelve slug candidato por capacidad/costo/latencia
     — reutiliza el mapeo de AiModelRouterService.selectRoute() como
       tabla de criterios, no como ejecutor
  3. Devuelve cadena ordenada primary → fallback → template
        │
        ▼
LLMOrchestrator.chat()  ← único ejecutor
  - Providers registrados: ollama, anthropic, openai, deepseek-chat,
    deepseek-reasoner, kimi-k2, glm-4, glm-ollama, template
  - Circuit breaker + métricas vía ProviderMetricsStore para TODOS
  - taskType real propagado (no hardcodeado a "chat")
```

`AiModelGatewayService` deja de instanciar providers propios y de llamar
directo a `executeWithSlug()` por slug; se convierte en una fachada delgada
que arma el `AiGenerateRequest`, llama a `resolveModel()` + `llmOrchestrator.chat()`,
y adapta la respuesta a `AiGenerateResponse`.

## 4. Migración (aditiva, sin big-bang)

1. Registrar `DeepSeekProvider`, `KimiProvider`, `GlmProvider` (chat y
   reasoner/ollama variants) en `LLMOrchestrator.providers`, detrás de los
   mismos flags de entorno que ya usan (`DEEPSEEK_API_KEY`, `KIMI_API_KEY`,
   `GLM_API_KEY`/`GLM_BASE_URL`). Sin esto no hay circuit breaker posible
   para ellos.
2. Extender `AdaptiveRouter` (`TOOL_CAPABLE`/`RISK_SAFE`/`PRIVATE`) con la
   clasificación real de estos providers (p. ej. GLM-Ollama entra en
   `PRIVATE`; DeepSeek/Kimi/GLM-cloud no entran en `RISK_SAFE` salvo
   decisión explícita de producto).
3. Mover la tabla de `AiModelRouterService.selectRoute()` a ser el insumo de
   capacidad/costo que `AdaptiveRouter.rankByScore()` combina con las
   métricas reales — no un router paralelo.
4. Cambiar `AiModelGatewayService.executeWithSlug()` para que **todas** las
   ramas pasen por `llmOrchestrator.chat()` con el `taskType` real (no
   `"chat"` fijo).
5. Retirar la instanciación directa de providers en `AiModelGatewayService`
   solo después de que el paso 4 esté probado en paralelo (flag de
   activación, no reemplazo simultáneo).

Cada paso es reversible por separado; ninguno requiere migración de datos.

## 5. Riesgos

- `risk: critical` (mismo nivel que `docs/specs/prometeo/tool-registry-governance.spec.md`,
  F2): el gateway de modelos es punto único de fallo para todo el tráfico de
  IA de SEMSE. Un error en el paso 4 puede degradar latencia/disponibilidad
  de Prometeo para todos los agentes simultáneamente.
- Cambiar la clasificación `PRIVATE`/`RISK_SAFE`/`TOOL_CAPABLE` de un
  provider es una decisión de producto (qué proveedor puede ver qué tipo de
  dato), no solo técnica — requiere sign-off explícito antes de implementar,
  no solo revisión de código.

  **Decisión de producto obtenida (2026-08-14):**
  - **`GLM-Ollama` → `PRIVATE`.** Corre en infraestructura propia de SEMSE
    (Railway, dentro del mismo servicio Ollama que ya aloja `ollama-local`),
    sin API key, nunca llega a los servidores de Zhipu AI — mismo criterio
    de confianza que ya aplica a `ollama`. `GLM-cloud` (la otra variante del
    mismo `GlmProvider`, vía API key contra `bigmodel.cn`) **no** entra en
    `PRIVATE`.
  - **`DeepSeek` (chat/reasoner), `Kimi` (`kimi-k2`) y `GLM-cloud` → fuera de
    `RISK_SAFE`.** Ninguno de los tres se agrega al set `RISK_SAFE`
    (`{anthropic, openai}` sin cambios) ni a `TOOL_CAPABLE` (los tres son,
    además, técnicamente no tool-capable en este código hoy — ninguno de los
    tres provider files implementa function/tool calling). Quedan
    disponibles solo para tareas normales (`riskLevel` bajo/medio, sin
    `privacyCritical`/`localOnly`) — el mismo nivel de confianza implícito
    que ya tenían, ahora aplicado explícitamente en vez de nunca verificado.
    **Efecto directo confirmado:** esto cierra el caso real descrito en §2 —
    `construction_contract_analysis` con `privacyCritical: true` ya no puede
    resolver a `kimi-k2` bajo ninguna circunstancia una vez migrado el paso 4
    de §4.
- Debe probarse que ningún caller que hoy depende del comportamiento de
  `executeWithSlug()` para DeepSeek/Kimi/GLM (p. ej. `feedContextEngine`,
  `routeReason`, `fallbackUsed` en la respuesta) pierde esos campos al pasar
  por `llmOrchestrator.chat()`.

## 6. Criterios de aceptación

- [ ] Ningún slug (incluidos `deepseek-*`, `kimi-k2`, `glm-*`) se ejecuta sin
      pasar por `ProviderMetricsStore` (circuit breaker + score) — sigue
      pendiente, requiere los pasos 1-5 de §4 completos (registrar los 3
      providers en `LLMOrchestrator`, extender `AdaptiveRouter`, fusionar
      las tablas de ruteo). Migración crítica de punto único de falla para
      todo el tráfico de IA — no se aborda de forma parcial en este pase;
      necesita su propio plan/tasks SDD 2.0.
- [x] Una request con `privacyCritical: true` o `localOnly: true` nunca
      resuelve a un provider fuera de `PRIVATE`, sin importar el `taskType`
      — corregido 2026-08-27 **como fix quirúrgico, no como parte de la
      migración completa de §4**. `AiModelRouterService.selectRoute()`
      solo forzaba `ollama-local` para `privacyLevel === "local_only"`;
      `"sensitive"` y `"restricted"` caían directo a las rutas por
      `taskType`, que pueden seleccionar `kimi-k2`/`deepseek-reasoner`/
      `glm-4` (cloud) sin ninguna verificación — exactamente el hallazgo
      de la sección 2 de este spec, confirmado en código (ningún caller
      real seteaba estos dos valores al momento del fix, así que no era
      una fuga activa en producción, pero sí un gap real, sin red de
      protección, para el primer caller que los usara). Se extendió el
      mismo check a los tres valores, sin `fallbackModelSlug` (falla
      cerrado — `AiModelGatewayService.generate()` devuelve
      `success:false` en vez de intentar un provider cloud si
      `ollama-local` falla). 5/5 tests nuevos en
      `apps/api/test/ai-model-router-privacy.test.ts` — incluye una
      prueba explícita de que el mismo `taskType` sin privacyLevel
      resuelve a un provider cloud (o sea, que el fix realmente cambia el
      resultado, no solo agrega una rama muerta). `forceModelSlug` sigue
      ganándole a la privacidad, sin cambios — es un override explícito
      de operador, sale de este alcance.
- [ ] El `taskType` real llega al `AdaptiveRouter` en el 100% de las rutas
      (no hardcodeado a `"chat"`) — sigue pendiente. Investigado
      2026-08-27: no es un cambio trivial de una línea — `AiTaskType`
      (`AiGenerateRequest`, dominio: `construction_contract_analysis`,
      `project_planning`, etc.) y `TaskType` (`CopilotRoutingContext` del
      orquestador: `chat | tool_use | high_risk_action | low_risk_action |
      search | unknown`) son enums completamente distintos y no
      isomorfos — requiere una tabla de mapeo con criterio de producto
      (¿`risk_analysis` es `high_risk_action`? ¿`code_generation` es
      `tool_use`?), no solo plomería. Queda para el plan de migración
      completo.
- [ ] Ningún fallback ni `routeReason`/`fallbackUsed` existente se pierde en
      la respuesta de `AiGenerateResponse` — sigue pendiente, depende de
      los pasos 4-5 de §4.
- [ ] Rollback: cada paso de la migración (§4) puede revertirse
      individualmente sin afectar a los pasos ya completados — sigue
      pendiente (aplica a la migración completa; el fix de privacidad de
      arriba es aditivo y no forma parte de esos 5 pasos, así que no
      necesita su propio rollback escalonado).

## 7. No implementado en este spec

`status: APPROVED` (2026-08-14) — el sign-off de clasificación de
providers (§5, punto 2) ya se obtuvo, no queda ningún bloqueo de producto.
**No se modifica código en este spec.** Sigue el flujo `/speckit.plan` →
`/speckit.tasks` → tests antes de código → `/speckit.implement`
(`docs/SDD_GOVERNANCE.md`) como paso siguiente, no incluido en esta pasada.
