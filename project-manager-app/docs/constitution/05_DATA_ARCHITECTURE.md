---
version: 2.0.0
fecha: 2026-03-30
estado: canonical
owner: data-lead
changelog: Actualizado para reflejar schema real v2 (30+ modelos), 6 migraciones aplicadas, modelos nuevos: PolicyRule, Notification, FieldUnit, Vendor, ComplianceDoc, KnowledgeFact, FactLink.
---

# 05_DATA_ARCHITECTURE — Arquitectura de Datos de SEMSEproject

## Propósito

Este documento define la arquitectura de datos oficial del ecosistema: bases de datos, entidades, relaciones, extensiones, capa de conocimiento, convenciones de naming y plan de migraciones.

---

## Decisión canónica de base de datos

**PostgreSQL es la única base de datos del sistema.** Esta es una decisión bloqueada.

### Estado de la migración al 2026-03-30

| Base actual | Estado | Destino | Acción requerida |
|---|---|---|---|
| PostgreSQL en `project-manager-app` | Canónica — activa | — | Mantener y extender |
| MySQL en `web-assistant-portal` | Transitional | PostgreSQL canónico | Migrar en Fase 2 |
| Supabase (parcial en `supabase/`) | Transitional | PostgreSQL canónico + S3/R2 | Migrar dominio por dominio |

---

## Migraciones aplicadas al 2026-03-30

| ID | Nombre | Estado |
|---|---|---|
| 001 | `20260309205333_init` | APPLIED |
| 002 | `20260310045500_dispute_assignment_fields` | APPLIED |
| 003 | `20260310052000_agent_run_lifecycle_fields` | APPLIED |
| 004 | `20260312160000_job_reservations_contracts_transition` | APPLIED |
| 005 | `20260312190000_payment_escrow_job_contract_link` | APPLIED |
| 006 | `20260313183000_bid_professional_user_bridge` | APPLIED |

---

## Mapa completo de entidades Prisma al 2026-03-30

### Dominio: Identidad y acceso

```
Tenant
  id, slug, name, status
  → Org[], Job[], Project[], Dispute[], AuditLog[], AgentRun[], RiskScore[]
  → FieldUnit[], WorklogEntry[], KnowledgeFact[], FieldMilestone[], Vendor[], ComplianceDoc[]

Org
  id, tenantId, type, name
  → Membership[], Job[], Bid[], Project[], JobReservation[]
  → Contract (clientOrg) | (professionalOrg)

User
  id, email, phone, passwordHash, status
  verificationStatus: unverified | pending | verified | suspended
  trustScore: Decimal (0.0000–1.0000)
  riskLevel: low | medium | high | critical
  flags: String[]
  → Membership[], Bid[], Message[], Evidence[], JobReservation[]
  → Contract (clientUser) | (professionalUser)
  → MilestoneReview[], Rating[], Dispute[], AuditLog[], Notification[]

Role
  id, key (CLIENT | PRO | OPS_ADMIN | WORKER), name
  → Membership[], RolePermission[]

Permission
  id, key, description
  → RolePermission[]

RolePermission
  roleId, permissionId (PK compuesto)

Membership
  userId, orgId, roleId (PK compuesto)
```

### Dominio: Jobs y bids

```
Job
  id, tenantId, clientOrgId
  title, category, scope, status (JobStatus enum)
  budgetType, budgetMin, budgetMax, location
  urgency: low | medium | high | urgent
  deadline?, policyProfileId?, scopeSnapshot: Json?
  → Bid[], JobReservation[], Contract?, PaymentEscrow?
  → Rating[], MessageThread[], Project?

JobStatus enum:
  DRAFT | POSTED | PUBLISHED | RESERVED | ACCEPTED
  IN_PROGRESS | REVIEW | DISPUTE | COMPLETED | AWARDED | CANCELLED

Bid
  id, jobId, proOrgId, professionalUserId
  amount, etaDays, status (SUBMITTED | ACCEPTED | REJECTED)
  note?

JobReservation
  id, jobId, professionalOrgId?, professionalId
  status (ACTIVE | EXPIRED | ACCEPTED | RELEASED)
  reservedAt, expiresAt, releasedAt?, acceptedAt?
```

