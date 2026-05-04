# AI Orchestration — SEMSE OS

## Arquitectura

```
AgentsService.chatWithTools()
    └── LLMService (facade)
            └── LLMOrchestrator
                    ├── ProviderRouter (selectProvider + buildFallbackChain)
                    ├── AnthropicProvider  (tool_use nativo, prompt caching)
                    ├── OpenAIProvider     (function calling)
                    ├── OllamaProvider     (prompt-based tool parsing)
                    └── TemplateProvider   (keyword matching, zero deps)
```

## Providers

| Provider | Tools | Cuándo usar |
|----------|-------|-------------|
| `anthropic` | nativo tool_use | riskLevel=high, requiresTools, default |
| `openai` | function calling | structured output, fallback |
| `ollama` | prompt parsing | privacyCritical, lowCost, local |
| `template` | no | último recurso, sin API key |

## Routing policy

```
preferredProvider → privacyCritical → riskLevel=high → requiresTools → lowCost → default
```

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
