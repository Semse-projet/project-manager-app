# State Machines

## Objetivo

Formalizar los estados, transiciones y condiciones del dominio principal de
SEMSEproject para evitar lifecycle ambiguo o reglas implícitas repartidas entre
UI, API y persistencia.

## Precedencia

Este documento implementa y concreta:

- [`DOMAIN_MODEL.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/DOMAIN_MODEL.md)
- [`DOMAIN_INVARIANTS.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/DOMAIN_INVARIANTS.md)
- [`ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md)

Regla:

- ningún endpoint, worker o pantalla puede inventar una transición que no esté
  alineada con este documento o con una policy derivada explícita.

## Principios

1. Los estados visibles deben ser pocos, claros y explicables.
2. Los estados internos pueden existir, pero no deben contaminar el lenguaje de
   producto si no agregan valor operativo.
3. Los estados terminales no se reabren sin política explícita.
4. Un cambio de estado sensible debe quedar auditado.
5. El dinero, la evidencia y la disputa tienen prioridad sobre la comodidad de
   transición.

## Job

### Estados canónicos

- `DRAFT`
- `POSTED` (alias externo: `PUBLISHED`)
- `RESERVED`
- `ACCEPTED`
- `IN_PROGRESS`
- `REVIEW` (equivalente a WAITING_REVIEW en especificaciones previas)
- `COMPLETED`
- `DISPUTE`
- `CANCELLED`
- `AWARDED` (adjudicación directa sin bid — flujo alternativo)

> **Nota de alineación (2026-05-20):** El estado `WAITING_REVIEW` de especificaciones
> anteriores se implementa como `review` en el código actual. `PARTIALLY_PAID` se planificó
> pero no fue implementado — el ciclo de pagos parciales se maneja a nivel de milestone
> individual, no como estado visible del job. `AWARDED` y `PUBLISHED` son estados del código
> no documentados en versiones anteriores de este archivo.

### Transiciones válidas

- `DRAFT -> POSTED`
- `DRAFT -> CANCELLED`
- `POSTED -> RESERVED`
- `POSTED -> CANCELLED`
- `PUBLISHED -> RESERVED` (alias de POSTED)
- `PUBLISHED -> CANCELLED`
- `RESERVED -> ACCEPTED`
- `RESERVED -> POSTED`
- `ACCEPTED -> IN_PROGRESS`
- `ACCEPTED -> CANCELLED`
- `IN_PROGRESS -> REVIEW`
- `IN_PROGRESS -> DISPUTE`
- `REVIEW -> COMPLETED`
- `REVIEW -> IN_PROGRESS`
- `DISPUTE -> COMPLETED`
- `DISPUTE -> CANCELLED`
- `AWARDED -> IN_PROGRESS`

### Autorización por transición

- Solo CLIENT puede ejecutar: `COMPLETED`, `CANCELLED`
- Solo PRO puede ejecutar: `REVIEW`, `DISPUTE`
- OPS_ADMIN puede ejecutar cualquier transición

### Condiciones

- `DRAFT -> POSTED`
  requiere title (≥5 chars), scope (≥10 chars), ownership válido.
- `POSTED -> RESERVED`
  requiere reserva activa válida y sin conflicto de concurrencia.
- `RESERVED -> ACCEPTED`
  requiere reserva no expirada y aceptación válida del flujo comercial.
- `ACCEPTED -> IN_PROGRESS`
  requiere base contractual mínima activa.
- `IN_PROGRESS -> REVIEW`
  requiere trabajo ejecutado; solo PRO puede solicitar review.
- `REVIEW -> COMPLETED`
  requiere revisión satisfactoria del cliente; milestones resueltos y escrow sin fondos retenidos abiertos.
- `* -> DISPUTE`
  requiere causa formal y trazabilidad; solo PRO puede abrir disputa.
- `* -> CANCELLED`
  requiere cierre operativo y financiero compatible; solo CLIENT u OPS_ADMIN.

## Reservation

### Estados

- `ACTIVE`
- `EXPIRED`
- `ACCEPTED`
- `RELEASED`

### Transiciones válidas

- `ACTIVE -> ACCEPTED`
- `ACTIVE -> EXPIRED`
- `ACTIVE -> RELEASED`

### Condiciones

- solo una reserva activa por `Job`
- una reserva expirada no puede aceptarse
- una reserva aceptada debe quedar auditada

## Contract

### Estados

- `DRAFT`
- `PENDING_SIGNATURES`
- `PARTIALLY_SIGNED`
- `ACTIVE`
- `SUPERSEDED`
- `VOID`

### Transiciones válidas

- `DRAFT -> PENDING_SIGNATURES`
- `PENDING_SIGNATURES -> PARTIALLY_SIGNED`
- `PENDING_SIGNATURES -> ACTIVE`
- `PARTIALLY_SIGNED -> ACTIVE`
- `ACTIVE -> SUPERSEDED`
- `DRAFT -> VOID`
- `PENDING_SIGNATURES -> VOID`

### Condiciones

- no hay `ACTIVE` sin condiciones mínimas de firma
- después de firma, términos deben ser inmutables o versionados
- `SUPERSEDED` requiere contrato posterior explícito

## Milestone

### Estados

- `DRAFT`
- `READY`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `PAID`

### Transiciones válidas

- `DRAFT -> READY`
- `READY -> SUBMITTED`
- `SUBMITTED -> APPROVED`
- `SUBMITTED -> REJECTED`
- `REJECTED -> READY`
- `APPROVED -> PAID`

### Condiciones

- `READY -> SUBMITTED`
  requiere evidencia mínima y actor autorizado.
- `SUBMITTED -> APPROVED`
  requiere revisión válida.
- `APPROVED -> PAID`
  requiere release financiero exitoso.
- `REJECTED -> READY`
  requiere nueva iteración o subsanación explícita.

## Evidence

### Estados

- `UPLOADED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `REJECTED`

### Transiciones válidas

- `UPLOADED -> UNDER_REVIEW`
- `UNDER_REVIEW -> ACCEPTED`
- `UNDER_REVIEW -> REJECTED`

### Condiciones

- evidencia sin contexto de job o milestone no debe entrar al flujo core
- toda validación debe registrar actor, motivo y timestamp

## PaymentEscrow

### Estados

- `PENDING`
- `FUNDED`
- `HELD`
- `PARTIALLY_RELEASED`
- `RELEASED`
- `DISPUTED`
- `REFUNDED`

### Transiciones válidas

- `PENDING -> FUNDED`
- `FUNDED -> HELD`
- `HELD -> PARTIALLY_RELEASED`
- `HELD -> RELEASED`
- `PARTIALLY_RELEASED -> HELD`
- `PARTIALLY_RELEASED -> RELEASED`
- `HELD -> DISPUTED`
- `PARTIALLY_RELEASED -> DISPUTED`
- `DISPUTED -> HELD`
- `DISPUTED -> RELEASED`
- `DISPUTED -> REFUNDED`

### Condiciones

- no liberar más de lo fondeado
- no pasar a `RELEASED` con ledger inconsistente
- disputa activa puede bloquear releases no obligatorios

## Dispute

### Estados

- `OPEN`
- `UNDER_REVIEW`
- `RESOLVED`
- `CANCELLED`

### Transiciones válidas

- `OPEN -> UNDER_REVIEW`
- `UNDER_REVIEW -> RESOLVED`
- `OPEN -> CANCELLED`

### Condiciones

- toda resolución debe dejar outcome explícito:
  - `release`
  - `holdback`
  - `refund`
  - `close_without_money_move`

## TrustProfile

### Estados operativos

- `NORMAL`
- `WATCH`
- `RESTRICTED`

### Reglas

- `trust` no reemplaza policy
- `trust` puede elevar riesgo, no autorizar por sí solo
- cambios de banda deben ser explicables por señales registradas

## Regla de implementación

- Controllers validan inputs y contexto.
- Services aplican transiciones y guards.
- Repositories persisten.
- Workers ejecutan transiciones automáticas solo si la regla existe aquí o en
  policy derivada.

## Definition of Done para una máquina de estados

Un lifecycle se considera bien implementado cuando:

1. existe en `packages/schemas` como enum/contrato;
2. existe en Prisma o capa de persistencia equivalente;
3. la API usa solo transiciones válidas;
4. la UI refleja el estado real sin inventar optimismo falso;
5. el cambio deja audit trail;
6. no hay transiciones duplicadas escondidas en frontend;
7. hay test o smoke que cubre el camino principal.

## Regla de scope

Durante migración de un flujo:

- no rediseñar;
- no ampliar alcance;
- no agregar nuevas capacidades no necesarias;
- solo replicar, conectar, estabilizar y absorber.
