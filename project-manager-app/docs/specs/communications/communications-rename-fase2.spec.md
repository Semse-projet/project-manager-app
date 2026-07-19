---
id: "communications.rename-fase2"
title: "Fase 2 — Renombrar entidades de comunicaciones (ConversationThread/ConversationMessage → CommunicationThread/Communication)"
type: spec
feature: "communications-rename-fase2"
domain: "communications"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
branch: "devin/comunicaciones-fase2"
date: "2026-07-17"
author: "Devin"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/communications/communications.repository.ts
  - apps/api/src/modules/communications/communications.controller.ts
  - apps/api/src/modules/communications/communications.service.ts
  - apps/api/src/modules/communications/communications.types.ts
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20260720000000_rename_communications_entities
related_tests: []
related_endpoints:
  - v1/communications/threads
  - v1/communications/threads/:threadId/messages
  - v1/communications/send
  - v1/communications/inbound
  - v1/communications/webhooks/whatsapp
related_events: []
related_agents: []
last_verified: "2026-07-19"
---

# Spec: renombrar entidades de comunicaciones — Fase 2

Fase 2 de la consolidación del dominio de comunicaciones: renombra los modelos de datos para alinearlos con la arquitectura unificada (`CommunicationThread` / `Communication`) manteniendo todos los endpoints y DTOs existentes.

---

## 1. Qué resuelve

**Para quién:** plataforma, OPS_ADMIN, clientes, contratistas, agentes conversacionales.

**Problema:** tras eliminar las tablas legacy `MessageThread`/`Message` en Fase 1, los nombres `ConversationThread`/`ConversationMessage` siguen desalineados con el dominio canónico `communications` definido en el reporte de arquitectura unificada.

**Solución:**

- Renombrar el modelo/tabla `ConversationThread` a `CommunicationThread`.
- Renombrar el modelo/tabla `ConversationMessage` a `Communication`.
- Actualizar relaciones y consumidores (`communications.repository.ts`).
- Mantener enums `CommunicationThreadStatus`, `CommunicationMessageStatus`, `CommunicationDirection`, `CommunicationProvider`.
- No cambiar contratos de API ni DTOs.

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| OPS_ADMIN / PRO / CLIENT | * | operaciones CRUD sobre threads/messages vía endpoints existentes | ver datos de otros tenants |
| Plataforma / agentes | `PLATFORM` | sincronizar mensajes entrantes/salientes | saltar RBAC |

---

## 3. Escenarios de Usuario (P1)

### P1 — Los endpoints de comunicaciones siguen funcionando tras el rename

**Journey:** un cliente/pro/contratista usa `/v1/communications/threads`, `/v1/communications/messages` o webhooks sin notar el cambio de tabla subyacente.

**Criterio de aceptación:**
```
DADO   que la tabla legacy era ConversationThread/ConversationMessage
CUANDO se ejecuta la migración y se regenera el Prisma client
ENTONCES los endpoints listan, crean y actualizan threads/messages usando CommunicationThread/Communication
  Y    la API pública conserva los mismos contratos y DTOs
```

**Casos borde:**
- Webhooks de WhatsApp/SMS crean threads inexistentes (upsert).
- Mensajes entrantes se vinculan al thread correcto por `externalThreadId`/`contactPhone`.
- Relaciones `OutboundDelivery.thread`, `User.sentCommunications`, `Tenant.communicationThreads` permanecen válidas.

**Errores esperados:**
- `404` si el thread no existe.
- `400` si falta `tenantId`, `threadId` o campos requeridos.
- `403` si el actor no pertenece al tenant.

---

## 4. FSM — Máquina de Estados

No aplica para este cambio refactor. Estados de `CommunicationThread` (`OPEN`, `PENDING`, `CLOSED`, `ARCHIVED`) y `Communication` (`RECEIVED`, `QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`) se mantienen idénticos.

---

## 5. Contratos de API

### Fase 2 — Sin cambios de API

No se añaden ni modificifican endpoints. Los contratos públicos se mantienen:

- `GET /v1/communications/threads`
- `GET /v1/communications/threads/:id`
- `GET /v1/communications/threads/:id/messages`
- `POST /v1/communications/messages`
- `POST /v1/communications/webhooks/:provider`

Los DTOs `CommunicationThreadRecord` y `CommunicationMessageRecord` conservan sus nombres y shape.

---

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Typecheck | 0 errores |
| Lint | 0 errores (warnings web preexistentes permitidos) |
| Tests unitarios API | ≥ 1887 pass / 0 fail |
| Tests unitarios workspace | ≥ 906 pass / 0 fail |
| `pnpm spec:preflight` | pass |
| Sin cambios de API breaking | 100% |

---

## 7. Tests Requeridos

```typescript
describe("communications-rename-fase2") {
  it("prisma client expone communicationThread y communication")
  it("communications.repository.listThreads lee de CommunicationThread")
  it("communications.repository.listMessages lee de Communication")
  it("upsertThreadFromInbound crea threads y mensajes correctamente")
  it("no hay referencias a conversationThread/conversationMessage en el código")
  it("Prisma generate se ejecuta sin errores")
}
```

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Acción requerida |
|---------|---------|-----------------|
| Communications | Alto | Renombrar modelos, relaciones y repository |
| Assistant | Bajo | `ConversationMessage` es un tipo local de assistant; no afectado |
| AI Context | Bajo | `ConversationMessage` es un tipo de contexto LLM; no afectado |
| Notifications/OutboundDelivery | Medio | FK `threadId` ahora apunta a `CommunicationThread`; sin cambio de código |

---

## 9. Supuestos y Dependencias

- Fase 1 (`MessageThread`/`Message` legacy) ya fue mergeada.
- `CommunicationThread`/`Communication` son los nombres canónicos del dominio `communications`.
- Los DTOs `CommunicationThreadRecord`/`CommunicationMessageRecord` conservan sus nombres para no romper BFF/web.

---

## Checklist de aprobación

- [x] Escenario P1 con Given/When/Then
- [x] Contratos/API documentados (sin cambios)
- [x] Impacto en otros dominios documentado
- [x] Tests requeridos listados
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada
- [x] Spec agregado a `docs/SPEC_INDEX.md`
- [x] Status cambiado a `APPROVED`
