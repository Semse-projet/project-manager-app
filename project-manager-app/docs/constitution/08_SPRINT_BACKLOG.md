---
version: 1.0.0
fecha: 2026-03-30
estado: canonical
owner: arquitecto-principal
fase_activa: Fase 2 — MVP Marketplace
sprint_activo: Sprint 2.1
---

# 08_SPRINT_BACKLOG — Backlog Activo de SEMSEproject

## Propósito

Backlog priorizado por impacto con tickets concretos, archivos a tocar y criterios de done.
Este documento es el artefacto vivo de ejecución. Se actualiza al completar cada sprint.

---

## Estado del sistema al 2026-03-30

| Capacidad | Estado |
|---|---|
| Auth completo (login/register/me + JWT + guards globales) | Operativo |
| 15 módulos NestJS respondiendo | Operativo |
| AuditLog persistente (AuditService) | Operativo |
| Smoke test 24/24 | Pasado |
| Seed: tenant semse, 4 roles, 22 permisos | Operativo |
| AgentRun CRUD + worker polling | Operativo |
| FieldOps completo (FieldUnit, Worklog, KnowledgeFact) | Operativo |
| Flujo completo job→payment de punta a punta | PENDIENTE |
| Storage S3/R2 real | PENDIENTE |
| Payment provider real | PENDIENTE |
| Refresh tokens | PENDIENTE |
| BullMQ con Redis | PENDIENTE |
| Frontend completamente conectado a API | PENDIENTE |
| LLM real en agentes | PENDIENTE |

---

## SPRINT 2.1 — Auth hardening + API completitud jobs/bids

**Objetivo**: Cerrar huecos críticos de auth y completar la lógica de jobs y bids.
**Período**: Semana 1 (desde 2026-03-30)
**Prioridad**: P0

---

### TICKET 2.1.1 — Refresh tokens y logout
**Impacto**: Seguridad y experiencia de sesión real
**Archivos a tocar**:
- `apps/api/src/modules/auth/auth.controller.ts` — añadir `POST /v1/auth/refresh`, `POST /v1/auth/logout`
- `apps/api/src/modules/auth/auth.service.ts` — lógica de refresh token
- `packages/db/prisma/schema.prisma` — añadir `RefreshToken` model (si va a DB) o usar Redis

