# SEMSE Sprint 1 Tickets

## Objetivo

Convertir `SEMSE_SPRINT_1_PLAN.md` en unidades de trabajo tecnicas, ejecutables y auditables.

## Convenciones

- prioridad: `P0`, `P1`, `P2`
- estado sugerido inicial: `TODO`
- tipo: `domain`, `api`, `db`, `web`, `audit`, `docs`
- cada ticket debe reforzar la regla `Job-first`

---

## Epic A — Dominio canonico visible

### S1-T001
**Titulo**
Congelar naming visible del MVP

**Tipo**
- domain/docs

**Prioridad**
- P0

**Objetivo**
Eliminar ambiguedad entre naming canonico y naming heredado.

**Hacer**
- definir tabla oficial de estados visibles de `Job`
- definir equivalencias transicionales de `PUBLISHED` -> `POSTED`
- definir equivalencias transicionales de `AWARDED`
- definir semantica visible de `FUND` vs `DEPOSIT`
- reflejar esto en docs foundation relevantes

**Archivos probables**
- `docs/foundation/DOMAIN_MODEL_MVP.md`
- `docs/foundation/DOMAIN_INVARIANTS.md`
- `docs/foundation/IMPLEMENTATION_GAPS_VS_VISION.md`
- `packages/schemas/*`

**Done cuando**
- existe tabla oficial de naming visible
- no hay ambiguedad documental sobre estados canonicos del sprint

---

### S1-T002
**Titulo**
Aplicar regla Job-first a rutas y contratos nuevos

**Tipo**
- domain/api/docs

**Prioridad**
- P0

**Objetivo**
Evitar que nuevas capacidades del sprint profundicen dependencia a `projectId`.

**Hacer**
- revisar tickets del sprint con criterio Job-first
- identificar rutas legacy que quedan solo como puente
- documentar lista de rutas canonicas del sprint

**Archivos probables**
- `docs/foundation/API_MODULE_MAP.md`
- `docs/foundation/JOB_VS_PROJECT_BOUNDARY.md`
- controllers de `payments`, `evidence`, `milestones`, `disputes`

**Done cuando**
- toda capacidad nueva del sprint tiene ruta canonica por `jobId` o entidad derivada canonica
- cero nuevas rutas primarias por `projectId`

---

## Epic B — Reservations + Contracts

### S1-T003
**Titulo**
Endurecer reservation create/list

**Tipo**
- api/domain

**Prioridad**
- P0

**Objetivo**
Hacer robusta la reserva activa por job.

**Hacer**
- validar una sola reserva activa por job
- validar ownership y permisos
- asegurar consistencia de create/list
- revisar errores de concurrencia y respuesta

**Archivos probables**
- `apps/api/src/modules/reservations/reservations.controller.ts`
- `apps/api/src/modules/reservations/reservations.service.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`
- `packages/schemas/src/marketplace.schema.ts`

**Done cuando**
- no se pueden crear dos reservas activas validas para un mismo job
- create/list reflejan estado real

---

### S1-T004
**Titulo**
Cerrar accept / release / expire de reservations

**Tipo**
- api/domain/audit

**Prioridad**
- P0

**Objetivo**
Completar el ciclo de vida de la reserva.

**Hacer**
- asegurar transiciones validas
- registrar audit trail
- validar permisos por actor/organizacion

**Archivos probables**
- `apps/api/src/modules/reservations/*`
- `apps/api/src/infrastructure/audit/*`

**Done cuando**
- accept, release y expire funcionan con reglas claras y trazables

---

### S1-T005
**Titulo**
Cerrar create/current/sign de contracts

**Tipo**
- api/domain/db

**Prioridad**
- P0

**Objetivo**
Hacer operativo el contrato como paso posterior a reserva aceptada.

**Hacer**
- validar precondiciones desde reservation aceptada
- asegurar un contrato vigente por job
- registrar firmas, `documentHash`, `pdfUrl`
- validar signAs y ownership

**Archivos probables**
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `apps/api/src/modules/contracts/contracts.repository.ts`
- `packages/schemas/src/marketplace.schema.ts`
- `packages/db/prisma/schema.prisma`

**Done cuando**
- existe flujo usable create/current/sign por `jobId`

---

## Epic C — Escrow y payments canonicos

### S1-T006
**Titulo**
Alinear funding por job

**Tipo**
- api/domain/db

