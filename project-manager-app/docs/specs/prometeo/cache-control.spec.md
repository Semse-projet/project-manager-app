---
id: "prometeo.cache-control"
title: "SPEC-GTW-002 — Cache control declarativo cross-provider"
type: spec
domain: "prometeo"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
date: "2026-07-31"
related_files:
  - apps/api/src/infrastructure/llm/providers/anthropic.provider.ts
  - apps/api/src/infrastructure/llm/types.ts
  - apps/api/src/infrastructure/llm/orchestrator.ts
  - apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-31"
---

# SPEC-GTW-002 — Cache control declarativo cross-provider

**Deriva de:** `ADR-023-sense-agentic-architecture-v1.md` §2.3 ítem 3
**Módulos afectados:** `apps/api/src/infrastructure/llm`
**Fase Matriz:** child spec de F7 (Prometeo Multimodal); depende de
`SPEC-GTW-001` (Model Gateway unification, mergeado)

---

## 1. Propósito

Hoy el cache control de prompts es un detalle de implementación oculto
dentro de un solo provider, no una decisión declarativa que el llamador
pueda controlar por bloque de mensaje. Este spec define un hint opcional
por bloque (`cacheable?: boolean`) que cualquier provider puede honrar o
ignorar sin romper, y dos reglas de negocio explícitas: qué se cachea por
defecto y qué **nunca** debe cachearse.

## 2. Estado real (verificado en código)

| Pieza | Qué hace hoy | Evidencia |
|---|---|---|
| Anthropic provider | Cachea *solo* el bloque `systemPrompt`, siempre, incondicionalmente (`cache_control: { type: "ephemeral" }`) | `anthropic.provider.ts:38` |
| Resto de mensajes/historial | Sin ningún mecanismo de cache — cada llamada retransmite el historial completo | `anthropic.provider.ts` (ningún otro bloque lleva `cache_control`) |
| `LLMChatMessage` / `LLMChatInput` | `{ role, content: string }` — no existe campo para marcar una parte como cacheable ni con qué alcance/TTL | `types.ts:48-60` |
| OpenAI/Ollama/DeepSeek/Kimi/GLM providers | Ningún concepto de cache control implementado | ausencia confirmada — no hay `cache` en ninguno de esos archivos |
| `AiModelGatewayService`/`LLMOrchestrator` | No exponen ningún parámetro de cache al llamador; la decisión de qué cachear es enteramente interna al provider de Anthropic | `ai-model-gateway.service.ts`, `orchestrator.ts` |

**Consecuencia real:** un caller no puede pedir que se cachee, por ejemplo,
un resumen de contrato ya estable (ahorro real de tokens en llamadas
repetidas de Justus/Marta sobre el mismo proyecto), ni puede garantizar que
un bloque con datos sensibles a la decisión del momento (contexto de
aprobación de un pago) nunca se cachee — ese segundo caso hoy funciona por
omisión (no hay cache fuera del system prompt), pero no hay ninguna
protección si mañana se extiende el cache a otros bloques sin este spec.

## 3. Diseño propuesto

```ts
// types.ts — extensión aditiva, no rompe callers existentes
export type LLMChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  cacheable?: boolean;   // hint; ausente = comportamiento actual (no cache)
};
```

- `anthropic.provider.ts` traduce cada bloque con `cacheable: true` a
  `cache_control: { type: "ephemeral" }`; bloques sin el hint no cambian de
  comportamiento respecto a hoy.
- Providers sin soporte de cache (OpenAI, Ollama, DeepSeek, Kimi, GLM)
  **ignoran el campo silenciosamente** — nunca debe ser un error no soportar
  cache; es siempre un hint de optimización, no un contrato duro.
- El `systemPrompt` se sigue marcando `cacheable: true` por defecto (mismo
  comportamiento que hoy), para no regresar el ahorro de tokens ya existente.

## 4. Regla de negocio (requiere sign-off, no es solo técnica)

| Cacheable por defecto | Nunca cacheable |
|---|---|
| System prompt de persona (Prometeo/Pulse/Planner/Felix/Justus/Marta) | Contexto de aprobación de pago (`payment_status`, `dispute_status`) |
| Resúmenes de contrato/milestone ya cerrados (no cambian entre llamadas) | Cualquier bloque con `PrometeoProposedAction` pendiente de aprobación |
| Documentos RAG recuperados (chunks de `PrometeoDocument`) sin cambios | Contexto operativo con datos que cambian por request (estado de evidencia en revisión, saldo de escrow) |

Esta tabla es una propuesta inicial, no una clasificación cerrada — igual
que `SPEC-GTW-001` dejó la clasificación de providers pendiente de decisión
de producto, esta tabla debe confirmarse con quien gobierna
`tool-governance.policy.ts` antes de pasar el spec a `APPROVED`.

## 5. Riesgos

- `risk: medium` (no crítico como el gateway): cachear de más puede servir
  contexto stale a un agente (p. ej. un resumen de evidencia cacheado que ya
  cambió); cachear de menos solo cuesta tokens, no correctitud.
- Un bloque marcado `cacheable: true` por error en un flujo de pago sería un
  incidente de gobernanza, no solo de performance — de ahí la tabla §4 como
  entregable explícito del spec, no un detalle de implementación.

## 6. Criterios de aceptación

- [ ] Ningún bloque de la columna "Nunca cacheable" (§4) se marca
      `cacheable: true` en ningún caller, verificado con un test que
      recorra los tipos de contexto de pago/aprobación.
- [ ] Providers sin soporte de cache no fallan ni cambian comportamiento al
      recibir un bloque con `cacheable: true`.
- [ ] El ahorro de tokens del `systemPrompt` (ya existente hoy) no regresa.
- [ ] La tabla §4 tiene sign-off explícito antes de `APPROVED`.

## 7. No implementado en este spec

Queda en `status: DRAFT`. Sigue el mismo flujo que `SPEC-GTW-001`:
sign-off de la tabla de negocio (§4) → `APPROVED` → `/speckit.plan` →
`/speckit.tasks` → tests antes de código → `/speckit.implement`.
