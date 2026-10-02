# ADR-041 slice 2a — núcleo del EscrowReleaseCommand (2026-10-01)

## Hallazgo de seguridad (dinero)
`releaseFunds()` solo comprobaba saldo, no que el milestone ya tuviera un RELEASE activo. Con un escrow que cubre varios milestones, auto-release (al aprobar) y una liberación manual del mismo milestone —o dos llamadas repetidas— podían reservar ambas y disparar **dos transferencias reales**. Además, ante un timeout del proveedor el camino manual marcaba la reserva FAILED y liberaba el saldo aunque el dinero pudiera haberse movido.

## Cambios
- `escrow-release.command.ts`: `runEscrowRelease(ports, input)` (reserva→transferencia→finalización). Referencia de reserva determinista (`pending_release_{milestone}_{idempotencyKey}`, `providerRef` UNIQUE); estados `released|pending|failed|unknown`; fallo ambiguo ⇒ reserva PENDING + `unknown`; transferencia OK + fallo al finalizar ⇒ `unknown` con `transferConfirmed`.
- `payments.repository.ts`: `releaseFunds` (Serializable) rechaza un 2.º RELEASE PENDING/SUCCEEDED del mismo milestone (409 `ReleaseAlreadyActiveError`) — **siempre activo**, también con el flag apagado; `findActiveRelease`, `findStalePendingReleases`.
- `payments.service.ts`: con `PAYMENTS_RELEASE_COMMAND=on` el camino manual/agente/Prometeo usa el comando (replay ⇒ resultado de la primera; `unknown`/`failed` ⇒ 409 con estado explícito). Apagado = camino anterior.
- Sin migración (la idempotencia usa `providerRef` UNIQUE existente).

## Pruebas
`escrow-release-command.test.ts` (10): camino feliz, repetición, concurrencia (1 transferencia), en proceso, rechazo 4xx, ambiguo ⇒ unknown sin doble pago, finalización fallida, clasificación de errores, flag, reconciliación. Suite API: 2583 pass, 0 fail.

## No hecho (2b y siguientes)
- Auto-release (`EscrowReleaseService`, Stripe Connect con fee) como adaptador del mismo comando; hoy solo comparte la guarda por milestone.
- Reconciliador proveedor↔DB (job/endpoint que consulte al proveedor): solo existen la consulta y la clasificación.
- Dual approval (D2 sin definir), slice 4 (UI "Liberar" con `milestoneId`, retirar `payment-governance/releasePayment()`).
- Sin canary ni smoke. Un RELEASE PENDING atascado ahora bloquea reintentos del milestone hasta reconciliarse (intencional; requiere el reconciliador/runbook antes de activar el flag).
