# AI Models Module (multi-modelo) — PR 1

Fecha: 2026-04-28
Estado: **build:api EXIT:0 | tests: 133/133 | WEB TS: 0 errores**

---

## Qué se construyó

El módulo `ai-models` es la columna vertebral multi-modelo de SEMSE.
Ningún agente llama proveedores directamente. Todo pasa por `AiModelGatewayService`.

---

## Estructura

```
apps/api/src/modules/ai-models/
  types/
    ai-capability.types.ts   — 16 capacidades (reasoning, long_context, etc.)
    ai-task.types.ts         — 17 tipos de tarea (construction_contract_analysis, etc.)
    ai-provider.types.ts     — providers + modos
    ai-model.types.ts        — AiModelDefinition completo
  dto/
    ai-generate-request.dto.ts
    ai-generate-response.dto.ts
  registry/
    model-registry.ts        — 6 modelos registrados
  router/
    ai-model-router.service.ts
  providers/
    deepseek.provider.ts     — DeepSeek Chat + Reasoner
    kimi.provider.ts         — Kimi K2 (contexto largo)
  gateway/
    ai-model-gateway.service.ts
  logging/
    ai-interaction-logger.service.ts
  ai-models.module.ts
  ai-models.controller.ts
```

---

## Modelos registrados

| Slug | Provider | CostTier | Habilitado cuando |
|------|----------|----------|-------------------|
| claude-sonnet | anthropic | high | ANTHROPIC_API_KEY |
| deepseek-reasoner | deepseek | low | DEEPSEEK_API_KEY |
| deepseek-chat | deepseek | very_low | DEEPSEEK_API_KEY |
| kimi-k2 | kimi | medium | KIMI_API_KEY |
| ollama-local | ollama | very_low | ENABLE_OPEN_SOURCE_MODELS=true |
| openai-gpt4 | openai | high | OPENAI_API_KEY |

---

## Lógica del router

| Task Type | Primary | Fallback | Validator |
|-----------|---------|----------|-----------|
| construction_contract_analysis | kimi-k2 | claude-sonnet | claude-sonnet |
| project_planning / risk_analysis | deepseek-reasoner | claude-sonnet | claude-sonnet |
| code_generation | deepseek-reasoner | claude-sonnet | — |
| architecture_review | claude-sonnet | openai-gpt4 | — |
| document_summary | deepseek-chat | claude-sonnet | — |
| general_chat | deepseek-chat | claude-sonnet | — |
| (privacyLevel=local_only) | ollama-local | — | — |

---

## Gateway

`AiModelGatewayService`:
1. Recibe `AiGenerateRequest`
2. Llama `AiModelRouterService.selectRoute()`
3. Ejecuta provider primario (DeepSeek/Kimi directo, resto vía LLMOrchestrator)
4. Si falla → fallback automático
5. Devuelve `AiGenerateResponse` normalizado con latencia, tokens, routeReason

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /v1/ai-models | Listar modelos habilitados |
| GET | /v1/ai-models/registry | Todos los modelos (enabled/disabled) |
| POST | /v1/ai-models/generate | Generar via gateway |
| POST | /v1/ai-models/route | Seleccionar ruta sin ejecutar |
| GET | /v1/ai-models/logs | Últimas 50 interacciones |
| GET | /v1/ai-models/logs/stats | Stats agregadas |

---

## Agentes Prometeo especializados (también completados)

4 nuevos handlers en `apps/worker/src/agent-run-handlers.mjs`:
- `technical-agent` — valida documentación técnica y scope
- `legal-agent` — detecta riesgos contractuales y disputas
- `financial-agent` — monitorea escrow, hitos y liberaciones
- `qa-agent` — evalúa calidad de evidencia

4 nuevos manifests en `packages/agents/src/governance.ts`.

---

## Variables .env necesarias para multi-modelo

```env
# DeepSeek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_DEFAULT_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner

# Kimi / Moonshot
KIMI_API_KEY=
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_DEFAULT_MODEL=moonshot-v1-128k
```

---

## Smoke verificado

```
GET /v1/ai-models → 1 model enabled (claude-sonnet) ✅
POST /v1/ai-models/route taskType=construction_contract_analysis → kimi-k2 ✅
POST /v1/ai-models/generate taskType=general_chat → success=True provider=anthropic ✅
```

---

## Próximos pasos (PR 2)

- Logging en DB (Prisma model AiInteractionLog)
- Integrar gateway en ProjectCopilotHarness por taskType
- Dashboard AI Mission Control en /admin/ai-models
- Tests unitarios del router