### Dominio: Proyectos y contratos

```
Project
  id, tenantId, jobId (unique), assignedProOrgId
  status (OPEN | IN_PROGRESS | BLOCKED | COMPLETED | CANCELLED)
  startAt?, dueAt?
  → Milestone[], Evidence[], Dispute[], PaymentEscrow?, MessageThread[]
  → FieldUnit[]
  NOTA: Project es el bridge canónico entre Job y Milestone

Contract
  id, jobId (unique), clientOrgId?, professionalOrgId?
  clientUserId, professionalUserId
  termsJson: Json, signedClientAt?, signedProAt?
  pdfUrl?, documentHash?
  → PaymentEscrow?
```

### Dominio: Milestones y revisiones

```
Milestone
  id, projectId, title, description?, amount
  sequence, status (MilestoneStatus enum)
  approvedById?, approvedAt?
  checklistSchema: Json?   -- items de checklist estructurado
  requiredEvidenceTypes: String[]  -- ["PHOTO","VIDEO","DOCUMENT"]
  → Evidence[], MilestoneReview[], Dispute[], PaymentTxn[]

MilestoneStatus enum:
  DRAFT | AWAITING_REVIEW | SUBMITTED | APPROVED | REJECTED | PAID

MilestoneReview
  id, milestoneId, reviewerId
  decision (APPROVE | REJECT | REQUEST_CHANGES | ESCALATE_DISPUTE)
  comment?
```

### Dominio: Evidencia

```
Evidence
  id, projectId, milestoneId?, uploadedById
  kind (PHOTO | VIDEO | DOCUMENT)
  bucketKey, checksum?, metadataJson?, capturedAt?
  aiQualityScore: Decimal (0.0000–1.0000)  -- scored by EvidenceCoachAgent
  validationStatus: pending | passed | failed | manual_review
  geoLat?, geoLng?
  NOTA: Sin storage S3 real aún — bucketKey es referencia lógica
```

### Dominio: Pagos y escrow

```
PaymentEscrow
  id, projectId (unique), jobId? (unique), contractId? (unique)
  providerRef (unique), currency, totalAmount
  holdbackPct?, status
  → PaymentTxn[]

PaymentTxn
  id, escrowId, milestoneId?
  type (DEPOSIT | RELEASE | HOLDBACK | FEE | REFUND)
  amount, providerRef (unique)
  status (PENDING | SUCCEEDED | FAILED | REVERSED)
  NOTA: Mock provider activo. Provider real (Stripe/Conekta) pendiente Fase 2
```

### Dominio: Mensajería

```
MessageThread
  id, jobId?, projectId?
  → Message[]

Message
  id, threadId, senderUserId, body, attachments: Json?
```

### Dominio: Disputas

```
Dispute
  id, tenantId, projectId, milestoneId?
  raisedById, assigneeUserId?, reason, status
  resolution?, resolvedById?, resolvedAt?
  reasonCode?: incomplete_work | quality_issue | no_show | payment_dispute | other
  resolutionType?: client_favor | pro_favor | partial_50_50 | escalated_legal
  evidenceBundleIds: String[]

DisputeStatus enum:
  OPEN | ASSIGNED | UNDER_REVIEW | RESOLVED | REJECTED
```

### Dominio: Trust y reputación

```
Rating
  id, jobId, fromUserId, toUserId
  score: Int (1–5), comment?

RiskScore
  id, tenantId, subjectType (User|Job|Contract|Org)
  subjectId, score: Decimal (0.0000–1.0000)
  factorsJson, modelVersion, computedAt
  NOTA: Calculado por TrustService. Usado por OpsModule.

PENDIENTE (Fase 3):
  TrustScore — score compuesto por actor (completion rate, dispute rate, evidence quality)
  FraudSignal — señales de fraude detectadas por RiskAgent
```

### Dominio: Auditoría y operaciones

