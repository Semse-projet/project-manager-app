# Reservations and Contracts Blueprint

## Objetivo

Traducir el flujo canonico de vision a un siguiente paso implementable en API:

`Job -> Reservation -> Contract -> Escrow -> Milestone -> Evidence -> Review -> Release -> Dispute/Close`

Hoy el runtime visible todavia se apoya en `bids -> accept -> project`.
Este documento define como abrir el camino correcto sin romper compatibilidad
del backend actual.

## Decision

- `reservations` y `contracts` deben existir como modulos propios.
- no deben nacer como extensiones difusas dentro de `jobs` o `projects`.
- primero se abre el flujo de dominio y luego se decide que endpoints viejos
  quedan como puente transicional.

## Estado actual

Ya existe soporte en Prisma para:

- `JobReservation`
- `Contract`

Todavia no existe un modulo visible equivalente en `apps/api`.

## Reservation Module

### Responsabilidades

- crear reserva de un `Job`
- expirar reserva
- liberar reserva
- aceptar reserva
- validar concurrencia y ventana temporal
- producir timeline/audit si aplica

### Ownership

- cliente dueño del `Job`
- profesional que reserva
- `OPS_ADMIN`

### Endpoints propuestos

- `POST /v1/jobs/:jobId/reservations`
- `GET /v1/jobs/:jobId/reservations`
- `POST /v1/reservations/:reservationId/accept`
- `POST /v1/reservations/:reservationId/release`
- `POST /v1/reservations/:reservationId/expire`

### Reglas minimas

- solo puede existir una reserva activa por `Job`
- una reserva expirada no puede aceptarse
- una reserva aceptada debe dejar evidencia auditable
- la aceptacion de reserva es el puente correcto hacia contrato y ejecucion

## Contract Module

### Responsabilidades

- generar borrador contractual
- persistir `termsJson`
- registrar firmas
- guardar `documentHash`
- enlazar referencia documental y PDF
- dejar trazabilidad para soporte y disputa

### Ownership

- cliente dueño del `Job`
- profesional reservado/aceptado
- `OPS_ADMIN` para lectura y soporte

### Endpoints propuestos

- `POST /v1/jobs/:jobId/contracts`
- `GET /v1/jobs/:jobId/contracts/current`
- `POST /v1/contracts/:contractId/sign`
- `GET /v1/contracts/:contractId`

### Reglas minimas

- no se genera contrato si no existe reserva aceptada o flujo equivalente
- un contrato no queda activo hasta completar condiciones de firma definidas
- `termsJson` debe ser inmutable o versionado despues de la firma inicial
- `documentHash` y `pdfUrl` quedan canonizados en la primera firma y no deben mutar
  entre firmantes
- `OPS_ADMIN` no debe firmar ambos lados implicitamente; cualquier override debe ser
  explicito y auditado
- firma y hash deben quedar auditados

## Relacion con Project

Mientras `Project` siga existiendo:

- su creacion debe entenderse como consecuencia operativa de una reserva
  aceptada y/o contrato activo
- no debe seguir siendo el gatillo conceptual primario del flujo
- `bids` debe tratarse como camino legacy y no puede competir con
  `reservations/contracts` sobre el mismo `Job`

## Plan de implementacion recomendado

### Fase 1

- crear `ReservationsModule`
- exponer endpoints minimos
- usar `JobReservation` existente en Prisma
- dejar expiracion manual primero

### Fase 2

- crear `ContractsModule`
- generar contrato basico a partir de reserva aceptada
- registrar firma simple y hash

### Fase 3

- conectar reservas/contratos con escrow y milestones
- mover UI para pensar primero en `Job` y reserva, no en `Project`

## Definition of Done

Se considera bien implementado si:

- `reservations` y `contracts` existen como modulos separados
- los endpoints reflejan ownership correcto
- hay audit trail
- la creacion de ejecucion derivada ya no nace solo de `bids`
- el lenguaje de dominio favorece `Job`, no `Project`
