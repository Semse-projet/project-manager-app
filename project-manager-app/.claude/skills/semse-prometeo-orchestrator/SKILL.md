---
name: semse-prometeo-orchestrator
description: What "ai-models/ — Prometeo orchestrator, not a generic model wrapper" (CLAUDE.md) actually means in code — the multi-agent/multi-model routing pipeline, the two-orchestrator split (AiModelGatewayService vs. LLMOrchestrator) that lets 5 model slugs skip privacy/circuit-breaker enforcement, and why "the local Ollama model" means three different things depending on which code path you're in. Use before touching apps/api/src/modules/ai-models/, adding a new task type or model route, or reasoning about privacyLevel/privacyCritical/forceModelSlug.
---

# SEMSE Prometeo / AI model orchestration

## Why it's "not a generic wrapper"

`apps/api/src/modules/ai-models/` is a multi-agent business router, not a single-model call site. The real pipeline (entry point `POST /v1/ai-models/prometeo/chat`, `ai-models.controller.ts:213-392`):

```
classifyIntent()          — keyword scoring (prometeo-orchestrator.service.ts:193-204)
→ routeToAgent()           — picks 1 of 7 personas: Prometeo/Pulse/Planner/Felix/Justus/Marta/SEMSE Core
                              (L206-238), each with a hardcoded system prompt (L100-171)
→ mapIntentToTaskType()    — intent → AiTaskType (L480-516)
→ AiModelRouterService.selectRoute()  — static taskType→modelSlug table, e.g.
                              construction_contract_analysis→kimi-k2, project_planning/
                              code_generation→deepseek-reasoner, cheap summaries→deepseek-chat,
                              rag_answer→claude (ai-model-router.service.ts:14-80)
→ AiModelGatewayService.executeWithSlug()  — actually calls the model
```

The controller also runs a "mission" state machine (observe/interpret/plan/approval/execute) and gates payment-related proposed actions behind `human_required` approval (`ai-models.controller.ts:664-746`) — that gate is exactly the kind of thing `semseproject`'s Approval Gate cares about; don't bypass it by calling the gateway directly from a new call site.

`OperationalContextService` (`context/`, DB-backed, 60s cache, Prisma snapshot persistence) feeds live SEMSE domain data — jobs/milestones/escrow/disputes/risk/finance/5D-ecosystem score — into the prompt. `TokenBudgetEngine` defines `shouldCompress()`/`compress()` at a 75% threshold (keep-first-1/last-6 turns), but **`AiModelGatewayService.generate()` only logs a warning when the budget is exceeded — it never actually calls `compress()`**. A long conversation degrades by silently exceeding budget, not by getting summarized as the engine's own design implies.

## The real gap: two competing orchestration surfaces (SPEC-GTW-001)

`docs/specs/prometeo/model-gateway-unification.spec.md` (id `prometeo.model-gateway-unification`, status **APPROVED, risk critical, not yet implemented**) documents this precisely, with its own verified-in-code table:

| Slug family | What actually happens | Evidence |
|---|---|---|
| `deepseek-chat`/`deepseek-reasoner`/`kimi-k2`/`glm-4`/`glm-ollama` | `AiModelGatewayService.executeWithSlug()` calls the provider directly | `ai-model-gateway.service.ts:87-114` — **never passes through `LLMOrchestrator`, `ProviderMetricsStore`, or `AdaptiveRouter`** |
| `claude-sonnet`/`openai-gpt4`/`ollama-local` | Delegates to `LLMOrchestrator.chat()` | `ai-model-gateway.service.ts:115-134` — but hardcodes `taskType: "chat"` in the context, so the real task type (`code_generation`, `risk_analysis`, ...) never reaches `AdaptiveRouter` |

`AdaptiveRouter.applyHardConstraints()` (`infrastructure/llm/router/adaptive-router.ts:51-82`) is the thing that forces `localOnly`/`privacyCritical` requests to `PRIVATE`-only providers and `riskLevel: high` to `RISK_SAFE` providers. **The first five slugs above never reach it.** The spec's own words (line 61-65): *"una llamada con `taskType: construction_contract_analysis` y `privacyCritical: true` puede resolver a `kimi-k2` ... y ejecutarse sin pasar por ninguna de las verificaciones de `AdaptiveRouter.applyHardConstraints()`. No es una falla teórica: es la ruta de código real para esos cinco slugs."*

This is distinct from — and not fixed by — the `privacyLevel` check already in `AiModelRouterService.selectRoute()` (`ai-model-router.service.ts:26-35`), which forces `local_only`/`sensitive`/`restricted` to `ollama-local` and is checked *before* `forceModelSlug` so a caller-supplied override can't bypass it (this part was fixed 2026-08-27, see `apps/api/test/ai-model-router-privacy.test.ts`). The unresolved gap is the separate `privacyCritical` flag the spec describes, which `AdaptiveRouter` enforces but `AiModelRouterService`/`AiModelGatewayService` do not check at all for the 5-slug direct-provider path. **If you add a new task type or touch routing, don't assume `privacyLevel` being checked means privacy is handled — check whether your change goes through the 5-slug direct path or the `LLMOrchestrator` path, and whether `privacyCritical` is honored on the path you're using.** Treat any routing change here as security-relevant per `semse-security-baseline`, not just a feature tweak.

