# ADR-041 2b — job de worker de reconciliación (2026-10-01)

Decisión del dueño: worker job (no endpoint público), solo lectura, ~cada 15 min, detecta PENDING estancados, emite alerta/auditoría, **nunca** cambia estado ni reintenta dinero; la resolución sigue siendo humana.

## Hecho
- `EscrowReleaseReconcileService.runCheck`: consulta RELEASE PENDING estancados (30 min por defecto), construye el informe (mismo clasificador de #721) y, por cada caso, emite log estructurado `escrow_release_reconcile_alert` (`alert:true`) + `AuditLog` append-only `escrow.release.reconcile_alert` (tenant del escrow, sin actor), **como mucho 1 vez/24 h por transacción**.
- Endpoint **interno** `POST /v1/admin/payments/release-reconcile/check` (`ops:dashboard:write`, mismo patrón que `/v1/admin/liens/check-deadlines`; añadido a `SEMSE_API_SURFACE_V1.md`). El worker no tiene Prisma, por eso llama a la API como los demás jobs.
- Worker: timer cada 15 min detrás de `PAYMENTS_RECONCILE_ENABLED=true` (**off por defecto**), nivel warn si hay estancados; nunca llama a release/refund/retry.
- Repositorio: `findStalePendingReleases` ahora incluye el tenant; `hasRecentReleaseReconcileAlert`, `recordReleaseReconcileAlert`.

## Verificación
- 6 tests (`escrow-release-reconcile-job`): alerta+auditoría por caso con tenant correcto, ignora frescos, suprime re-alertas, vacío sin alertas, **solo lectura** (repo simulado sin mutadores + el código fuente no contiene finalize/release/refund/payout/update/delete), permiso del endpoint, worker detrás del flag y solo llama al endpoint de comprobación.
- **Prueba real en Postgres 16** (esquema migrado, 4 txns sembradas en 2 tenants): 1.ª pasada alerta 2 (tenA/tenB), 2.ª los suprime, las `PaymentTxn` quedan idénticas, auditorías con tenant y actor nulo.
- `tsc` limpio; suite API verde (ver PR).

## Para activarlo
Poner `PAYMENTS_RECONCILE_ENABLED=true` en el **worker** y configurar una alerta de logs sobre `escrow_release_reconcile_alert`/`alert:true`. Hasta ensayar el runbook con el job activo, `PAYMENTS_RELEASE_COMMAND` sigue OFF.

## No hecho
Consulta automática al proveedor y resolución asistida (siguen siendo manuales); adaptador del auto-release.
