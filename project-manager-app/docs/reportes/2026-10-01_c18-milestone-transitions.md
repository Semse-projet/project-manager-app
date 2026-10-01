# C18 — Hitos y aprobación de avances (2026-10-01)

## Bugs corregidos (sin migración)
1. **Transiciones no atómicas.** `submit/approve/reject/requestChanges` hacían snapshot → política → `update where id` sin condición de estado. Dos peticiones concurrentes (aprobar vs rechazar, doble aprobación) pasaban ambas la política, el estado final dependía del orden y las dos emitían eventos (y el auto-release). Ahora `transitionStatus` es compare-and-set (`updateMany where {id, status: <esperado>}`); la perdedora recibe 409 "milestone status changed concurrently".
2. **Rechazar un hito aprobado con el pago en vuelo.** La política permitía `reject`/`requestChanges` desde `approved`; con un RELEASE `PENDING` (auto-release en curso, el hito sigue APPROVED hasta finalizar) el cliente podía rechazar y `finalizeRelease` lo volvía a poner `PAID`: dinero movido para un hito rechazado. El snapshot incluye ahora `hasActiveRelease` (RELEASE PENDING/SUCCEEDED) y la política lo bloquea (también para OPS_ADMIN).

## Verificación
- `tsc` limpio; suite API 2612 pass / 0 fail; `milestone-transition-atomicity.test.ts` (7).
- **Comparación contra el código anterior** (fake con `update` incondicional): los 3 caminos felices pasan en ambos; los 4 tests de los bugs (aprobar‖rechazar, doble aprobación, rechazar con payout activo, política) **fallan antes y pasan después**.
- No probado contra Postgres real con concurrencia real (el CAS es un `updateMany` condicional estándar).

## Hallazgos abiertos (no corregidos; decisión o spec)
- **Auto-release sin revalidar el estado del hito:** `tryAutoRelease` evalúa gobernanza pero no comprueba que el hito siga `APPROVED` al reservar; la ventana aprobar→rechazar→reservar queda cubierta solo por el nuevo bloqueo en sentido reject→(release activo), no en sentido inverso. Se resuelve con la guarda de estado dentro de la reserva (ADR-041 slice 2b, adaptador auto-release).
- **Auto-aprobación:** si `clientOrgId == assignedProOrgId`, el mismo org entrega y aprueba su propio hito. Cambiar la política puede romper demos de una sola org: requiere decisión.
- **Aprobar no revalida evidencia validada** (solo `evidenceCount > 0` en submit): hace falta definir si approve exige evidencia `passed`.
