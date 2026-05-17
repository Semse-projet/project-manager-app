# AI Orchestration — SEMSE OS

## Arquitectura

```
AgentsService.chatWithTools()
    └── LLMService (facade)
            └── LLMOrchestrator
                    ├── AdaptiveRouter (score-based + hard constraints)
                    ├── OllamaProvider     ← NATIVO/LOCAL (registrado primero)
                    ├── AnthropicProvider  (tool_use nativo, prompt caching)
                    ├── OpenAIProvider     (function calling)
                    └── TemplateProvider   (keyword matching, zero deps)
```

## Filosofía local-first

**Ollama es la inteligencia nativa.** Los proveedores externos son extensiones premium/fallback.

```
LLM_DEFAULT_PROVIDER=ollama   → Ollama por defecto
fallback chain: ollama → anthropic → openai → template
```

Cada ejecución LLM loguea: `provider | model | routingReason | fallbackUsed | latencyMs | agentName | source`

## Providers

| Provider | Tier | Tools | Cuándo usar |
|----------|------|-------|-------------|
| `ollama` | 1 — nativo | prompt parsing | **default**, localOnly, privacyCritical, lowCost |
| `anthropic` | 3 — premium | nativo tool_use | requiresTools, riskLevel=high |
| `openai` | 3 — premium | function calling | requiresTools, fallback de anthropic |
| `template` | 0 — fallback | no | último recurso, sin API key |

## Agent Profiles (Tiers operacionales)

| Agente | Tier | Provider | Razón |
|--------|------|----------|-------|
| `mission-control` | 1 | ollama (localOnly) | summaries baratos, sin salida a red |
| `intake-interpreter` | 1 | ollama (localOnly) | clasificación de texto libre |
| `evidence-analyzer` | 2 | ollama (privacyCritical) | fotos/datos privados del proyecto |
| `change-order-detector` | 1 | ollama (localOnly) | detección en mensajes del cliente |
| `risk-narrator` | 1 | ollama (localOnly) | narrativas de riesgo operacional |
| `contract-reviewer` | 3 | anthropic (riskHigh) | razonamiento legal complejo |
| `dispute-analyzer` | 3 | anthropic+tools | herramientas + razonamiento |

## Routing policy

```
preferredProvider → localOnly → privacyCritical → riskLevel=high → requiresTools → lowCost → default(ollama)
```

## Performance Ollama en CPU (sin GPU)

| Modelo | Tamaño | Primera carga | Warm |
|--------|--------|--------------|------|
| `qwen2.5:0.5b` | 397 MB | ~8s | ~4s |
| `qwen2.5:3b` | 1.9 GB | ~85s | ~16s |

**Para iteración rápida sin GPU:** `OLLAMA_MODEL=qwen2.5:0.5b`
**Para flujos reales y JSON estructurado:** `OLLAMA_MODEL=qwen2.5:3b` + `OLLAMA_TIMEOUT_MS=120000`
**Con GPU:** cualquier modelo responde en <1s

## Producción (Railway)

Ollama no corre en Railway. Para producción:
- Railway: `LLM_DEFAULT_PROVIDER=anthropic` (sin `ENABLE_OPEN_SOURCE_MODELS`)
- Ollama puede correr en VPS/GPU separado y conectarse via `OLLAMA_BASE_URL`

## Human-in-the-loop

El LLM **nunca ejecuta acciones**. Solo propone via `tool_use`. El usuario confirma via `runAction()`. Acciones `approvalMode=required` van a cola operativa.

## Variables de entorno

Ver `.env.example` en la raíz del monorepo.

---

## Agent Memory (Fase 2)

```
ProjectCopilotHarness.handleChat()
  ├── AgentMemoryService.fetchRelevant()   ← scan + FTS + recency score
  │       └── WorkspaceMemoryRepository.search() + query()
  ├── AgentMemoryService.formatForContext() ← budget-limited injection
  │       └── [up to 6 records, max 4000 chars → ~1000 tokens]
  ├── agentsService.chatWithTools()         ← LLM call with enriched context
  └── AgentMemoryService.writeSessionSummary()  ← best-effort post-session write
          └── WorkspaceMemoryRepository.append()
```

### Relevance scoring

```
score = FTSrank × 0.40 + recency × 0.35 + kindImportance × 0.25
```

| Kind | Importance |
|------|-----------|
| decision | 1.0 |
| run_summary | 0.9 |
| task_state | 0.75 |
| runtime_fact | 0.70 |
| repo_fact | 0.60 |
| operator_note | 0.50 |

### Recency decay

| Age | Score |
|-----|-------|
| < 1h | 1.00 |
| < 24h | 0.85 |
| < 7d | 0.65 |
| < 30d | 0.45 |
| older | 0.25 |

### What gets written to memory

- **run_summary**: After each copilot session with actions proposed or substantial response
- **decision**: Each proposed action (PROPOSE_MILESTONE_APPROVAL, PROPOSE_ESCROW_RELEASE, etc.)

Memory writes are best-effort and never block the main chat flow.
