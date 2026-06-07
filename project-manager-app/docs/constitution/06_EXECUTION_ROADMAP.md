---
version: 2.0.0
fecha: 2026-03-30
estado: canonical
owner: arquitecto-principal
changelog: Actualizado para reflejar estado real post-smoke-test-24/24. Fase 0 y Fase 1 completadas. Fase 2 en curso.
---

# 06_EXECUTION_ROADMAP — Roadmap Ejecutable de SEMSEproject

## Propósito

Este es el documento de ejecución. Define qué se construye, en qué orden, con qué criterio de completitud y con qué archivos concretos. Cada fase tiene un criterio de "done" que determina cuándo avanzar a la siguiente.

**Regla de fases**: No se inicia una fase hasta que la anterior haya cumplido su criterio de done. Excepto trabajo de preparación que no genera deuda.

---

## Resumen de fases al 2026-03-30

| Fase | Nombre | Período | Estado actual |
|---|---|---|---|
| Fase 0 | Fundación | Completada | DONE |
| Fase 1 | Consolidación crítica | Semanas 1-3 desde 2026-03-28 | DONE |
| Fase 2 | MVP Marketplace | Semanas 4-8 | EN CURSO — Sprint 2.1 activo |
| Fase 3 | Capa Agéntica | Semanas 9-14 | PENDING |
| Fase 4 | Ops + Trust + Scale | Meses 4-6 | PENDING |
| Fase 5 | Prometeo | Horizonte | VISION |

---

## Fase 0 — Fundación (DONE)

### Qué se hizo

- Monorepo NestJS + Next.js + Prisma establecido en `project-manager-app`
- Schema Prisma inicial con entidades base
- Scaffolding de 15 módulos NestJS
- Packages del monorepo: `@semse/db`, `@semse/schemas`, `@semse/ui`, `@semse/auth`, `@semse/agents`, `@semse/shared`
- Documentación estratégica consolidada en `labsemse/`
- Pieza Maestra creada: documentos canónicos 01-07

### Criterio de done (cumplido)
- El monorepo existe y compila sin errores
- El schema Prisma tiene las entidades principales del dominio
- Los documentos de visión y programa están consolidados y son coherentes entre sí

---

## Fase 1 — Consolidación Crítica (DONE)

### Qué se logró

**Sprint 1.1 — Auth real y RBAC (COMPLETADO)**
- `POST /v1/auth/login` con JWT real (bcrypt + HMAC fallback)
- `POST /v1/auth/register` con tenant, org y role asignados
- `GET /v1/auth/me` con contexto completo del actor
- `AuthGuard` global (JWT Bearer) — todos los endpoints protegidos por defecto
- `RbacGuard` global con `@RequirePermissions()` decorator
- `@Public()` decorator para rutas públicas
- `@CurrentUser()` decorator
- Seed con tenant `semse`, 4 roles (CLIENT/PRO/OPS_ADMIN/WORKER), 22 permisos

**Sprint 1.2 — EventLog y auditoría persistente (COMPLETADO)**
- `AuditService.append()` operativo
- `AuditLog` model persistido en PostgreSQL
- `OpsModule` con `GET /v1/ops/audit`, dashboard, risk-scores
- Todos los módulos principales escriben AuditLog en cambios de estado

**Sprint 1.3 — Base de datos unificada (EN PROGRESO)**
- PostgreSQL es la base activa del monorepo
- MySQL en `web-assistant-portal` sigue en paralelo (transitional)
- 6 migraciones aplicadas

**Sprint 1.4 — Smoke test 24/24 (COMPLETADO)**
- Todos los 24 endpoints smoke test pasan
- Módulos respondiendo: jobs, bids, projects, milestones, evidence, contracts, disputes, payments, reservations, trust, agents, ops, field-ops

### Criterio de done (cumplido)
- Auth unificado en monorepo con JWT + RBAC
- AuditLog persistente en PostgreSQL
- Smoke test 24/24 pasado
- 15 módulos NestJS respondiendo con guards globales

---

## Fase 2 — MVP Marketplace (Semanas 4-8, desde 2026-03-30)

