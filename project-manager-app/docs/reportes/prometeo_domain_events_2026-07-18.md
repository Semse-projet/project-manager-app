# Prometeo — Emisión de eventos canónicos (B)

**Fecha:** 2026-07-18
**Alcance:** Conectar las acciones materiales de Prometeo Orchestrator/Copilot al
bus de eventos de dominio, usando exclusivamente eventos del `EVENT_CATALOG.md`.
**Orden aprobado:** A (persistencia) → C (UUID estrictos) → **B (eventos)**.

## Contexto

Tras A y C, las funcionalidades Prometeo dejaban únicamente logs de texto
(`prometeo.orchestration.completed`, `copilot.mission.created`, …). AGENTS.md y
`EVENT_CATALOG.md` exigen que las acciones materiales produzcan un evento de
dominio auditables: «Si una acción importante no produce evento ni deja audit
log, está incompleta.» B cubre ese hueco **sin inventar nombres de eventos**.

## Decisión de diseño

Las acciones de Prometeo son, por naturaleza, acciones de agente. El catálogo ya
define eventos de agente idóneos, así que se reutilizan en vez de crear nuevos:

- `agent.action_logged` — acción de agente auditada.
- `agent.human_review_requested` — se requiere aprobación humana.

Ambos ya existían en `packages/schemas/src/domain-events.schema.ts` y en la
allowlist de emisión (`domain-events.policy.ts`). Se documentaron sus
**productores Prometeo** en el catálogo y se añadió a la sección Agents el nombre
`agent.human_review_requested`, que estaba en el schema pero faltaba en el doc.

### Acciones que emiten (cambios de dominio / consecuencia real)

| Acción | Evento(s) | Notas |
|---|---|---|
| `POST /v1/prometeo/orchestrate` (completada) | `agent.action_logged` | `agentType=prometeo-orchestrator`, `actionType=generate`, `targetType=orchestration`; `confidence` = confianza de interpretación; `requiresHumanReview` = `requiresApproval`. |
| `orchestrate` con `requiresApproval` | `agent.human_review_requested` | `reason=ambiguous_intent` o `plan_requires_approval`, `urgency=medium`. |
| `POST /v1/prometeo/copilot/mission/create` | `agent.action_logged` | `agentType=prometeo-copilot`, `actionType=generate`, `targetType=mission`. |

### Acciones que NO emiten (regla anti-ruido)

Detección de contexto, chat/mensajes del Copilot, quick-actions read-only, y
navegación/carga/descarga de misión del Workspace son estado de UI o lecturas;
no representan un cambio de dominio, por lo que no producen eventos.

## Implementación

- **Emisión vía `DomainEventBus`** (mismo patrón que `jobs`, `ratings`, etc.):
  valida contra `semseEventSchema`, escribe audit log y enruta a triggers.
  Emisión best-effort: un fallo del bus se registra como `warn` y nunca rompe la
  respuesta del endpoint.
- `OrchestrationService` y `PrometeoCopilotService` reciben `DomainEventBus` como
  dependencia **opcional** (`@Optional()`): en producción la inyecta el módulo;
  en tests unitarios sin bus la emisión se omite de forma segura.
- Los módulos `OrchestrationModule` y `PrometeoCopilotModule` ahora importan
  `DomainEventsModule` (que exporta `DomainEventBus`). Sin ciclos: `ai-models` no
  importa estos módulos.
- Se añadió `requestId` al actor (`OrchestrationActor`, y por herencia
  `CopilotActor`), poblado en los controladores desde `resolveRequestId`, para
  correlación de auditoría del evento.
- `meta.actorType = "agent"` (acción originada por el agente), `actorId` = usuario
  invocante; el contexto de emisión conserva `userId` para el audit row.
- `correlationId` = id del agregado (`orchestrationId` / `missionId`).

### Archivos

- `apps/api/src/modules/orchestration/orchestration.service.ts`
- `apps/api/src/modules/orchestration/orchestration.controller.ts`
- `apps/api/src/modules/orchestration/orchestration.module.ts`
- `apps/api/src/modules/prometeo-copilot/prometeo-copilot.service.ts`
- `apps/api/src/modules/prometeo-copilot/prometeo-copilot.controller.ts`
- `apps/api/src/modules/prometeo-copilot/prometeo-copilot.module.ts`
- `docs/foundation/EVENT_CATALOG.md` (productores Prometeo + `agent.human_review_requested`)
- `apps/api/test/prometeo-domain-events.test.ts` (nuevo)

## Tests

`apps/api/test/prometeo-domain-events.test.ts` usa un bus que captura cada
emisión y valida el evento contra `semseEventSchema` (prueba que son eventos
canónicos reales). Cubre:

- `orchestrate` emite `agent.action_logged` con payload/contexto correctos.
- `orchestrate` ambiguo emite además `agent.human_review_requested`.
- `orchestrate` sin aprobación no pide revisión humana.
- `orchestrate` funciona sin bus (degradación segura).
- `copilot.createMission` emite `agent.action_logged`.

## Gates

- `pnpm build:packages` — OK
- `pnpm --filter @semse/api build` — OK
- `pnpm typecheck` — OK
- `pnpm --filter @semse/api test:unit` — 1902/1902 OK (+5)
- `pnpm lint` — 0 errores, 54 warnings preexistentes