**Prioridad**
- P0

**Objetivo**
Consolidar funding de escrow con lenguaje y ownership canonicos.

**Hacer**
- revisar `POST /v1/jobs/:jobId/escrow/fund`
- validar consistencia con contrato/job
- ajustar naming visible de funding
- asegurar lectura principal por `jobId`

**Archivos probables**
- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `packages/schemas/src/payment.schema.ts`
- `packages/db/prisma/schema.prisma`

**Done cuando**
- funding por job funciona y su semantica visible es canonica

---

### S1-T007
**Titulo**
Separar semantics de escrow vs payments

**Tipo**
- domain/api/db/docs

**Prioridad**
- P0

**Objetivo**
Evitar confusion conceptual entre fondos inmovilizados y movimientos financieros.

**Hacer**
- definir responsibilities de `escrow` y `payments`
- revisar endpoints y DTOs
- alinear docs y tipos
- reducir ambiguedad de `PaymentEscrow` / `PaymentTxn`

**Archivos probables**
- `docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md`
- `apps/api/src/modules/payments/*`
- `packages/schemas/src/payment.schema.ts`
- `packages/db/prisma/schema.prisma`

**Done cuando**
- escrow y payments tienen fronteras claras para este sprint

---

### S1-T008
**Titulo**
Cerrar release por milestone aprobado

**Tipo**
- api/domain/audit

**Prioridad**
- P0

**Objetivo**
Permitir liberacion de fondos posterior a aprobacion.

**Hacer**
- validar release por milestone
- impedir release sin precondiciones
- registrar ledger y audit trail

**Archivos probables**
- `apps/api/src/modules/payments/*`
- `apps/api/src/modules/milestones/*`
- `packages/schemas/src/payment.schema.ts`

**Done cuando**
- milestone aprobado puede detonar release trazable y consistente

---

## Epic D — Evidence + Review

### S1-T009
**Titulo**
Reforzar evidence register/list by job

**Tipo**
- api/domain

**Prioridad**
- P0

**Objetivo**
Volver canonica la lectura/escritura de evidencia por `jobId`.

**Hacer**
- reforzar `POST /v1/evidence`
- reforzar `GET /v1/jobs/:jobId/evidence`
- mantener `projectId` solo como puente
- validar ownership, kind, milestone

**Archivos probables**
- `apps/api/src/modules/evidence/evidence.controller.ts`
- `apps/api/src/modules/evidence/evidence.service.ts`
- `apps/api/src/modules/evidence/evidence.repository.ts`
- `packages/schemas/src/evidence.schema.ts`

**Done cuando**
- evidence nueva del sprint puede operarse principalmente por `jobId`

---

### S1-T010
**Titulo**
Cerrar milestone review loop

**Tipo**
- api/domain

**Prioridad**
- P0

**Objetivo**
Permitir approve / reject / request changes con estructura clara.

**Hacer**
- revisar rutas y services de milestones
- asegurar persistencia de `MilestoneReview`
- alinear decisiones con evidencia y estados

**Archivos probables**
- `apps/api/src/modules/milestones/*`
- `packages/schemas/src/evidence.schema.ts`
- `packages/db/prisma/schema.prisma`

**Done cuando**
- milestone puede pasar por review trazable con decisiones validas

---

## Epic E — Dispute baseline

### S1-T011
**Titulo**
Cerrar apertura basica de dispute

**Tipo**
- api/domain

**Prioridad**
- P1

**Objetivo**
Dar salida a excepciones del flujo feliz.

**Hacer**
- abrir disputa desde job/milestone
- asegurar ownership y elegibilidad
- relacionar disputa con impacto operativo/financiero

**Archivos probables**
- `apps/api/src/modules/disputes/*`
- `packages/schemas/src/dispute.schema.ts`
- `packages/db/prisma/schema.prisma`

**Done cuando**
- conflicto del flujo puede escalarse a dispute basica

---

### S1-T012
**Titulo**
Cerrar resolucion minima de dispute

**Tipo**
- api/ops/audit

**Prioridad**
- P1

**Objetivo**
Permitir intervencion minima de ops en disputas.

**Hacer**
- asignacion/revision minima
- resolucion basica
- audit trail asociado

**Archivos probables**
- `apps/api/src/modules/disputes/*`
- `apps/api/src/modules/ops/*`
- audit services