## "The local Ollama model" means three different things

- `dev:api:local-llm` (`package.json`) sets `SEMSE_AUTONOMY_LLM_*` env vars — consumed only by `apps/api/src/modules/autonomy/autonomy.service.ts`, a **separate module unrelated to `ai-models`**.
- `ai-models`' own `ollama-local` slug (`registry/model-registry.ts:90-102`) goes through `infrastructure/llm/providers/ollama.provider.ts`, reads `OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`OLLAMA_API_KEY` (default model `llama3.1`, not `qwen2.5:3b`), gated by `ENABLE_OPEN_SOURCE_MODELS=true`.
- `glm-ollama` (`ai-model-gateway.service.ts:38-44`) points at yet another env var, `OLLAMA_GLM_MODEL` (default `glm4`).

None of these three default to `qwen2.5:3b` inside `ai-models` — that model name only appears in the `dev:api:local-llm` script for the unrelated autonomy module. Don't assume "run `dev:api:local-llm`" changes which model Prometeo chat itself uses.

## Other confirmed gotchas

- `DeepSeekProvider.generate()` (`deepseek.provider.ts:30-40`) has **no fetch timeout** (`AbortSignal` is not used) — unlike `OllamaProvider`, which does set one (`ollama.provider.ts:99-104`). A hung DeepSeek call has no client-side cutoff.
- 3 of 5 assistant settings toggles are dead code: `prometeo-orchestrator.service.ts:332-336` has an inline comment admitting `assistantLanguage`/`assistantVerbosity`/`unifiedMode` are persisted and threaded into `assistantSettings` but never actually read.
- `AiModelGatewayService.getModelRegistry()` (`ai-model-gateway.service.ts:175-178`) just returns `[]` — dead/misleading method; the real registry is used at module level via the controller instead.
- No RAG/embeddings inside `ai-models/` itself. `PrometeoDocument.embeddingJson` (`packages/db/prisma/schema.prisma:2252,2259`) stores a serialized `Float32Array` as JSON — **no pgvector, no real vector index**, presumably brute-force cosine similarity in app code. `rag_answer` routes to Claude but retrieval lives elsewhere (see `docs/specs/api/prometeo-rag-trade-knowledge.spec.md`, status VERIFIED).
- No caller in `packages/agents/` or `packages/knowledge/` imports `ai-models` directly — every consumer (`jobs.module.ts`, `disputes.service.ts`, `milestones.service.ts`, `agents/agent-delegation.service.ts`, `labor-engine/labor-chat.service.ts`, etc.) is inside `apps/api`, wired via plain NestJS DI through `AiModelsModule` exports, not HTTP or a queue.

## Spec status

There is no `docs/specs/ai/` folder — the domain is called **`prometeo`** in `docs/SPEC_INDEX.md`, not "ai". Key rows: `api-prometeo-copilot`/`api-prometeo-orchestrator` (IMPLEMENTED), `api-prometeo-rag-trade-knowledge` (VERIFIED), `prometeo.model-gateway-unification` (APPROVED, critical, **not implemented** — the gap above), `prometeo.tool-registry-governance-f2` / `prometeo.live-sessions` (APPROVED, no tests), `prometeo.agent-decision-retrieval` / `prometeo.cache-control` (REVIEW). Before any gateway-level change, read SPEC-GTW-001 in full — per `semse-spec-kit-flow`, an APPROVED-but-unimplemented spec is the design authority, and a gateway change that contradicts its proposed `resolveModel()` unification should extend/update the spec, not quietly diverge further from it.

## Notas para futuros agentes / hallazgos abiertos

- No se implementó la unificación del gateway (SPEC-GTW-001) en esta sesión — es un cambio de arquitectura crítico, no un bugfix aislado; requeriría el flujo SDD completo (`semse-spec-kit-flow`) y probablemente el gate de `semseproject`/`semse-audit-remediation` dado que toca enforcement de privacidad.
- No se confirmó si `privacyCritical` es un campo real y usado en `AiGenerateRequest`/DTOs de `ai-models`, o si solo existe en el lado de `infrastructure/llm` (`AdaptiveRouter`) — el spec lo trata como parte del contrato pero esto no se verificó línea por línea contra `dto/ai-generate-request.dto.ts`. Si vas a tocar routing de privacidad, confirmá primero dónde vive ese campo y quién lo puebla.
- No se auditó `infrastructure/llm/orchestrator.ts` ni `adaptive-router.ts` en profundidad más allá de lo que cita el propio spec — si el trabajo es sobre `LLMOrchestrator`/`AdaptiveRouter` directamente (no sobre `ai-models/`), leé esos archivos completos primero, esta skill los cita pero no los cubre a fondo.
- No se investigaron los 7 agentes/personas (Prometeo/Pulse/Planner/Felix/Justus/Marta/SEMSE Core) en detalle — solo se confirmó que existen con prompts hardcodeados. Si el trabajo es agregar un agente nuevo u optimizar uno existente, sus system prompts están en `prometeo-orchestrator.service.ts:100-171`, no en un archivo de configuración separado.