### Objetivo

Implementar el flujo canónico completo de punta a punta: crear job → bid → reserva → contrato → hito → evidencia → aprobación → pago → cierre.

Al final de esta fase, SEMSEproject puede ejecutar un trabajo real de verdad.

---

### Sprint 2.1 — API completitud y auth hardening (semana 4)

**Problemas a resolver:**
1. Refresh tokens no implementados
2. Permisos en `rbac.ts` vs seed tienen granularidades distintas — unificar
3. Jobs CRUD necesita filtros de búsqueda completos
4. Bids necesitan lógica de selección/rechazo

**Archivos a modificar:**

```
apps/api/src/modules/auth/
  ├── auth.controller.ts        -- añadir POST /v1/auth/refresh, POST /v1/auth/logout
  └── auth.service.ts           -- lógica refresh token con Redis o DB

packages/db/prisma/
  └── schema.prisma             -- añadir RefreshToken model (si va a DB)

apps/api/src/common/
  └── rbac.ts                   -- unificar permisos con seed.ts

apps/api/src/modules/jobs/
  ├── jobs.controller.ts        -- filtros: status, category, location, budgetMin/Max
  └── jobs.service.ts           -- validaciones de estado, transiciones

apps/api/src/modules/bids/
  ├── bids.controller.ts        -- PUT /v1/bids/:id/accept, /reject, /withdraw
  └── bids.service.ts           -- límite bids por job, lógica de selección
```

**Criterio de done del sprint:**
- `POST /v1/auth/refresh` rota token correctamente
- `GET /v1/jobs?status=PUBLISHED&category=construccion` devuelve resultados filtrados
- `PUT /v1/bids/:id/accept` acepta bid y genera reserva automáticamente
- Permisos unificados entre `rbac.ts` y seed

---

### Sprint 2.2 — Flujo completo jobs → contracts → milestones (semana 5)

**Problema**: Las piezas existen pero el flujo de punta a punta no está orquestado.

**Archivos a crear/modificar:**

```
apps/api/src/modules/jobs/
  └── jobs.service.ts           -- crear transición: bid accept → create JobReservation

apps/api/src/modules/reservations/
  ├── reservations.controller.ts  -- confirmar reserva → crear contrato
  └── reservations.service.ts

apps/api/src/modules/contracts/
  ├── contracts.controller.ts   -- POST firmar (clientSigned, proSigned)
  ├── contracts.service.ts      -- lógica de firma dual, transición a ACTIVE
  └── dto/                      -- ContractCreateDto, SignatureDto

apps/api/src/modules/milestones/
  ├── milestones.service.ts     -- integrar PolicyService en approve/reject
  └── milestones.policy.ts      -- evaluar PolicyRule antes de aprobar hito

apps/api/src/infrastructure/policy/
  ├── policy.service.ts         -- evaluador de PolicyRule en DB
  └── policy.module.ts
```

**Criterio de done del sprint:**
- Flujo completo: bid accepted → reserva → contrato firmado → primer milestone creado
- PolicyService evaluado en `approve` de milestone
- Todo el flujo genera AuditLog trazables

---

### Sprint 2.3 — Evidencia y pagos reales (semana 6)

**Problema**: Storage es mock y payment provider es mock.

**Archivos a crear/modificar:**

```
apps/api/src/modules/evidence/
  ├── evidence.controller.ts    -- pre-sign URL, upload confirmation
  ├── evidence.service.ts       -- actualizar con bucketKey real
  └── storage/
      ├── storage.service.ts    -- S3/R2 pre-sign upload URL
      └── storage.config.ts     -- configuración de bucket

apps/api/src/modules/payments/providers/
  └── stripe.provider.ts        -- o conekta.provider.ts según mercado objetivo

apps/api/src/modules/disputes/
  ├── disputes.controller.ts    -- assign, submit-evidence, resolve
  └── disputes.service.ts       -- flujo completo: OPEN→ASSIGNED→UNDER_REVIEW→RESOLVED
```

