---
type: spec
feature: "Integration Map — Mapa de Integraciones del Ecosistema"
version: "1.0"
status: "APPROVED"
date: "2026-05-20"
spec_index: "docs/SPEC_INDEX.md"
---

# Integration Map: SEMSE OS

> Documenta cómo se comunican los servicios entre sí y con sistemas externos.

---

## 1. Arquitectura de servicios

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway (producción)                      │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │  Web     │    │  API     │    │  Worker              │  │
│  │ Next.js  │◄──►│ NestJS   │◄──►│ BullMQ               │  │
│  │ :3000    │    │ :4000    │    │ (background jobs)    │  │
│  └──────────┘    └──────────┘    └──────────────────────┘  │
│       │               │                    │                │
│       │          ┌────▼────┐         ┌─────▼──────┐        │
│       │          │ Postgres │         │   Redis    │        │
│       │          │ (Prisma) │         │ (BullMQ)   │        │
│       │          └─────────┘         └────────────┘        │
└───────┼───────────────────────────────────────────────────  ┘
        │
        ▼
   Browser / Mobile
```

---

## 2. Comunicación Web → API (BFF)

```
Next.js (apps/web)
  │
  ├── /api/* routes  →  server-side proxy  →  API NestJS
  │   (BFF layer — evita CORS, añade auth headers)
  │
  └── SSE: /api/sse/project/:id  →  API /v1/sse/project/:id
      (real-time events: milestone.submitted, payment.released, etc.)
```

**Contratos:**
- Web nunca llama directamente a la API del usuario — pasa por el BFF
- El BFF en `apps/web/app/api/` reenvía el JWT del cliente
- `SEMSE_API_BASE_URL` es la variable de entorno que conecta Web → API

---

## 3. Comunicación API → Worker

```
API NestJS  →  BullMQ Queue (Redis)  →  Worker BullMQ

Jobs de queue:
- intake-analyze      : análisis asíncrono de smart intake
- embedding-generate  : generación de embeddings para RAG
- notification-send   : envío de notificaciones WhatsApp
- evidence-review     : review asíncrona de evidencia (largo plazo)
- payment-process     : procesamiento de intents de pago
```

**Contratos:**
- Worker no tiene acceso directo a Prisma en producción — usa la API HTTP
- Worker se autentica con un token de servicio interno (`SEMSE_WORKER_TOKEN`)
- Jobs fallidos van a dead-letter queue tras `maxAttempts` intentos

---

## 4. Integraciones Externas

### LLM Providers

```
API NestJS
  │
  ├── Ollama (local/Railway)  ─►  privacyCritical=true
  │   docker.internal:11434     evidence review, rag-query con jobId
  │
  ├── Anthropic (Claude)      ─►  privacyCritical=false
  │   api.anthropic.com          resúmenes, chat general, prometeo público
  │
  └── OpenAI                  ─►  privacyCritical=false
      api.openai.com             embeddings (text-embedding-ada-002)
```

**Variables Railway requeridas:**
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OLLAMA_BASE_URL` (Railway internal URL)

### Storage

```
API NestJS  →  evidencia presign  →  URL de upload
                                          │
                                    [filesystem local en dev]
                                    [S3-compatible en prod]
                                          │
                              Cliente sube directo al storage
                                          │
                              API registra la key en DB
```

**Variables Railway:**
- `SEMSE_MULTIPART_STORAGE_ROOT` — ruta de sesiones multipart
- `SEMSE_API_BASE_URL` — usada para construir upload URLs

### Stripe (Pagos)

```
API NestJS  →  PaymentProviderRegistry
               ├── MockPaymentProvider (dev)
               └── StripePaymentProvider (prod)
                       │
                       ├── createPayoutIntent → Stripe API
                       └── webhook ← Stripe events
                           POST /v1/payments/webhook
                           Header: Stripe-Signature (validar)
```

**Variables Railway:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### WhatsApp / Meta

```
Meta WhatsApp Business API
  │
  ├── Verificación webhook  ←  GET /v1/communications/webhooks/whatsapp
  │   verify_token: WHATSAPP_VERIFY_TOKEN
  │
  └── Mensajes entrantes    ←  POST /v1/communications/webhooks/whatsapp
      X-Hub-Signature-256: validar con WHATSAPP_APP_SECRET
      │
      ─► communications.service.processInbound()
```

**Variables Railway:**
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`

---

## 5. web-assistant-portal ↔ project-manager-app

```
web-assistant-portal (semseproject repo)
  │
  ├── server/lib/core-api.client.ts
  │   HTTP calls →  project-manager-app API (:4000)
  │
  └── server/semse.router.ts
      tRPC bridge → expone endpoints de SEMSE a la UI del portal
```

**Variables en web-assistant-portal:**
- `OAUTH_SERVER_URL` — autenticación delegada a la API principal
- `BUILT_IN_FORGE_API_URL` — URL del API de project-manager-app

**Nota:** web-assistant-portal es un cliente externo. No tiene acceso directo a la DB de SEMSE.

---

## 6. Variables de entorno por servicio (Railway)

| Variable | Servicio | Propósito |
|----------|---------|-----------|
| `DATABASE_URL` | API, Worker | Prisma → PostgreSQL |
| `REDIS_URL` | API, Worker | BullMQ queue |
| `SEMSE_API_BASE_URL` | Web | BFF URL hacia API |
| `AUTH_SECRET` | API, Web | JWT signing |
| `ANTHROPIC_API_KEY` | API | LLM Claude |
| `OPENAI_API_KEY` | API | Embeddings |
| `OLLAMA_BASE_URL` | API | LLM local privacyCritical |
| `STRIPE_SECRET_KEY` | API | Pagos |
| `STRIPE_WEBHOOK_SECRET` | API | Validación webhook |
| `WHATSAPP_VERIFY_TOKEN` | API | Meta verification |
| `WHATSAPP_APP_SECRET` | API | Meta signature |
| `WHATSAPP_PHONE_NUMBER_ID` | API | Canal WhatsApp |
| `WHATSAPP_ACCESS_TOKEN` | API | Meta API token |
