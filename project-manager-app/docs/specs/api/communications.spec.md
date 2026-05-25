---
id: api-communications
title: "Communications Gateway API"
type: spec
feature: "Communications Gateway — WhatsApp & Inbox"
domain: "communications"
version: "1.0"
status: "APPROVED"
owner: semse-core
risk: high
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/communications
  - packages/schemas/src/communication.schema.ts
related_tests:
  - apps/api/test/communications-whatsapp-webhook-signature.test.ts
related_endpoints:
  - v1/communications
related_events: []
related_agents: []
last_verified: 2026-05-25
---

# Spec: Communications Gateway

> Gateway de comunicaciones omnicanal — actualmente WhatsApp vía Meta API.
> Permite enviar notificaciones a clientes y profesionales y recibir mensajes entrantes.
> Basado en `apps/api/src/modules/communications/communications.controller.ts`.

---

## 1. Qué resuelve

Centraliza todas las comunicaciones de SEMSE: notificaciones de milestone,
alertas de disputa, confirmaciones de pago. El inbox muestra el historial
de conversaciones por thread y permite responder directamente.

---

## 2. Actores y Permisos

| Actor | Permiso | Puede hacer |
|-------|---------|-------------|
| OPS_ADMIN | `communications:admin` | Crear canales, crear templates |
| CLIENT/PRO | `communications:read` | Ver threads y mensajes |
| CLIENT/PRO | `communications:write` | Enviar mensajes, procesar inbound |
| PLATFORM (webhook) | sin auth estándar | Recibir webhooks de Meta |

---

## 3. Contratos de API

### `POST /v1/communications/channel-accounts` — `communications:admin`
```yaml
input: { provider: "whatsapp", accountId, accessToken, phoneNumberId }
output: ChannelAccount registrado
efectos: auditLog: true
```

### `GET /v1/communications/channel-accounts` — `communications:read`
```yaml
output: array de ChannelAccount activos (sin tokens sensibles)
```

### `POST /v1/communications/templates` — `communications:admin`
```yaml
input: { name, provider, category, components[], language }
output: Template registrado
```

### `GET /v1/communications/templates` — `communications:read`
```yaml
output: array de templates por provider
```

### `GET /v1/communications/threads` — `communications:read`
```yaml
query: { status?, channel?, page?, limit? }
output: array de Thread paginado con { threadId, participant, lastMessage, unreadCount }
```

### `GET /v1/communications/threads/:threadId/messages` — `communications:read`
```yaml
output: array de Message { id, body, direction: "inbound"|"outbound", sentAt, status }
```

### `POST /v1/communications/send` — `communications:write`
```yaml
input:
  - to: string — número de teléfono o userId
  - channel: "whatsapp"
  - templateName?: string
  - body?: string
  - jobId?: string — contexto opcional
output: { messageId, status: "sent"|"queued" }
efectos: auditLog: true · notificacion registrada
```

### `POST /v1/communications/inbound` — `communications:write`
```yaml
input: mensaje entrante procesado internamente
output: confirmación de procesamiento
efectos: crea/actualiza Thread · registra Message
```

### `GET /v1/communications/webhooks/whatsapp` — verificación Meta
```yaml
query: { hub.mode, hub.verify_token, hub.challenge }
output: hub.challenge (si token válido)
nota: endpoint de verificación de Meta — no requiere auth SEMSE
```

### `POST /v1/communications/webhooks/whatsapp` — webhook Meta
```yaml
input: payload Meta WhatsApp Business API
output: 200 OK (Meta requiere respuesta < 20s)
efectos:
  - procesa mensajes entrantes → Thread/Message
  - dispara notificaciones internas
  - auditLog: false (volumen alto)
nota de seguridad: validar X-Hub-Signature-256 header
```

---

## 4. Tests Requeridos

```typescript
describe("GET /v1/communications/threads") {
  it("retorna threads del tenant del actor")
  it("filtra por status cuando se especifica")
  it("rechaza con 403 sin communications:read")
}
describe("POST /v1/communications/send") {
  it("envía mensaje WhatsApp y retorna messageId")
  it("rechaza con 403 sin communications:write")
}
describe("GET /v1/communications/webhooks/whatsapp") {
  it("retorna hub.challenge cuando verify_token es válido")
  it("rechaza cuando verify_token es inválido")
}
```

---

## 5. Gaps identificados

| Gap | Severidad |
|-----|-----------|
| `POST /webhooks/whatsapp` no valida `X-Hub-Signature-256` — riesgo de spoofing | 🔴 P1 |
| No hay rate limiting en el webhook de Meta — puede saturarse en picos | 🟡 Media |
| `GET /threads` no implementa paginación real actualmente | 🟡 Media |
| Tokens de canal (`accessToken`) deben almacenarse cifrados, no en texto plano | 🟡 Media |