**Modelo sugerido para DB**:
```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

**Criterio de done**:
- `POST /v1/auth/refresh` devuelve nuevo accessToken (15m) + nuevo refreshToken (7d)
- `POST /v1/auth/logout` revoca el refreshToken activo
- RefreshToken rotado en cada uso (anti-replay)

---

### TICKET 2.1.2 — Unificar permisos entre rbac.ts y seed.ts
**Impacto**: Consistencia de seguridad en todo el sistema
**Problema**: `apps/api/src/common/rbac.ts` tiene permisos granulares (ej: `bids:accept`) que no coinciden con los permisos del seed (ej: `bids:read`, `bids:write`). Los guards actuales usan `rbac.ts` pero el seed usa otros keys.
**Archivos a tocar**:
- `apps/api/src/common/rbac.ts` — fuente de verdad de permisos granulares
- `packages/db/prisma/seed.ts` — alinear con rbac.ts
- Ejecutar `prisma db seed` después del cambio

**Criterio de done**:
- Los keys de `rbac.ts` y `seed.ts` son idénticos
- Test: usuario con rol CLIENT tiene acceso a `jobs:create` y no tiene acceso a `disputes:resolve`

---

### TICKET 2.1.3 — Jobs: filtros de búsqueda completos
**Impacto**: Core del marketplace — sin filtros no hay discovery
**Archivos a tocar**:
- `apps/api/src/modules/jobs/jobs.controller.ts` — query params: `status`, `category`, `location`, `budgetMin`, `budgetMax`, `urgency`, `page`, `limit`
- `apps/api/src/modules/jobs/jobs.service.ts` — Prisma where clause con filtros
- `apps/api/src/modules/jobs/jobs.repository.ts` — query con filtros

**Criterio de done**:
- `GET /v1/jobs?status=PUBLISHED&category=construccion&budgetMax=5000` devuelve resultados correctos
- Paginación funciona con `page` y `limit`
- AuditLog registra búsquedas relevantes

---

### TICKET 2.1.4 — Bids: lógica completa de selección y rechazo
**Impacto**: Sin esto el ciclo jobs→contracts no puede avanzar
**Archivos a tocar**:
- `apps/api/src/modules/bids/bids.controller.ts` — `PUT /v1/bids/:id/accept`, `PUT /v1/bids/:id/reject`, `PUT /v1/bids/:id/withdraw`
- `apps/api/src/modules/bids/bids.service.ts` — lógica: al aceptar bid → crear JobReservation → cambiar Job.status a RESERVED

**Criterio de done**:
- `PUT /v1/bids/:id/accept` → Bid.status = ACCEPTED + JobReservation creada + Job.status = RESERVED
- `PUT /v1/bids/:id/reject` → Bid.status = REJECTED + AuditLog
- Solo el clientOrg del job puede aceptar bids

---

## SPRINT 2.2 — Flujo completo jobs → contracts → milestones

**Objetivo**: Orquestar el flujo de punta a punta sin brechas.
**Período**: Semana 2
**Prioridad**: P0

---

### TICKET 2.2.1 — Reservations → Contracts: flujo de firma
**Archivos a tocar**:
- `apps/api/src/modules/reservations/reservations.service.ts` — confirmar reserva → crear borrador de Contract
- `apps/api/src/modules/contracts/contracts.controller.ts` — `POST /v1/contracts/:id/sign` (cliente y pro por separado)
- `apps/api/src/modules/contracts/contracts.service.ts` — lógica dual-signature: cuando ambos firman → Contract.status = ACTIVE → crear Project

**Criterio de done**:
- Reservation confirmada → Contract en estado DRAFT creado automáticamente
- Cliente firma → `signedClientAt` seteado
- Pro firma → `signedProAt` seteado → Contract = ACTIVE → Project creado automáticamente

---

### TICKET 2.2.2 — PolicyService: evaluar PolicyRule en milestones
**Archivos a crear**:
- `apps/api/src/infrastructure/policy/policy.service.ts` — evaluador de condiciones JSON
- `apps/api/src/infrastructure/policy/policy.module.ts`

**Integración requerida**:
- `MilestonesModule` — llamar a PolicyService antes de `approve`

**Criterio de done**:
- PolicyService puede evaluar una `PolicyRule` con condiciones JSON
- Si PolicyRule bloquea aprobación de milestone → 403 con razón explícita
- Un PolicyRule de ejemplo seedeado para demostrar evaluación

---

### TICKET 2.2.3 — AuditLog en todos los flujos críticos
**Problema**: Algunos módulos no tienen `AuditService.append()` en sus transiciones.
**Archivos a tocar**:
- `apps/api/src/modules/jobs/jobs.service.ts` — AuditLog en publish, cancel, status change
- `apps/api/src/modules/bids/bids.service.ts` — AuditLog en accept, reject
- `apps/api/src/modules/contracts/contracts.service.ts` — AuditLog en create, sign
- `apps/api/src/modules/reservations/reservations.service.ts` — AuditLog en confirm, expire

**Criterio de done**:
- Cada transición de estado relevante genera exactamente un AuditLog
- `GET /v1/ops/audit` muestra el historial completo de un job

---

## SPRINT 2.3 — Evidencia real + Pagos con provider real

**Objetivo**: Storage S3/R2 funcional y pago real (sandbox).
**Período**: Semana 3
**Prioridad**: P1

---

### TICKET 2.3.1 — Storage S3/R2 para evidencia
**Archivos a crear**:
```
apps/api/src/modules/evidence/storage/
  ├── storage.service.ts        -- pre-sign URL para upload directo
  ├── storage.config.ts         -- configuración de bucket (env vars)
  └── storage.types.ts
```
**Consideración**: Usar Cloudflare R2 (gratuito en dev) o AWS S3.
**Variables de entorno**:
- `STORAGE_PROVIDER=r2` (o `s3`)
- `STORAGE_BUCKET=semse-evidence`
- `STORAGE_ENDPOINT=...`
- `STORAGE_ACCESS_KEY=...`
- `STORAGE_SECRET_KEY=...`

**Criterio de done**:
- `POST /v1/evidence/presign` devuelve URL firmada para upload directo
- `POST /v1/evidence` registra la evidencia con `bucketKey` real
- Evidencia accesible desde URL pública o firmada

---

### TICKET 2.3.2 — Payment provider real (Stripe sandbox)
**Archivos a crear**:
```
apps/api/src/modules/payments/providers/
  └── stripe.provider.ts        -- implementa PaymentProviderInterface
