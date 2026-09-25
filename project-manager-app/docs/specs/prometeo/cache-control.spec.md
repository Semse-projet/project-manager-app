---
id: "prometeo.cache-control"
title: "Cache control declarativo cross-provider (alias histórico SPEC-GTW-002)"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/infrastructure/llm/providers/anthropic.provider.ts
  - apps/api/src/infrastructure/llm/types.ts
  - apps/api/src/infrastructure/llm/orchestrator.ts
  - apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts
  - apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-08-17"
---

# Spec: Cache control declarativo cross-provider

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

**Deriva de:** `docs/architecture/ADR-023-sense-agentic-architecture-v1.md`
§2.3 ítem 3 (`ACCEPTED`).
**Módulos afectados:** `apps/api/src/infrastructure/llm`.
**Alias histórico:** `SPEC-GTW-002`. Child spec de F7 (Prometeo
Multimodal); depende de `prometeo.model-gateway-unification` (estado
`REVIEW`, ver `docs/specs/agents/prometeo-core.spec.md` §4 — no
"mergeado" como decía la versión anterior de este documento; ese spec
sigue sin implementar).

## 1. Problema y resultado

**Para quién:** cualquier caller interno de Prometeo (personas Justus/
Marta/Felix, tools) que hace llamadas repetidas sobre el mismo contexto
estable (contrato, milestone cerrado, documento RAG).

**Problema:** hoy el cache control de prompts es un detalle de
implementación oculto dentro de un solo provider (Anthropic), no una
decisión declarativa que el llamador pueda controlar por bloque de
mensaje. No existe ningún mecanismo, ni siquiera latente, para marcar un
bloque como "nunca cacheable" — la protección actual sobre datos sensibles
a la decisión del momento (aprobación de pago) es enteramente accidental:
funciona porque hoy no hay cache fuera del `systemPrompt`, no porque exista
una regla que lo impida.

**Resultado esperado:** un hint opcional por bloque (`cacheable?: boolean`)
que cualquier provider puede honrar o ignorar sin romper, y una tabla de
negocio explícita y firmada sobre qué se cachea por defecto y qué **nunca**
debe cachearse.

## 2. Alcance

### Incluido

- `LLMChatMessage.cacheable?: boolean` — extensión aditiva de
  `apps/api/src/infrastructure/llm/types.ts`.
- `anthropic.provider.ts` traduce cada bloque con `cacheable: true` a
  `cache_control: { type: "ephemeral" }`.
- Providers sin soporte de cache (OpenAI, Ollama, DeepSeek, Kimi, GLM)
  ignoran el campo silenciosamente — nunca es un error no soportarlo.
- La tabla de negocio §5 (qué se cachea por defecto / qué nunca).

### Fuera de alcance

- Cualquier TTL o alcance de cache más allá del `ephemeral` que Anthropic
  ya ofrece — no se diseña un sistema de cache propio de SEMSE en este
  spec.
- Cache a nivel de respuesta completa (solo bloques de prompt/mensaje).
- Extender el mecanismo a providers sin soporte nativo simulándolo del
  lado del cliente — fuera de alcance, no se pidió y añade riesgo de
  servir contexto stale sin el respaldo del proveedor.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Callers internos de Prometeo (personas, tools, `ContextEngine`) | ninguno nuevo | por request, sin persistencia propia | Marcar un bloque de mensaje como `cacheable: true` | Marcar `cacheable: true` un bloque de la columna "Nunca cacheable" (§5) — debe bloquearse en el punto de armado del mensaje, no confiarse al provider |

- **Tenant boundary:** no aplica — el cache es por llamada, no persiste
  entre tenants ni entre sesiones más allá del TTL `ephemeral` de
  Anthropic.
- **Ownership/resource policy:** no aplica directamente — pero la tabla §5
  sí protege indirectamente ownership al prohibir cachear contexto de
  aprobación de pago/disputa.
- **Step-up o aprobación humana:** ninguna — es un hint de optimización,
  no una mutación.
- **Datos `privacyCritical`:** un bloque cacheado por error en un flujo de
  pago sería un incidente de gobernanza — de ahí que la tabla §5 requiera
  sign-off explícito antes de `APPROVED`, no solo revisión de código.
- **Requisitos de auditoría:** ninguno nuevo — el cache no cambia qué se
  audita, solo cuánto se retransmite.

## 4. Estado real (verificado en código, 2026-08-17)