**Criterio de done del sprint:**
- Evidencia se sube a S3/R2 real con pre-sign URL
- Payment provider real procesa depósito de escrow (o sandbox de Stripe)
- Disputa puede pasar por flujo completo hasta resolución

---

### Sprint 2.4 — Worker con BullMQ + expiración de reservas (semana 7)

**Problema**: Worker actual usa polling HTTP. Debe migrar a BullMQ.

**Archivos a crear/modificar:**

```
infra/
  └── docker-compose.yml        -- añadir Redis service

apps/api/src/modules/reservations/
  └── reservation-expiry.processor.ts  -- BullMQ job: expirar reservas pasado TTL

apps/worker/src/
  └── (migrar de polling HTTP a BullMQ processors)

apps/api/src/modules/notifications/
  ├── notifications.module.ts
  ├── notifications.service.ts  -- crear Notification en DB + disparar canal
  └── notifications.controller.ts  -- GET /v1/notifications, PATCH /v1/notifications/:id/read
```

**Criterio de done del sprint:**
- Redis provisionado en Docker
- Reservas expiradas automáticamente con BullMQ
- NotificationService crea registro `Notification` en DB
- Notificaciones básicas en milestones y pagos

---

### Sprint 2.5 — Frontend conectado completamente a API real (semana 8)

**Problema**: `apps/web` tiene rutas pero muchas no están conectadas a la API real.

**Páginas a completar en `apps/web`:**

```
apps/web/app/
  ├── jobs/
  │   ├── page.tsx              -- lista de jobs con filtros reales
  │   ├── new/page.tsx          -- crear job conectado a API
  │   └── [jobId]/page.tsx      -- detalle job + bids + milestones
  ├── dashboard/page.tsx        -- conectado a GET /v1/ops/dashboard
  ├── cortex/                   -- agentes conversacionales (UX)
  ├── field-ops/                -- FieldUnit, Worklog, KnowledgeFact
  └── login/page.tsx            -- login real con JWT
```

**Criterio de done de Fase 2:**
- Un cliente puede publicar un job real
- Un profesional puede enviar una bid real
- El cliente puede aceptar la bid, generar reserva y firmar contrato
- El profesional puede subir evidencia por hito (S3 real)
- El cliente puede aprobar o rechazar el hito
- El pago se libera automáticamente al aprobar el último hito
- Todo el flujo genera AuditLogs auditables
- Frontend conectado a API real (no mock)

---

## Fase 3 — Capa Agéntica (Semanas 9-14)

### Objetivo

Activar los 8 agentes especializados con LLM real. Al final de esta fase, el sistema tiene matching automático, coaching de evidencia por IA, detección de riesgo y soporte de disputas asistido.

Ver `04_AGENTIC_LAYER.md` para el plan detallado.

### Sprints de la fase 3

| Sprint | Agente / Capacidad | Semana | Criterio de done |
|---|---|---|---|
| 3.0 | AgentMemory + pgvector + BullMQ completo | 9 | AgentMemory en DB, queues funcionando con BullMQ |
| 3.1 | Pricing Agent + conexión OpenAI | 9-10 | Job publicado recibe estimación de precio |
| 3.2 | Trust Match + Job Planner | 10-11 | Job recibe ranking de profesionales y milestones sugeridos |
| 3.3 | Evidence Coach Agent — Vision API | 11-12 | Evidencia subida genera feedback automático de calidad |
| 3.4 | Risk Assessment Agent | 12-13 | Transacciones reciben score de riesgo clasificado |
| 3.5 | Dispute Resolution Agent — HITL | 13 | Disputa abierta genera análisis para operador humano |
| 3.6 | Orchestrator + ECV | 14 | Multi-agent task coordinada correctamente |
| 3.7 | Activar 16 agentes nombrados (Cortex) | 14 | Agentes conversacionales responden con LLM real |

### Criterio de done de la fase 3
- Al menos 4 agentes especializados en producción
- Panel de monitoreo de AgentRuns visible en dashboard
- Costo por AgentRun registrado y dentro de límites
- Ningún agente realiza acción irreversible sin confirmación humana
- ECV validando outputs antes de aplicarlos

---