```
**Variables de entorno**:
- `PAYMENT_PROVIDER=stripe`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

**Criterio de done**:
- Depósito de escrow procesa en Stripe sandbox
- Webhook de confirmación actualiza PaymentEscrow en DB
- Release de hito transfiere fondos en Stripe sandbox

---

### TICKET 2.3.3 — Disputes flujo completo
**Archivos a tocar**:
- `apps/api/src/modules/disputes/disputes.controller.ts` — añadir: `POST /v1/disputes/:id/assign`, `POST /v1/disputes/:id/submit-evidence`, `POST /v1/disputes/:id/propose-resolution`
- `apps/api/src/modules/disputes/disputes.service.ts` — transiciones de estado completas

**Criterio de done**:
- Disputa puede pasar por: OPEN → ASSIGNED → UNDER_REVIEW → RESOLVED
- Solo OPS_ADMIN puede assign y resolve
- AuditLog en cada transición

---

## SPRINT 2.4 — BullMQ + expiración de reservas + notificaciones

**Objetivo**: Worker robusto con Redis + BullMQ. Notificaciones básicas activas.
**Período**: Semana 4
**Prioridad**: P1

---

### TICKET 2.4.1 — Provisionar Redis en Docker
**Archivos a crear/modificar**:
```
infra/docker-compose.yml        -- añadir redis service
packages/db/.env                -- añadir REDIS_URL=redis://localhost:6379
```

**Criterio de done**:
- `docker-compose up redis` levanta Redis
- `apps/api` puede conectarse a Redis

---

### TICKET 2.4.2 — Migrar worker de polling HTTP a BullMQ
**Archivos a modificar**:
```
apps/worker/src/
  └── (reescribir main.mjs → processors BullMQ)
apps/api/src/modules/agents/
  └── (encolar AgentRun en BullMQ en lugar de solo crear en DB)
```

**Criterio de done**:
- AgentRun encolado en BullMQ al crearse
- Worker procesa runs desde BullMQ (no polling HTTP)
- Heartbeat y reclaim con lógica de stale jobs

---

### TICKET 2.4.3 — Timer de expiración de reservas
**Archivos a crear**:
```
apps/api/src/modules/reservations/
  └── reservation-expiry.processor.ts  -- BullMQ job: expirar reservas pasado TTL
```

**Criterio de done**:
- Reserva con `expiresAt` pasado cambia a `EXPIRED` automáticamente
- Job vuelve a `PUBLISHED` cuando reserva expira
- AuditLog registra la expiración

---

### TICKET 2.4.4 — NotificationService básico
**Archivos a crear**:
```
apps/api/src/modules/notifications/
  ├── notifications.module.ts
  ├── notifications.service.ts  -- createNotification(userId, type, payload)
  ├── notifications.controller.ts
  │   -- GET /v1/notifications (lista del usuario autenticado)
  │   -- PATCH /v1/notifications/:id/read
  └── notifications.types.ts
```

**Notificaciones a disparar en esta fase**:
- `milestone_submitted` — cuando pro sube milestone
- `milestone_approved` — cuando cliente aprueba milestone
- `payment_released` — cuando se libera pago
- `dispute_opened` — cuando se abre disputa
- `reservation_created` — cuando pro recibe reserva

**Criterio de done**:
- Notificaciones se crean en DB en cada evento listado
- `GET /v1/notifications` devuelve notificaciones del usuario autenticado
- `PATCH /v1/notifications/:id/read` marca como leída

---

## SPRINT 2.5 — Frontend completamente conectado a API real

**Objetivo**: El usuario puede ejecutar el flujo completo desde el browser.
**Período**: Semana 5
**Prioridad**: P1

---

### TICKET 2.5.1 — Jobs list y detail conectados a API real
**Archivos a tocar**:
```
apps/web/app/jobs/page.tsx         -- conectar a GET /v1/jobs con filtros
apps/web/app/jobs/new/page.tsx     -- conectar a POST /v1/jobs
apps/web/app/jobs/[jobId]/page.tsx -- conectar a GET /v1/jobs/:id
```

**Criterio de done**:
- Lista de jobs paginada y filtrable
- Crear job funciona con token JWT real
- Detalle de job muestra bids, reservation, contract, milestones

---

### TICKET 2.5.2 — Auth con JWT real en frontend
**Archivos a tocar**:
```
apps/web/app/login/page.tsx        -- conectar a POST /v1/auth/login
apps/web/middleware.ts             -- validar JWT en server-side
apps/web/lib/auth.ts               -- helpers de token storage y refresh
```

**Criterio de done**:
- Login guarda JWT en cookie httpOnly
- Refresh automático cuando accessToken expira
- Logout revoca refreshToken

---

### TICKET 2.5.3 — Dashboard conectado a datos reales
**Archivos a tocar**:
```
apps/web/app/dashboard/page.tsx    -- conectar a GET /v1/ops/dashboard
```

**Criterio de done**:
- Dashboard muestra conteos reales de jobs, projects, disputes, agents

---

### TICKET 2.5.4 — Smoke test E2E con browser real
**Archivos a crear**:
```
tests/e2e/
  └── full-flow.spec.ts            -- Playwright: create job → bid → contract → milestone → payment
