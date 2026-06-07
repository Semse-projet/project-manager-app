# Prisma Transition Plan

## Objetivo

Migrar el schema actual hacia el dominio canonico de SEMSEproject sin
reescritura brusca ni perdida de trazabilidad.

## Estado Actual

El schema actual ya tiene:

- `Tenant`
- `Org`
- `User`
- `Job`
- `Bid`
- `Project`
- `Milestone`
- `PaymentEscrow`
- `PaymentTxn`
- `Evidence`
- `Dispute`
- `AuditLog`
- `AgentRun`
- `Notification`
- `KnowledgeFact`
- `WorklogEntry`
- `FieldMilestone`

## Desajustes principales

- `JobStatus` mezcla lenguaje canonico y compatibilidad legacy.
- `Project` concentra demasiado significado operativo para un sistema job-first.
- `Evidence` y `Trust` aun cargan semantica ligada a `Project`.
- `PaymentEscrow` y `PaymentTxn` mantienen naming heredado en vez de la semantica final.
- enums criticos no siempre reflejan literalmente el estado objetivo definido en `STATE_MACHINES.md`.

## Lectura correcta del schema

El schema de Prisma ya es suficientemente rico para ser el backend canónico.

El problema no es falta de modelos.
El problema es semantica mixta:

- parte canonica;
- parte transicional;
- parte heredada.

La tarea no es rehacer Prisma desde cero.
La tarea es alinear nombres, estados y relaciones al lenguaje oficial del dominio.

## Matriz de alineacion por agregado

| Agregado canonico | Prisma actual | Estado | Gaps principales | Accion |
|---|---|---|---|---|
| User | `User` | `Aligned parcial` | falta separacion mas fuerte entre identidad y trust | mantener y expandir por servicios |
| Organization | `Org`, `Membership`, `Tenant` | `Aligned parcial` | naming mixto tenant/org | mantener y documentar limites |
| Job | `Job` | `Aligned parcial` | estados legacy y dependencia tecnica de `Project` | endurecer como agregado principal |
| Reservation | `JobReservation` | `Aligned` | nomenclatura y transiciones aun hibridas | consolidar como camino oficial |
| Contract | `Contract` | `Aligned parcial` | relaciones y eventos deben reforzarse | mantener y expandir |
| Milestone | `Milestone`, `MilestoneReview` | `Aligned parcial` | secuencia y evidencia requieren lenguaje canonico uniforme | endurecer contratos |
| Evidence | `Evidence` | `Transitional` | sigue aceptando `projectId` como eje | mover centro a `jobId`/`milestoneId` |
| PaymentEscrow | `PaymentEscrow`, `PaymentTxn` | `Transitional` | naming heredado frente a `EscrowAccount`/`PaymentTransaction` | migrar semantica sin romper tabla |
| Dispute | `Dispute` | `Aligned parcial` | scope job/project dual | fijar `job` y `milestone` como camino principal |
| Trust | `RiskScore`, partes de `User` | `Transitional` | falta `TrustProfile` mas explicito | introducir view/servicio canonico |
| Audit | `AuditLog` | `Aligned` | necesita eventos y razones mas estrictas | reforzar |
| Notifications | `Notification` | `Aligned parcial` | tipado de canales y eventos | conectar con catalogo de eventos |
| Field Ops | `FieldUnit`, `WorklogEntry`, `FieldMilestone`, `Vendor`, `ComplianceDoc` | `Reference-ready` | aun no absorbido en launch core | preservar y conectar por fases |
| Knowledge | `KnowledgeFact`, `FactLink` | `Reference-ready` | falta contrato canonico de retrieval | preservar y extraer gradualmente |

## Estrategia

### Paso 1. Alinear contratos compartidos

Hacer que `packages/schemas` describa de manera honesta el runtime y la meta.

### Paso 2. Consolidar semantica de estados

- mantener compatibilidad de DB donde haga falta;
- declarar un solo lenguaje canonico en schemas y API;
- tratar `PUBLISHED` y `AWARDED` como compatibilidad transitoria.

### Paso 3. Recentrar dependencias sobre `Job`

- `Evidence` debe preferir `jobId` y `milestoneId`;
- `Dispute` debe preferir `jobId` y `milestoneId`;
- `PaymentEscrow` debe leerse como escrow del job/contract/milestone, no del `Project` como verdad del producto.

### Paso 4. Reducir `Project` a agregado tecnico derivado

`Project` puede seguir existiendo mientras el runtime lo necesite.

Pero:

- no debe expandirse como lenguaje principal del producto;
- no debe recibir nuevos flujos core si el mismo flujo puede vivir sobre `Job`.

### Paso 5. Preparar renombrado semantico sin migracion destructiva

- `PaymentEscrow` => semantica de `EscrowAccount`
- `PaymentTxn` => semantica de `PaymentTransaction`
- `RiskScore` + señales => base para `TrustProfile`

No hace falta renombrar tablas hoy para alinear el producto.
Hace falta alinear el contrato y el servicio.

## Orden de implementacion recomendado

1. expandir `JobStatus`;
2. endurecer `JobReservation`, `Contract`, `MilestoneReview` como camino oficial;
3. adaptar `Evidence` a `jobId`/`milestoneId`;
4. adaptar `PaymentEscrow` y `PaymentTxn` a semantica canonica;
5. fijar `Dispute` sobre `jobId`/`milestoneId`;
6. reducir `Project` a abstraccion secundaria;
7. reforzar `AuditLog`, `Notification` y `RiskScore` contra el catalogo de eventos.

## Definition of Done

Alineacion Prisma esta completa cuando:

1. Prisma sigue siendo la fuente oficial de persistencia core;
2. cada agregado core tiene un mapeo claro al dominio canonico;
3. `Project` deja de ser el lenguaje dominante del producto;
4. `Job`, `Contract`, `Milestone`, `Evidence`, `Escrow` y `Dispute` soportan el flujo principal;
5. los estados persistidos coinciden con `STATE_MACHINES.md` o quedan marcados como legacy;
6. servicios y frontend pueden operar sin inventar modelos paralelos.
