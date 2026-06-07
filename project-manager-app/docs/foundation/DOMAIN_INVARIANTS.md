# Domain Invariants

## Fuente Canonica

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

## Objetivo

Fijar reglas que no deben romperse en dominio, seguridad y lifecycle.

## Invariantes Globales

- ownership se resuelve por organizacion
- `tenantId` solo acota el espacio; no autoriza por si solo
- financial reads requieren permiso sensible y policy por recurso
- los estados terminales no se reabren sin politica explicita
- la vision manda sobre la herencia tecnica

## Ownership por Agregado

### Job

Visible para:

- `OPS_ADMIN`
- org cliente duena del job
- org profesional cuando la policy de marketplace lo permita

Regla:

- no debe asumirse lectura universal de todos los jobs del tenant si el flujo se
  endurece mas adelante

### Project

Visible para:

- `OPS_ADMIN`
- `project.job.clientOrgId`
- `project.assignedProOrgId`

Financials:

- solo `OPS_ADMIN` y cliente dueno
- el pro asignado no debe leer financials por defecto salvo politica explicita

### Payment / Escrow

Visible para:

- `OPS_ADMIN`
- cliente dueno del trabajo/proyecto

Regla:

- no exponer transacciones ni escrow a actores sin ownership directo

### Milestone

Visible para:

- `OPS_ADMIN`
- cliente dueno
- pro asignado

Mutaciones:

- submit: pro asignado u ops segun politica
- approve/reject: cliente dueno u ops segun politica

### Dispute

Visible para:

- `OPS_ADMIN`
- cliente dueno
- pro asignado

Mutaciones:

- crear: cliente o pro segun ownership
- resolver: ops o arbitro explicitamente autorizado

## Invariantes de Job

Estados visibles canonicos del MVP:

- `DRAFT`
- `POSTED`
- `RESERVED`
- `ACCEPTED`
- `IN_PROGRESS`
- `REVIEW`
- `DISPUTE`
- `COMPLETED`
- `CANCELLED`

Estados heredados de compatibilidad:

- `PUBLISHED` se lee como `POSTED`
- `AWARDED` se considera legado transicional y no debe aparecer como estado visible nuevo del producto

Reglas:

- `Job` no debe llegar a `COMPLETED` si el cierre operativo y financiero no esta resuelto
- `Job` no debe llegar a `CANCELLED` si existe ejecucion/escrow incompatible sin politica de cierre
- `RESERVED` debe ser temporal
- `ACCEPTED` implica asignacion valida y base contractual

## Invariantes de Project

Estados actuales:

- `OPEN`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETED`
- `CANCELLED`

Reglas:

- `OPEN -> IN_PROGRESS`
  requiere asignacion valida
- `OPEN -> CANCELLED`
  requiere ausencia de incompatibilidad financiera
- `IN_PROGRESS -> BLOCKED`
  permitido
- `IN_PROGRESS -> COMPLETED`
  solo si milestones y disputes lo permiten
- `IN_PROGRESS -> CANCELLED`
  restringido si ya hubo ejecucion o liberaciones
- `BLOCKED -> IN_PROGRESS`
  permitido
- `BLOCKED -> CANCELLED`
  requiere cierre financiero valido
- `COMPLETED`
  terminal
- `CANCELLED`
  terminal

## Invariantes de Milestone

Estados:

- `DRAFT`
- `AWAITING_REVIEW`
- `APPROVED`
- `REJECTED`
- `PAID`

Reglas:

- no `PAID` sin release financiero exitoso
- no `APPROVED` sin revision valida
- `REJECTED` debe dejar trazabilidad

## Invariantes de Escrow / Payments

Reglas:

- no liberar mas de lo depositado
- no cancelar trabajo/proyecto con fondos retenidos sin regla explicita
- no completar ejecucion con pagos inconsistentes
- `DEPOSIT` debe entenderse como herencia tecnica hacia semantica canonica de fondeo

## Invariantes de Dispute

Reglas:

- disputa abierta bloquea cierre final segun politica minima actual
- disputa abierta debe congelar releases no obligatorios mientras no exista decision explicita
- resolucion debe quedar auditada
- toda resolucion debe dejar trazabilidad sobre su efecto financiero: release, holdback, refund o cierre sin movimiento
- fondos y estados no deben moverse como si no existiera disputa activa

## Invariantes de Trust

Reglas:

- `trust` es capa explicable de lectura y senales; no reemplaza policy ni ownership
- un score o senal de `trust` no bloquea por si solo una accion sensible sin regla explicita de policy
- `trust` debe poder explicar al menos las senales base usadas en una decision visible para ops
- señales de disputa, rechazo, falta de evidencia o falla financiera no deben perderse al cerrar el job; deben quedar historizadas

## Invariantes de Ops

Reglas:

- `ops` supervisa, interviene y audita; no redefine ownership canonico del dominio
- snapshots, dashboards o vistas operativas no deben inventar un lifecycle alterno al de `Job`
- cualquier override manual de ops sobre estados, disputas o decisiones financieras debe quedar auditado con actor, motivo y efecto
- `ops` puede degradar o pausar flujos por seguridad, pero debe dejar trazabilidad y criterio visible para revision posterior

## Invariantes de Auditoria

- cambios sensibles deben auditar:
  - actor
  - entidad
  - accion
  - estado previo
  - estado siguiente

## Regla de Implementacion

Controllers:

- validan input
- resuelven contexto

Services / Policy:

- aplican invariantes

Repositories:

- aplican acceso a datos y filtros persistentes

La regla critica es:

- no duplicar invariantes de dominio entre controller y repository