```

**Criterio de done del Sprint 2.5 y Fase 2**:
- Test E2E pasa en CI
- Flujo completo documentado con capturas de pantalla
- `08_SPRINT_BACKLOG.md` actualizado con resultados

---

## TICKETS DE DEUDA TÉCNICA (no bloqueantes pero importantes)

### DEUDA-01 — Tests de integración para módulos críticos
**Prioridad**: P2 — hacer en Fase 2 paralelo al desarrollo
**Módulos a cubrir**: AuthModule, JobsModule, MilestonesModule, PaymentsModule
**Framework**: Jest + Supertest + base de datos de test

### DEUDA-02 — Rate limiting en API
**Prioridad**: P2
**Archivos a tocar**: `apps/api/src/common/` — añadir `ThrottleGuard` con Redis

### DEUDA-03 — OpenAPI / Swagger documentación
**Prioridad**: P2
**Archivos a tocar**: `apps/api/src/main.ts` — habilitar Swagger
**Criterio**: Todos los endpoints documentados con DTO schemas

### DEUDA-04 — Consolidar web-assistant-portal
**Prioridad**: P3
**Módulos a migrar**: auth, jobs API, contracts API → al monorepo canónico
**Archivos destino**: ya existen en `apps/api/`

### DEUDA-05 — Eliminar tokens ad-hoc en apps/web
**Prioridad**: P2
**Problema**: Algunas rutas del frontend tienen tokens hardcodeados para dev
**Solución**: Usar cookies httpOnly con refresh automático

---

## Tickets de Fase 3 (referencia — no ejecutar hasta completar Fase 2)

| ID | Descripción | Sprint |
|---|---|---|
| 3.0.1 | AgentMemory model + pgvector migration | 3.0 |
| 3.0.2 | BullMQ queues por tipo de agente | 3.0 |
| 3.1.1 | Pricing Agent con OpenAI real | 3.1 |
| 3.2.1 | Trust Match Agent + embeddings de perfiles | 3.2 |
| 3.2.2 | Job Planner Agent con generación de milestones | 3.2 |
| 3.3.1 | Evidence Coach Agent con Vision API | 3.3 |
| 3.4.1 | Risk Assessment Agent — rules + LLM hybrid | 3.4 |
| 3.5.1 | Dispute Resolution Agent — HITL obligatorio | 3.5 |
| 3.6.1 | Orchestrator — multi-agent coordination | 3.6 |
| 3.6.2 | ECV — validación ética de outputs | 3.6 |
| 3.7.1 | Activar 16 agentes nombrados en Cortex | 3.7 |

---

## Criterio de completitud de Fase 2

La Fase 2 está DONE cuando:

- [ ] Refresh tokens implementados
- [ ] Flujo completo job → bid → reservation → contract → milestone → evidence → payment ejecutado en producción
- [ ] Storage S3/R2 real funcionando para evidencia
- [ ] Payment provider real (sandbox) procesando depósitos y releases
- [ ] Disputas con flujo completo de resolución
- [ ] BullMQ + Redis provisionados
- [ ] Timer de expiración de reservas activo
- [ ] NotificationService con 5 tipos de notificación activos
- [ ] Frontend completamente conectado a API real
- [ ] Test E2E pasando en CI
- [ ] Permisos unificados entre rbac.ts y seed
- [ ] PolicyService integrado en milestones

---

## Registro de decisiones de este sprint

| Decisión | Justificación | Fecha |
|---|---|---|
| Usar polling HTTP → BullMQ en Sprint 2.4 (no ahora) | Mantener momentum de funcionalidad. BullMQ agrega complejidad que bloquea Fase 2 si se hace antes | 2026-03-30 |
| Usar Cloudflare R2 para storage en dev | Costo cero en dev, misma API que S3, evita billing de AWS | 2026-03-30 |
| Stripe sandbox para payments en Fase 2 | API bien documentada, sandbox gratuito, ampliamente adoptado | 2026-03-30 |
| RefreshToken en DB (no Redis) en primera iteración | Redis no está provisionado aún. DB es más simple y auditable | 2026-03-30 |
| PolicyService como infraestructura interna (no módulo) | Evita circularidad con todos los módulos que lo consumen | 2026-03-30 |