```
AuditLog
  id, tenantId, actorUserId?
  entityType, entityId, action
  beforeJson?, afterJson?
  ip?, userAgent?, occurredAt (immutable)

  Escrito por AuditService.append() — append-only.
  Nunca actualizar ni eliminar.

  @@index([tenantId, occurredAt])
  @@index([entityType, entityId])
```

### Dominio: Agentes IA

```
AgentRun
  id, tenantId, agentType, triggerType
  inputJson, outputJson?
  status (QUEUED | RUNNING | COMPLETED | FAILED | CANCELLED)
  correlationId, workerId?, attempts, maxAttempts
  deadLettered, error?
  startedAt?, heartbeatAt?, endedAt?
  actionType?, inputSummary?, outputSummary?
  confidence?: Decimal (0.000–1.000)
  requiresHumanReview: Boolean

PENDIENTE (Fase 3):
  AgentMemory — memoria persistente de agentes con pgvector
```

### Dominio: Reglas de negocio (PolicyEngine)

```
PolicyRule
  id, tenantId, key, name, description?
  category: job | payment | evidence | dispute | agent | user
  conditions: Json  -- [{ field, operator, value }]
  action (ALLOW | BLOCK | REQUIRE | NOTIFY | ESCALATE | AUTO_RESOLVE)
  priority, enabled

  @@unique([tenantId, key])
  NOTA: Schema definido. PolicyService pendiente de implementación.
```

### Dominio: Notificaciones

```
Notification
  id, tenantId, userId
  type: String  -- job_assigned | milestone_submitted | payment_released | etc.
  title, body, payload?: Json
  channel (IN_APP | EMAIL | PUSH | SMS)
  readAt?, sentAt?

  NOTA: Schema definido. NotificationService pendiente de implementación.
```

### Dominio: Field Ops

```
FieldUnit
  id, tenantId, projectId, code, name?, address?
  status (PENDING | IN_PROGRESS | COMPLETE | ON_HOLD | CANCELLED)
  metadataJson?
  → WorklogEntry[], FieldMilestone[]

WorklogEntry
  id, tenantId, fieldUnitId, date
  doneToday, pendingNext, blockers?, notes?
  createdBy
  → KnowledgeFact[] (promoted facts)

KnowledgeFact
  id, tenantId
  subject: String  -- "FieldUnit:110", "Vendor:ABC"
  predicate: String  -- "status", "blocked_by"
  object: String
  confidence: Decimal (0.000–1.000)
  visibility (TEAM | ORG | PUBLIC)
  worklogId?, createdBy
  → FactLink[] (grafo semántico)

FactLink
  id, fromId, toId, type
  -- type: causes | blocks | relates_to

FieldMilestone
  id, tenantId, fieldUnitId, name
  status (MilestoneStatus), amount?, notes?, sequence

Vendor
  id, tenantId, name, phone?, email?, notes?
  → ComplianceDoc[]

ComplianceDoc
  id, tenantId, vendorId
  type: INSURANCE | LICENSE | W9
  status (MISSING | PENDING | APPROVED | EXPIRED)
  fileUrl?, expiresAt?, notes?
```

---

## Diagrama textual del schema completo

```
Tenant ──────────── Org[] (1:N)
   │                  │
   │              Membership[] (User × Org × Role)
   │                  │
   └── Job[] ──── Bid[] ─── JobReservation[]
         │
         ├── Contract (1:1)
         │      └── PaymentEscrow (1:1) ─── PaymentTxn[]
         │
         └── Project (1:1 via jobId)
                │
                ├── Milestone[] ─── Evidence[]
                │         │          └── (bucketKey → S3/R2)
                │         └── MilestoneReview[]
                │         └── PaymentTxn[]
                │
                ├── Dispute[] ─── (AuditLog references)
                ├── PaymentEscrow (1:1)
                └── FieldUnit[] ─── WorklogEntry[]
                                │        └── KnowledgeFact[]
                                └── FieldMilestone[]

User ──── Rating[] (como rater y ratee)
User ──── Notification[]

AuditLog (append-only → cualquier entidad por entityType + entityId)
AgentRun (→ tenant, → AuditLog references)
RiskScore (→ tenant, subjectType + subjectId genérico)
PolicyRule (→ tenant, evaluado en transiciones de estado)
```

