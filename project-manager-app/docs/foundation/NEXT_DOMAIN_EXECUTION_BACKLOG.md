# Next Domain Execution Backlog

## Prioridad 1: Reservations

- crear `ReservationsModule`
- crear controller, service y repository
- soportar reserva activa, release y accept
- validar una sola reserva activa por job
- auditar aceptacion y expiracion

## Prioridad 2: Contracts

- crear `ContractsModule`
- generar contrato a partir de reserva aceptada
- registrar `termsJson`
- registrar firma y `documentHash`
- permitir consulta del contrato vigente por `jobId`

## Prioridad 3: Evidence Reframing

- reforzar `GET /v1/jobs/:jobId/evidence` como ruta principal
- mantener `GET /v1/projects/:projectId/evidence` como puente
- documentar que `evidence` pertenece al flujo de `Job` y `Milestone`

## Prioridad 4: Escrow / Payments Separation

- exponer vista principal de escrow por `jobId`
- mantener provider/webhook/reconciliation dentro de `payments`
- evitar nuevos contratos de producto centrados en `projectId`

## Prioridad 5: UI Alignment

- superficies operativas deben mostrar `Job` como unidad principal
- `Project` solo como ejecucion derivada
- errores de permisos deben seguir degradando con claridad

## Criterio de ejecucion

Cada item que entre a implementacion debe responder:

- cual es el agregado principal
- quien es owner del recurso
- cual es la ruta canonica
- si existe puente transicional legacy
- como se audita
