# Domain Model MVP

## Objetivo

Definir el modelo minimo para ejecutar el flujo canonico:

1. crear job;
2. reservar;
3. aceptar;
4. firmar contrato;
5. fondear escrow;
6. ejecutar hitos;
7. subir evidencia;
8. revisar;
9. liberar fondos;
10. cerrar o disputar.

## Regla de Alineacion

Este documento traduce la vision canonica definida en:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

Por lo tanto:

- `Job` es la entidad canonica del marketplace
- `Project` debe leerse como soporte transitorio de ejecucion mientras el backend migra
- la herencia tecnica actual no redefine el lenguaje de producto

Documentos complementarios obligatorios:

- [`JOB_VS_PROJECT_BOUNDARY.md`](/home/yoni/labsemse/project-manager-app/docs/foundation/JOB_VS_PROJECT_BOUNDARY.md)
- [`DOMAIN_INVARIANTS.md`](/home/yoni/labsemse/project-manager-app/docs/foundation/DOMAIN_INVARIANTS.md)

## Entidades Minimas

### User

Campos minimos:

- `id`
- `email`
- `phone`
- `status`
- `role`
- `createdAt`

### Organization

Campos minimos:

- `id`
- `tenantId`
- `type`
- `name`

### Membership

Campos minimos:

- `userId`
- `organizationId`
- `role`

### ProfessionalProfile

Campos minimos:

- `userId`
- `organizationId`
- `displayName`
- `membershipStatus`
- `licenseStatus`
- `insuranceStatus`
- `ratingAvg`

### ClientProfile

Campos minimos:

- `userId`
- `organizationId`
- `displayName`
- `ratingAvg`

### Job

Campos minimos:

- `id`
- `clientOrgId`
- `title`
- `category`
- `scope`
- `location`
- `budgetType`
- `budgetMin`
- `budgetMax`
- `state`
- `postedAt`

Estados propuestos:

- `DRAFT`
- `POSTED`
- `RESERVED`
- `ACCEPTED`
- `IN_PROGRESS`
- `REVIEW`
- `DISPUTE`
- `COMPLETED`
- `CANCELLED`

Nota de transicion:

El schema actual y parte del backend todavia conservan variantes historicas como
`PUBLISHED` y `AWARDED`.
Esos estados existen por compatibilidad temporal y no reemplazan el flujo canonico
definido por la vision.

Ownership canonico:

- cliente dueno: `clientOrgId`
- la referencia comercial y contractual debe partir desde `Job`

### JobReservation

Campos minimos:

- `id`
- `jobId`
- `professionalOrgId`
- `state`
- `reservedAt`
- `expiresAt`

Estados:

- `ACTIVE`
- `EXPIRED`
- `ACCEPTED`
- `RELEASED`

### Contract

Campos minimos:

- `id`
- `jobId`
- `clientOrgId`
- `professionalOrgId`
- `termsJson`
- `signedClientAt`
- `signedProfessionalAt`
- `pdfUrl`
- `documentHash`

Nota:

- el contrato puede seguir guardando firmantes por usuario
- el ownership canonico del contrato debe resolverse por `clientOrgId` y `professionalOrgId`

### Milestone

Campos minimos:

- `id`
- `jobId`
- `idx`
- `title`
- `amountCents`
- `state`

Lectura correcta:

- semanticamente pertenece al flujo de ejecucion del `Job`
- tecnicamente hoy puede seguir colgando de `Project` mientras dure la transicion

Estados:

- `DRAFT`
- `AWAITING_REVIEW`
- `APPROVED`
- `REJECTED`
- `PAID`

### MilestoneEvidence

Campos minimos:

- `id`
- `milestoneId`
- `kind`
- `storageUrl`
- `description`
- `metadataJson`
- `uploadedBy`
- `uploadedAt`

### MilestoneReview

Campos minimos:

- `id`
- `milestoneId`
- `reviewerId`
- `decision`
- `comment`
- `createdAt`

Decisiones:

- `APPROVE`
- `REJECT`
- `REQUEST_CHANGES`
- `ESCALATE_DISPUTE`

### EscrowAccount

Campos minimos:

- `id`
- `jobId`
- `provider`
- `status`
- `balanceCents`
- `fundedCents`
- `releasedCents`
- `refundedCents`

Lectura correcta:

- semanticamente pertenece a la transaccion del `Job`
- tecnicamente hoy puede seguir asociado a `Project` por herencia operativa

### EscrowTransaction

Campos minimos:

- `id`
- `escrowId`
- `milestoneId`
- `type`
- `amountCents`
- `providerRef`
- `status`
- `createdAt`

Tipos:

- `FUND`
- `RELEASE`
- `HOLDBACK`
- `FEE`
- `REFUND`

Nota de transicion:

La implementacion actual todavia usa `DEPOSIT` en algunos contratos y tablas.
Debe entenderse como compatibilidad heredada hacia la semantica canonica de
fondeo del escrow, no como decision final de dominio.

### Payment

Campos minimos:

- `id`
- `jobId`
- `milestoneId`
- `provider`
- `providerRef`
- `direction`
- `status`
- `amountCents`

### Dispute

Campos minimos:

- `id`
- `jobId`
- `milestoneId`
- `openedById`
- `reason`
- `state`

Lectura correcta:

- semanticamente disputa una transaccion/trabajo derivado de `Job`
- tecnicamente hoy puede seguir resolviendose contra `Project`
- `resolution`
- `openedAt`
- `resolvedAt`

Estados:

- `OPEN`
- `UNDER_REVIEW`
- `RESOLVED`
- `REJECTED`

### Rating

Campos minimos:

- `id`
- `jobId`
- `fromUserId`
- `toUserId`
- `score`
- `comment`

### TimelineEvent

Campos minimos:

- `id`
- `jobId`
- `actorId`
- `type`
- `payloadJson`
- `createdAt`

### AuditLog

Campos minimos:

- `id`
- `actorId`
- `entity`
- `entityId`
- `action`
- `diffJson`
- `createdAt`

## Relaciones Clave

- una `Organization` cliente publica muchos `Job`;
- un `Job` puede tener cero o una `JobReservation` activa;
- un `Job` tiene un `Contract`;
- un `Job` tiene varios `Milestone`;
- un `Milestone` tiene varias `MilestoneEvidence`;
- un `Milestone` puede tener varias `MilestoneReview`;
- un `Job` tiene un `EscrowAccount`;
- un `EscrowAccount` tiene muchas `EscrowTransaction`;
- un `Job` puede tener muchas `Dispute`;
- un `Job` termina con `Rating` mutuo;
- todo produce `TimelineEvent` y `AuditLog`.

## Ownership del Recurso

El MVP debe poder resolver ownership sensible por organizacion:

- cliente duenio del `Job` mediante `clientOrgId`
- profesional asignado o reservado mediante `professionalOrgId`
- ops con privilegio administrativo dentro del tenant

Un `User` no debe acceder por compartir solo `tenantId`.

## Decisiones de Modelado

- `Job` es la entidad canonica del MVP.
- `Project` deja de ser la entidad principal de producto.
- `Organization` y `Membership` son parte del MVP porque el ownership real depende de ellas.
- `Bid` puede sobrevivir como modulo posterior o alterno, no como dependencia obligatoria del happy path.
- `Escrow` y `Payment` no se modelan como una sola cosa.
- `Review`, `Dispute` y `Trust` deben dejar rastros propios.

## Gaps del Estado Actual

Comparado con el schema actual:

- falta una entidad explicita de `JobReservation`;
- falta una entidad explicita de `Contract`;
- falta una entidad explicita de `MilestoneReview`;
- falta una entidad de `Rating`;
- `Project` hoy concentra demasiado significado;
- `PaymentEscrow` y `PaymentTxn` deben evolucionar a nombres y semantics mas cercanos al flujo canonico;
- la capa `Trust` todavia no esta expresada como dominio.

## Proximo Movimiento

Usar este documento para:

1. decidir si el schema Prisma actual se adapta o se migra gradualmente;
2. alinear controllers y services del API;
3. definir DTOs y contracts de `packages/schemas`;
4. preparar la primera migracion del MVP real.