## Fase 4 — Ops + Trust + Scale (Meses 4-6)

### Objetivo

Consolidar las capas de operación y confianza. Preparar la infraestructura para escalar con múltiples tenants.

### Módulos a implementar

```
Dashboard operativo (apps/web)
  ├── /ops/dashboard            -- Métricas en tiempo real
  ├── /ops/events               -- Feed de auditoría completo
  ├── /ops/disputes             -- Panel de disputas activas
  └── /ops/agents               -- Monitoreo de AgentRuns

Trust scoring (apps/api/src/modules/trust/)
  ├── trust-score.service.ts    -- TrustScore agregado por actor
  └── trust-score.calculator.ts -- completion_rate, dispute_rate, evidence_quality

Infraestructura (infra/)
  ├── docker-compose.prod.yml   -- Setup de producción completo
  ├── nginx.conf                -- Reverse proxy
  └── k8s/                      -- Manifests Kubernetes (extraer de Agent_Semse App Maximizada)
```

### Criterio de done de la fase 4
- TrustScore calculado para todos los usuarios activos
- Panel de ops operativo con métricas en tiempo real
- Sistema deployado en infraestructura reproducible
- SLAs documentados en runbooks
- Multi-tenant verificado con al menos 3 tenants distintos

---

## Fase 5 — Prometeo (Horizonte)

### Objetivo

Activar la capa institucional y de gobernanza programable.

### Criterio de entrada a Fase 5
- Fase 4 completa y estable por al menos 60 días
- Al menos 100 jobs completados en producción con datos reales
- Trust scoring con datos suficientes para ser significativo
- Decisión explícita del equipo de iniciar Prometeo

---

## Tabla de dependencias entre fases

```
Fase 0 (DONE) — Fundación y scaffolding
    ↓
Fase 1 (DONE) — Auth real + EventLog + Smoke test 24/24
    ↓
Fase 2 (EN CURSO) — MVP Marketplace flujo completo
    ↓
Fase 3 — Capa Agéntica (requiere datos reales de Fase 2)
    ↓
Fase 4 — Ops + Trust + Scale
    ↓ (decisión explícita)
Fase 5 — Prometeo (opcional, no bloquea el core)
```

---

## Riesgos conocidos y planes de mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Storage S3/R2 con latencia o costos inesperados | Media | Medio | Usar R2 de Cloudflare (free tier) para desarrollo |
| Payment provider real requiere KYB/compliance | Alta | Alto | Usar sandbox de Stripe en Fase 2, KYB real en Fase 4 |
| BullMQ requiere Redis y aumenta complejidad infra | Media | Medio | Docker Compose con Redis service en Sprint 2.4 |
| Agentes LLM exceden presupuesto de tokens | Media | Medio | Límites por AgentRun + circuit breaker + alertas |
| Frontend desconectado ralentiza smoke test real | Alta | Medio | Priorizar conexión a API real en Sprint 2.5 |
| Fragmentación del dominio por cambios paralelos | Alta | Alto | `02_AUTHORITY_MAP.md` + `03_NODE_REGISTRY.md` como ley |
| Prometeo scope creep antes de tiempo | Alta | Alto | `01_KERNEL.md` + criterios explícitos de entrada a Fase 5 |

---

## Métricas de progreso del ecosistema

Al final de cada fase, medir:

| Métrica | Fase 1 meta | Fase 1 real | Fase 2 meta | Fase 3 meta |
|---|---|---|---|---|
| Endpoints documentados | 20 | 24+ | 50 | 60 |
| Módulos con lógica completa | 3 | 8 | 12 | 14 |
| Módulos con tests de integración | 3 | 0 | 8 | 12 |
| EventLogs por job completo | > 5 | > 5 | > 20 | > 30 |
| Tiempo de respuesta API P95 | < 500ms | N/M | < 300ms | < 200ms |
| Jobs completados en producción | 0 | 0 | 5 (curados) | 50 |
| AgentRuns con success rate | N/A | N/A | N/A | > 90% |
| Cobertura smoke test | 24/24 | 24/24 | 48/48 | 60/60 |
