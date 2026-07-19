---
id: "core.communications-canonical-model"
title: "Modelo canónico de comunicaciones — eliminación de MessageThread/Message legacy"
type: spec
feature: "communications-canonical-model"
domain: "core"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
branch: "devin/consolidar-comunicaciones-fase1"
date: "2026-07-17"
author: "Devin"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/communications/communications.repository.ts
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20260717123000_remove_legacy_message_thread
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

# Spec: modelo canónico de comunicaciones

Elimina la duplicación de mensajería del núcleo de datos: las tablas legacy `MessageThread` / `Message` quedan fuera de uso y `ConversationThread` / `ConversationMessage` se establecen como la bandeja única de comunicaciones operativas. Fase 1 de la consolidación del dominio `communications`.

---

## 1. Qué resuelve

**Problema:** existen dos esquemas de mensajería en `schema.prisma`:
- Legacy: `MessageThread` / `Message` (relacionados con `Job` y `Project`, sin `tenantId`, sin consumidores).
- Activo: `ConversationThread` / `ConversationMessage` (módulo `communications`, WhatsApp/web, con `tenantId`, `channel`, `direction`, `status`).

Esto viola el principio de una sola fuente de verdad para comunicaciones y genera confusión sobre cuál bandeja usar.

**Solución:**
- Declarar `ConversationThread` / `ConversationMessage` como entidades canónicas de comunicaciones.
- Eliminar `MessageThread` / `Message` del esquema Prisma y de la base de datos.
- Documentar la ruta futura hacia `communication_threads` / `communications` (renombrado de tablas y modelos en fase 2, si se decide).

---

## 2. Actores y Permisos

No cambia permisos. Las operaciones sobre comunicaciones siguen usando:

| Actor | Permiso | Puede hacer |
|---|---|---|
| OPS_ADMIN | `communications:admin` | Configurar canales/templates |
| CLIENT/PRO | `communications:read` | Ver threads/mensajes |
| CLIENT/PRO | `communications:write` | Enviar mensajes o recibir inbound |

---

## 3. Escenarios de usuario (P1)

### P1 — No hay dos bandejas

```
DADO    que un operador consulta el schema de datos
CUANDO  revisa las tablas de comunicaciones
ENTONCES solo existe una bandeja activa (ConversationThread/ConversationMessage)
  Y     no existen tablas MessageThread/Message
```

### P1 — Los mensajes internos y externos coexisten en la misma entidad

```
DADO    que un thread tiene channel = WHATSAPP_CLOUD o WEB_CHAT
CUANDO  se lista la bandeja de comunicaciones
ENTONCES todos los mensajes se leen/escriben sobre ConversationThread/ConversationMessage
```

### P1 — No se rompen consumidores existentes

```
DADO    que el módulo communications repository usa prisma.conversationThread y prisma.conversationMessage
CUANDO  se eliminan MessageThread/Message
ENTONCES el módulo communications sigue compilando, pasando typecheck y tests unitarios
```

---

## 4. FSM

No aplica. La consolidación es un cambio de esquema; no cambia transiciones de estado de mensajes ni threads.

---

## 5. Contratos de API

No cambian los endpoints públicos. Siguen vigentes los contratos de `docs/specs/api/communications.spec.md`:
- `GET /v1/communications/threads`
- `GET /v1/communications/threads/:threadId/messages`
- `POST /v1/communications/send`
- `POST /v1/communications/inbound`
- `GET/POST /v1/communications/webhooks/whatsapp`

La respuesta JSON sigue usando los tipos locales `CommunicationThreadRecord` y `CommunicationMessageRecord` del repositorio.

---

## 6. Criterios de éxito

| Métrica | Valor objetivo |
|---|---|
| Tablas duplicadas eliminadas | `MessageThread`, `Message` fuera del schema |
| Consumidores rotos | 0 |
| `pnpm lint` | 0 errores en API/web |
| `pnpm typecheck` | pass |
| `pnpm --filter @semse/api test:unit` | 0 fallos nuevos |
| `pnpm spec:preflight` | pass |

---

## 7. Tests requeridos

- [ ] `pnpm typecheck` pasa tras regenerar el cliente Prisma.
- [ ] `pnpm lint` no reporta errores.
- [ ] `pnpm --filter @semse/api test:unit` mantiene cobertura actual.
- [ ] `pnpm spec:preflight` pasa (no rompe contratos SDD existentes).

No se requieren tests funcionales nuevos porque no cambia el comportamiento de negocio: solo elimina tablas sin consumidores.

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Acción requerida |
|---|---|---|
| communications | Sí | Ninguna funcional; solo limpieza de esquema |
| Prisma/DB | Sí | Migración `DROP TABLE` legacy |
| API (todos los módulos) | No | Ninguna referencia a MessageThread/Message |
| Web | No | No usa modelos Prisma directamente |
| Prometeo | No | No consume MessageThread/Message |

---

## 9. Supuestos y dependencias

- `MessageThread` / `Message` no tienen datos productivos activos. No hay consumidores de código.
- Si existen datos legacy, deben migrarse manualmente antes de aplicar la migración en producción (no se incluye data migration por ausencia de mapeo de `tenantId`).
- El renombrado de `ConversationThread` → `CommunicationThread` y `ConversationMessage` → `Communication` (con `@@map`) queda como fase 2 opcional; esta fase no lo toca para minimizar riesgo.

---

## 10. Plan de migración

1. Editar `packages/db/prisma/schema.prisma`:
   - Eliminar modelos `MessageThread` y `Message`.
   - Eliminar campos de relación `messages`, `messageThreads` de `User`, `Job` y `Project`.
2. Crear migración `packages/db/prisma/migrations/20260717123000_remove_legacy_message_thread/migration.sql`:
   - `DROP TABLE "Message" CASCADE;`
   - `DROP TABLE "MessageThread" CASCADE;`
3. Ejecutar `pnpm db:generate` para regenerar el cliente Prisma.
4. Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm --filter @semse/api test:unit`, `pnpm spec:preflight`.
5. Actualizar `docs/SPEC_INDEX.md` con `pnpm spec:index`.
6. Crear PR con el spec, la migración y el schema actualizado.

---

## 11. Checklist de aprobación

- [x] Escenarios P1 con criterio Given/When/Then
- [x] Contratos de API sin cambios documentados
- [x] No viola `DOMAIN_INVARIANTS.md` (no cambia estados ni permisos)
- [x] Plan de migración y rollback (no aplica rollback de datos; rollback es recrear tablas desde backup/migración anterior)
- [x] Tests requeridos listados
- [x] Spec agregado a `docs/SPEC_INDEX.md`
- [x] Status `APPROVED`