| Pieza | Qué hace hoy | Evidencia |
|---|---|---|
| Anthropic provider | Cachea *solo* el bloque `system`, siempre, incondicionalmente (`cache_control: { type: "ephemeral" }`) | `anthropic.provider.ts:38` |
| Resto de mensajes/historial | Sin ningún mecanismo de cache — cada llamada retransmite el historial completo (`input.history.map(...)` sin `cache_control`) | `anthropic.provider.ts:33-36` |
| `LLMChatMessage` | `{ role, content }` — no existe campo para marcar una parte como cacheable | `types.ts:48-51` (confirmado: dos campos únicamente) |
| OpenAI/Ollama/DeepSeek/Kimi/GLM providers | Ningún concepto de cache control implementado — confirmado por grep de `"cache"` en los 4 archivos de provider, cero coincidencias | `providers/openai.provider.ts`, `providers/ollama.provider.ts`, `providers/template.provider.ts`, `modules/ai-models/providers/*.ts` |
| `AiModelGatewayService`/`LLMOrchestrator` | No exponen ningún parámetro de cache al llamador; la decisión de qué cachear es enteramente interna al provider de Anthropic | `ai-model-gateway.service.ts`, `orchestrator.ts` |

**Consecuencia real:** confirmada sin cambios respecto a la versión
anterior de este spec — un caller no puede pedir que se cachee un resumen
de contrato ya estable, ni puede garantizar formalmente que un bloque con
datos sensibles a la decisión del momento nunca se cachee. Esa segunda
garantía hoy es un efecto secundario de que nada más está cacheado, no una
regla explícita — cualquier extensión futura del cache sin este spec la
rompería silenciosamente.

## 5. Bloqueado por decisión de producto: tabla de cacheabilidad

El diseño técnico (hint aditivo `cacheable?: boolean`, ignorado
silenciosamente por providers sin soporte) no tiene ambigüedad y podría
implementarse hoy mismo sin riesgo de romper nada. Lo que sí requiere una
decisión que el código no puede resolver es **qué específicamente se marca
`cacheable: true` por defecto y qué específicamente queda prohibido**:

| Cacheable por defecto (propuesta, sin firmar) | Nunca cacheable (propuesta, sin firmar) |
|---|---|
| System prompt de persona (Prometeo/Pulse/Planner/Felix/Justus/Marta) | Contexto de aprobación de pago (`payment_status`, `dispute_status`) |
| Resúmenes de contrato/milestone ya cerrados (no cambian entre llamadas) | Cualquier bloque con `PrometeoProposedAction` pendiente de aprobación |
| Documentos RAG recuperados (chunks de `PrometeoDocument`) sin cambios | Contexto operativo con datos que cambian por request (estado de evidencia en revisión, saldo de escrow) |

Esta tabla es la misma propuesta inicial de la versión anterior del spec —
no fue posible confirmarla contra código porque es, por definición, una
decisión de gobernanza de datos, no un hecho verificable en el repositorio.
Marcarla `APPROVED` sin firma violaría el propio criterio de aceptación
que el spec se puso a sí mismo.

**Qué decisión falta y quién la toma:** quien gobierna
`tool-governance.policy.ts` (mismo owner que la clasificación de providers
de `prometeo.model-gateway-unification` §5) debe confirmar o corregir esta
tabla explícitamente, columna por columna, antes de `APPROVED`. Mientras
tanto, el spec queda en `REVIEW` — el diseño técnico está completo y sin
ambigüedad, solo falta la firma de negocio.

## 6. Escenarios y criterios de aceptación

### P1 — Un bloque marcado cacheable se traduce a `cache_control`

```gherkin
DADO un LLMChatMessage con cacheable: true
CUANDO anthropic.provider.ts arma la llamada
ENTONCES el bloque correspondiente lleva cache_control: { type: "ephemeral" }
```

### P2 — Ningún bloque de "nunca cacheable" se marca `cacheable: true`

```gherkin
DADO un contexto de aprobación de pago o de PrometeoProposedAction pendiente
CUANDO se arma el LLMChatInput para cualquier provider
ENTONCES ningún bloque de ese contexto lleva cacheable: true
Y un test recorre los tipos de contexto de pago/aprobación para verificarlo
```

Casos borde:

- [ ] Provider sin soporte de cache recibe un bloque `cacheable: true` —
      debe ignorarlo sin error y sin cambiar el resultado.
- [ ] `systemPrompt` sigue cacheándose por defecto tras el cambio (no debe
      regresar el ahorro de tokens ya existente).
- [ ] Un caller marca `cacheable: true` en un bloque de la tabla "nunca
      cacheable" por error de programación — el test de aislamiento debe
      fallar visiblemente en CI, no en producción.

## 7. Contratos

### API

