# Implementation Gaps vs Vision

## Objetivo

Dejar visibles las diferencias entre la vision canonica del sistema y el estado
real de implementacion, para evitar que la herencia tecnica se convierta en
direccion de producto por accidente.

Fuente canonica:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

## Brechas Principales

### 1. `Job` es canonico, pero `Project` sigue concentrando parte de la ejecucion

Vision:

- `Job` es la unidad principal del marketplace
- `Project` no debe ser la entidad principal de negocio

Implementacion actual:

- milestones aun nacen bajo `/v1/projects/:projectId/milestones`
- escrow mantiene rutas legacy bajo `/v1/projects/:projectId/escrow/*`
- evidence ya tiene lectura canonica por `jobId`, pero parte de la persistencia y compatibilidad sigue resolviendo `projectId`
- payments y parte de disputes todavia se apoyan en `Project`

Lectura correcta:

`Project` sigue siendo una abstraccion operativa transitoria, aunque ya existen avances job-first visibles en rutas y contracts.

Documento de referencia:

- [`JOB_VS_PROJECT_BOUNDARY.md`](/home/yoni/labsemse/project-manager-app/docs/foundation/JOB_VS_PROJECT_BOUNDARY.md)

### 2. Estados historicos siguen vivos en Prisma y contratos

Vision canonica:

- `POSTED`
- `RESERVED`
- `ACCEPTED`
- `IN_PROGRESS`
- `REVIEW`
- `RELEASED`
- `COMPLETED`
- `DISPUTE`

Implementacion actual:

- `JobStatus` usa tambien `PUBLISHED` y `AWARDED`
- `PaymentTxnType` usa `DEPOSIT`

Lectura correcta:

Es compatibilidad temporal.
No debe tomarse como lenguaje definitivo del producto.

Regla visible del MVP:

- las surfaces nuevas deben exponer `POSTED` en lugar de `PUBLISHED`
- las surfaces nuevas deben exponer `FUND` en lugar de `DEPOSIT`
- `AWARDED` no debe promoverse como estado visible nuevo del sprint

### 3. El flujo por reserva y contrato no esta cerrado en runtime

Vision:

- reserva temporal
- contrato digital
- trabajo firmado y luego ejecutado

Implementacion actual:

- existen entidades Prisma para `JobReservation` y `Contract`
- el backend modular visible aun gira principalmente alrededor de `bids -> accept -> project`

Lectura correcta:

La base de datos ya prepara el dominio objetivo, pero la API todavia no lo expone
como flujo canonico principal.

### 4. Trust existe en vision, pero no como capa cerrada de implementacion

Vision:

- reputacion por comportamiento
- antifraude
- risk engine
- trust signals

Implementacion actual:

- hay `risk scores`, `ops`, `audit` y agentes
- ya existe lectura documental inicial de `trust` por `jobId` y `projectId`
- no existe aun un modulo de `trust` claramente cerrado como agregado de producto con policy separada y consumo consistente por ops

Lectura correcta:

La capacidad existe de forma parcial y distribuida.
Todavia no esta consolidada como capa de dominio completa.

### 5. Los contratos compartidos estaban mezclando ownership por usuario y por organizacion

Vision:

- ownership comercial y operativo se resuelve por organizacion
- usuario, membresia y rol ejecutan acciones dentro de esa organizacion

Implementacion actual:

- Prisma y `packages/schemas` ya empezaron la transicion
- `JobReservation` y `Contract` conservan referencias historicas a usuario
- ahora tambien exponen referencias a organizacion para no perder alineacion con el dominio canonico

Lectura correcta:

Los ids de usuario siguen siendo utiles para firma, auditoria y trazabilidad
individual.
Los ids de organizacion son la referencia canonica para ownership del flujo.

Documento de referencia:

- [`DOMAIN_INVARIANTS.md`](/home/yoni/labsemse/project-manager-app/docs/foundation/DOMAIN_INVARIANTS.md)

### 6. Ops y Web deben tolerar permisos parciales, no asumir acceso universal

Vision:

- `SEMSE Ops` es una capa supervisada y auditable
- el frontend no debe reinterpretar permisos del backend

Implementacion actual:

- `apps/web` ya consume `ops` y `projects`
- el runtime ahora tolera respuestas parciales y errores `403/404/409`
- `ops.dashboard` expone tanto estados heredados como estados mas cercanos al flujo canonico
- el proxy web ya preserva mejor errores upstream en lugar de colapsarlos

Lectura correcta:

La UI debe degradar con claridad cuando un recurso no este autorizado.
No debe tratar la ausencia de acceso como fallo de producto ni como permiso implicito.
`ops` debe leerse como superficie de supervision y no como fuente paralela de verdad de dominio.

## Proximos Frentes Derivados

- Sprint 02:
  [`/home/yoni/labsemse/program/SPRINT_02_SECURITY_BACKLOG.md`](/home/yoni/labsemse/program/SPRINT_02_SECURITY_BACKLOG.md)
- Sprint 03:
  [`/home/yoni/labsemse/program/SPRINT_03_SCHEMA_BACKLOG.md`](/home/yoni/labsemse/program/SPRINT_03_SCHEMA_BACKLOG.md)

## Regla Operativa

Hasta cerrar estas brechas:

- la vision manda sobre la implementacion historica
- `foundation` debe distinguir siempre entre objetivo y transicion
- cualquier decision de arquitectura nueva debe evitar profundizar las dependencias equivocadas