---

## Extensiones de PostgreSQL

### Activas en producción
```sql
-- Requeridas por Prisma + queries existentes
-- (instaladas por defecto en PostgreSQL 14+)
```

### Pendientes (Fase 3)
```sql
CREATE EXTENSION IF NOT EXISTS "vector";   -- pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- full-text search por trigramas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- UUIDs nativos (complementario a cuid)
```

---

## Redis: usos y namespaces objetivo

| Namespace | Propósito | TTL |
|---|---|---|
| `session:{userId}` | Refresh tokens (cuando se implemente) | 7 días |
| `agent:working:{runId}` | Working memory de agentes activos | 30 min |
| `cache:job:{jobId}` | Cache de jobs populares | 5 min |
| `queue:agent:*` | BullMQ queues de agentes | Persistente (BullMQ) |
| `queue:worker:*` | BullMQ queues de workers async | Persistente (BullMQ) |
| `rate:api:{userId}` | Rate limiting por usuario | 1 min (ventana sliding) |
| `lock:reservation:{jobId}` | Lock distribuido para reservas concurrentes | 30 s |

**NOTA**: Redis no está provisionado en el stack actual. Necesario para Sprint 2.4 (BullMQ).

---

## Knowledge Layer objetivo (Fase 3)

El `KnowledgeFact` + `FactLink` en FieldOps es el primer grafo semántico del sistema. En Fase 3 se extiende a:

1. **Embeddings de perfiles profesionales** (`UserProfile.embedding`): vector de 1536 dims.
2. **Embeddings de jobs** (`Job.embedding`): vector generado al publicar el job.
3. **AgentMemory semántica** (`AgentMemory.embedding`): hechos y patrones de agentes.
4. **Trust signals consolidados** (`TrustScore`): métricas calculadas periódicamente.

---

## Convenciones de naming

### Tablas
- Siempre en `PascalCase` en Prisma (genera `snake_case` en PostgreSQL automáticamente).
- Entidades centrales: `User`, `Job`, `Contract`, `Milestone`, `Evidence`.
- Entidades de join: `Membership`, `RolePermission`.

### Columnas
- camelCase en Prisma (→ snake_case en PostgreSQL).
- PKs: siempre `id` (CUID por defecto).
- FKs: siempre `{entidad}Id` (ej: `jobId`, `contractId`).
- Fechas de estado: `{estado}At` (ej: `approvedAt`, `cancelledAt`).
- Booleans: prefijo `is_` implícito o nombre semántico directo (ej: `deadLettered`, `requiresHumanReview`).
- JSON: columnas explícitamente marcadas como `Json` o `Json?` en Prisma.
- Enums: siempre en `SCREAMING_SNAKE_CASE`.

### Indices
- FK que aparezca en WHERE frecuentes: índice obligatorio.
- Índice compuesto `(tenantId, status)` en entidades principales.
- Índice compuesto `(tenantId, createdAt)` en entidades de auditoría.
- Índices `ivfflat` o `hnsw` para columnas vector (Fase 3).

### Soft deletes
- Entidades operativas: no se borran, solo cambian estado.
- `AuditLog`, `AgentRun`: nunca borrar. Append-only.
- `PaymentTxn`: nunca borrar. Estado `REVERSED` para reversiones.

---

## Plan de migraciones pendientes

| ID | Nombre | Módulo | Prioridad | Fase | Estado |
|---|---|---|---|---|---|
| M-001 al M-006 | Aplicadas (ver tabla arriba) | varios | — | 0-1 | DONE |
| M-007 | `add_refresh_token` | auth | P1 | 2 | PENDING |
| M-008 | `add_user_profile_with_embedding_placeholder` | identity | P2 | 2 | PENDING |
| M-009 | `add_pgvector_extension` | agentes / RAG | P3 | 3 | PENDING |
| M-010 | `add_agent_memory` | agentes | P3 | 3 | PENDING |
| M-011 | `add_trust_score_aggregate` | trust | P2 | 2 | PENDING |
| M-012 | `migrate_web_assistant_portal` | consolidación | P1 | 2 | PENDING |