No hay endpoint HTTP nuevo — cambio interno de tipos
(`LLMChatMessage`/`LLMChatInput`) consumido indirectamente por
`POST /v1/ai-models/prometeo/chat` y cualquier caller interno.

### UI

```yaml
surfaces: []
states: []
required_behavior: []
```

No aplica.

### Agente/Prometeo

```yaml
tools: []
input_schema: "LLMChatMessage { role, content, cacheable? } — extensión aditiva"
output_schema: "LLMChatResponse — sin cambio de forma"
source_citations_required: false
approval_policy: "la tabla §5 requiere sign-off antes de APPROVED; el código en sí no requiere aprobación humana por request"
forbidden_behavior:
  - Ningún bloque de la columna "Nunca cacheable" (§5) se marca cacheable: true en ningún caller.
  - Ningún provider sin soporte de cache falla o cambia de comportamiento al recibir el hint.
```

## 8. FSM, eventos y reconstrucción

No aplica — sin FSM de dominio afectado, sin eventos nuevos.

## 9. Datos y migración

- **Modelos Prisma:** ninguno.
- **Migración:** no aplica.
- **Estrategia expand/contract:** cambio de tipo aditivo, sin romper
  callers existentes (`cacheable` es opcional).
- **Backfill:** no aplica.
- **Compatibilidad hacia atrás:** callers que no seteen `cacheable`
  mantienen el comportamiento actual exacto (sin cache fuera de
  `systemPrompt`).
- **Verificación de drift:** §4 verificada línea por línea el 2026-08-17;
  sin cambios respecto a la versión anterior del spec (el estado del
  código no cambió desde 2026-07-31).
- **Rollback de código:** revertir el campo `cacheable` es trivial (es
  opcional, ningún caller depende de su presencia).
- **Rollback/forward-fix de datos:** no aplica.

## 10. Observabilidad, despliegue y activación

- **Métricas/SLO:** `cacheReadTokens`/`cacheCreationTokens` ya se
  reportan en `LLMUsage` (`types.ts:62-68`) — este spec debería aumentar
  `cacheReadTokens` en llamadas repetidas sobre bloques marcados, medible
  sin instrumentación nueva.
- **Logs/traces/correlation:** `orchestrator.ts` ya loggea
  `cache_read=${u?.cacheReadTokens ?? 0}` — sin cambio de formato
  necesario.
- **Health/readiness:** no aplica.
- **Feature flags/allowlists:** ninguno nuevo — el hint es opt-in por
  caller, no requiere flag global.
- **Plan de canary:** activar primero solo en resúmenes de contrato/
  milestone cerrados (menor riesgo de stale data) antes de extender a RAG.
- **Evidencia de producción requerida:** confirmar que
  `cacheReadTokens` aumenta tras activar el hint en al menos un flujo
  piloto, y que ningún bloque de la tabla "nunca cacheable" aparece
  cacheado.
- **Señal de rollback:** cualquier reporte de contexto stale servido a un
  agente (p. ej. saldo de escrow desactualizado).
- **Owner operativo:** `semse-core`.

## 11. Tests requeridos

- [ ] Unitario: traducción `cacheable: true` → `cache_control: { type:
      "ephemeral" }` en `anthropic.provider.ts`.
- [ ] Unitario: providers sin soporte de cache ignoran el campo sin error.
- [ ] Aislamiento: ningún bloque de la tabla "nunca cacheable" (§5, una vez
      firmada) se marca `cacheable: true` en ningún caller real —
      recorrido explícito de los tipos de contexto de pago/aprobación.
- [ ] Regresión: el ahorro de tokens del `systemPrompt` no desaparece.
- [ ] Canary o smoke autenticado en producción antes de `VERIFIED`.

## 12. Mapa de implementación

### API

- `apps/api/src/infrastructure/llm/types.ts` — añadir `cacheable?: boolean`
- `apps/api/src/infrastructure/llm/providers/anthropic.provider.ts` —
  traducir el hint a `cache_control`
- `apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts` —
  marcar `cacheable: true` en los bloques que la tabla §5 (firmada)
  autorice

### Tests

- `apps/api/test/infrastructure/llm/*` (ubicación exacta a confirmar en
  `/speckit.tasks`)

## 13. Investigación externa

- No se realizó investigación externa nueva en esta revisión — el
  mecanismo (`cache_control: { type: "ephemeral" }`) ya es el nativo de la
  API de Anthropic, documentado y en uso; no hay alternativa a evaluar
  para el piloto de este spec.

## 14. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado (no
      aplica migración de datos, ver §9)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Tabla de cacheabilidad (§5) firmada — **bloqueante para `APPROVED`**
- [ ] Sólo entonces `status: VERIFIED`
