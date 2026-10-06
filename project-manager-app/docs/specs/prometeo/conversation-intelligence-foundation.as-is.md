# AS-IS — Conversation Intelligence Foundation (`prometeo.conversation-intelligence`)

Fecha: 2026-10-06. Cumple **CI-001** (inspeccionar schema y servicios reales) y **CI-003** (convención de
`correlationId`) de la Ola 0. Todo lo de aquí está verificado en el código de `main` en esa fecha; lo que no se pudo
comprobar se dice como tal.

## 1. Modelos reales (`packages/db/prisma/schema.prisma`)

| Modelo | Hechos relevantes |
|---|---|
| `ConversationSession` | `id`, `tenantId`, `userId`, `draftId?`, `flow?`, `pageRoute?`, `messages Json @default("[]")`, `createdAt`, `updatedAt`. **No tiene `orgId`.** Índice `(tenantId, userId)`. |
| `CommunicationThread` | `tenantId`, `orgId?`, `channel` (`CommunicationProvider`), `externalThreadId?`, `contactUserId?`, `jobId?`, `projectId?`, `source String @default("communications")`, `lastMessageAt?`. Único `(tenantId, channel, externalThreadId)`. |
| `Communication` | `tenantId`, `threadId`, `direction` (`INBOUND`/`OUTBOUND`), `provider`, `externalMessageId?`, `senderUserId?`, `body?`, `rawPayloadJson?`, `status`, `sentAt?`, `createdAt`. Único `(tenantId, provider, externalMessageId)`. Índice `(tenantId, threadId, createdAt)`. **No tiene `sequence`, `occurredAt` ni `contentHash`.** |
| Enum `CommunicationProvider` | `WHATSAPP_CLOUD`, `OPENWA_LAB`, `SMS`, `EMAIL`, **`WEB_CHAT`** (ya existe: no hace falta un valor nuevo). |

## 2. Cómo se guarda hoy la conversación del asistente (`assistant.service.ts`)

- `handlePublishJob` crea la `ConversationSession` con `flow: "publish_job"` y, en cada turno, **reescribe todo el
  array** `messages` con `{ role: "user" | "assistant", content: string }`.
- Cada mensaje legacy tiene **solo `role` y `content`: sin id, sin instante y sin orden explícito** (el orden es la
  posición en el array). Por tanto `occurredAt` y la identidad por mensaje **no pueden reconstruirse** para lo ya
  guardado: la spec acierta al exigir `occurredAt = null` y `sequence` = índice original.
- La sesión no guarda `orgId`: el `orgId` del hilo canónico solo puede llenarse con una relación inequívoca, y de la
  sesión sola no la hay → `null` (como exige la spec).

## 3. Cómo se mapea (contrato de la spec, §5) — sin cambios aquí

`CommunicationThread`: `channel = WEB_CHAT`, `source = "assistant"`, `externalThreadId = "assistant:<ConversationSession.id>"`,
`contactUserId = ConversationSession.userId`. `Communication` (backfill): `externalMessageId = "assistant:<sessionId>:<sequence>"`.

## 4. `correlationId` (CI-003)

- En el código existente no hay una convención única: los prefijos varían por flujo (p. ej. `copilot:<requestId>:<acción>`
  y `delegation_<id>`; las peticiones HTTP llevan un `requestId`). **No existe un `correlationId` para conversaciones
  legacy.**
- Decisión de contrato: el campo `correlationId` de un finding es **opcional** y solo se rellena con un valor real
  (el `requestId` de la petición que produjo el finding). **Nunca se inventa uno para datos legacy.**

## 5. Brechas frente a la spec (lo que implementarán las olas siguientes)

1. Columnas `sequence`, `occurredAt`, `contentHash` en `Communication` (aditivas, nulables) — Ola 1.
2. Dual-write detrás de flag y backfill idempotente — Olas 1–2.
3. Búsqueda determinista (literal + full-text `simple`) — Ola 3.
4. Seis tools Prometeo de solo lectura/auditoría — Ola 4.

## 6. Qué no se pudo verificar

- Volumen y forma real de `ConversationSession.messages` en producción (no hay acceso a la base): el diseño del backfill
  debe tolerar `messages` vacío, no-array y turnos sin `content` string.
- Si existen índices de texto en `Communication.body` (no hay ninguno en el esquema; el SQL final de la Ola 1 los define).