**Done cuando**
- una disputa puede abrirse y resolverse de forma trazable en baseline MVP

---

## Epic F — Frontend shell minimo

### S1-T013
**Titulo**
Integrar Create Job UI en frontend canonico

**Tipo**
- web

**Prioridad**
- P0

**Fuente**
- `semseproject/app`

**Objetivo**
Mover el wizard de publicacion al frontend oficial.

**Hacer**
- extraer UX/patrones de `Publicar.tsx`
- adaptar a Next/web canonico
- conectar a API real
- eliminar dependencia a Supabase/mock del satelite

**Archivos probables**
- `apps/web/app/*`
- nuevo modulo o route de publish/create-job
- clientes API web

**Done cuando**
- cliente puede crear job desde frontend canonico

---

### S1-T014
**Titulo**
Integrar Escrow UI minima en frontend canonico

**Tipo**
- web

**Prioridad**
- P0

**Fuente**
- `semseproject/app`

**Objetivo**
Hacer visible el estado financiero del flujo.

**Hacer**
- rescatar patrones de `Escrow.tsx`
- mostrar funding/release/dispute state
- conectar con rutas canónicas por `jobId`

**Archivos probables**
- `apps/web/app/*`
- clientes API web

**Done cuando**
- usuario puede leer estado de escrow del job sin usar surfaces tecnicas

---

### S1-T015
**Titulo**
Integrar Evidence UI minima en frontend canonico

**Tipo**
- web

**Prioridad**
- P0

**Fuente**
- `semseproject/app`

**Objetivo**
Permitir carga y revision usable de evidencia.

**Hacer**
- rescatar patrones de `Evidencias.tsx`
- modal de upload
- lista por estado
- detalle y accion de review segun rol

**Archivos probables**
- `apps/web/app/*`
- clientes API web

**Done cuando**
- evidence puede cargarse y revisarse desde frontend oficial

---

### S1-T016
**Titulo**
Integrar Dashboard shell minima

**Tipo**
- web

**Prioridad**
- P1

**Fuente**
- `semseproject/app`

**Objetivo**
Dar home operable al flujo comercial.

**Hacer**
- resumir jobs, escrow y evidencias
- links a create job / escrow / evidence
- indicadores minimos

**Archivos probables**
- `apps/web/app/page.tsx`
- `apps/web/app/*`

**Done cuando**
- existe home comercial usable del MVP

---

## Epic G — Audit trail

### S1-T017
**Titulo**
Auditar reservations y contracts

**Tipo**
- audit/api

**Prioridad**
- P0

**Objetivo**
Dejar trazabilidad en inicio del flujo.

**Hacer**
- audit create/accept/release/expire reservation
- audit create/sign contract

**Archivos probables**
- reservations/contracts services
- audit infrastructure

**Done cuando**
- reservations y contracts dejan eventos auditables consultables

---

### S1-T018
**Titulo**
Auditar funding, evidence, review, release y dispute

**Tipo**
- audit/api

**Prioridad**
- P0

**Objetivo**
Cerrar trazabilidad del resto del happy path.

**Hacer**
- audit fund
- audit evidence register
- audit review decision
- audit release
- audit dispute open/resolve

**Archivos probables**
- payments/evidence/milestones/disputes services
- audit infrastructure

**Done cuando**
- el happy path completo del sprint deja rastro minimo suficiente

---

## Orden recomendado de ejecucion

### Bloque 1 — Dominio
- S1-T001
- S1-T002

### Bloque 2 — Backend base
- S1-T003
- S1-T004
- S1-T005

### Bloque 3 — Dinero y evidencia
- S1-T006
- S1-T007
- S1-T009
- S1-T010
- S1-T008
- S1-T011
- S1-T012

### Bloque 4 — Frontend MVP
- S1-T013
- S1-T014
- S1-T015
- S1-T016

### Bloque 5 — Auditabilidad
- S1-T017
- S1-T018

---

## Ruta minima de demo

La demo minima del sprint debe cubrir:

1. create job
2. reservation create
3. reservation accept
4. contract create
5. contract sign
6. escrow fund
7. evidence upload
8. review decision
9. release
10. dispute open
11. audit trail visible

---

## Criterio de exito del documento

Este backlog sirve si un equipo tecnico puede:
- tomar tickets en orden;
- saber que tocar;
- saber que no tocar;
- medir progreso del sprint sin perder el norte del dominio.
