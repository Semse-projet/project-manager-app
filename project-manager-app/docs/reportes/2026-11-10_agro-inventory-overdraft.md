# Reporte — 0.49a / PD-08: sobregiro de inventario agro

**Fecha:** 2026-11-10 · **Hallazgo:** `AUDIT_REMEDIATION_PLAN.md` 0.49a (entrada añadida en #1032) · **Decisión:** PD-08 en `ui.audit-product-decisions` (dueño, 2026-11-10) · **Rama:** `fix/agro-inventory-overdraft` · **PR:** pendiente

| SPEC | CODE | TEST local | CI | MERGE | DEPLOY | ACTIVATION | UAT |
|---|---|---|---|---|---|---|---|
| Decisión PD-08 resuelta | COMPLETE | PASS dirigido (12 fallos de entorno preexistentes en la suite) | PENDIENTE | NO | NO | Sin flag: activo al desplegar | NO |

## Decisión aplicada

Elegiste **permitir y alertar**. Una salida (o un ajuste negativo) que deja el stock por debajo de cero **no se rechaza**, porque el consumo de campo es real aunque el inventario registrado vaya atrasado. En cambio, se marca como sobregiro y se avisa al supervisor.

## Cambios (sin migración)

- `AgroInventoryService.recordMovement` (y `consumeInventory`, que la usa): después de registrar el movimiento calcula el stock resultante.
  - La respuesta incluye `resultingStock` y `overdraft`.
  - `inventory.movement_recorded` también guarda los dos valores.
  - Si el stock queda negativo, añade una fila propia en `AgroAuditEvent` con la acción `inventory.overdraft_recorded`, que es la marca durable. No crea ningún evento de dominio: de la auditoría agro solo se reflejan como eventos los de incidencias y capacidades (`agro-domain-events.spec.md`).
- `AgroDashboardService`: alerta nueva `INVENTORY_OVERDRAFT` (`CRITICAL`) por cada artículo con stock negativo, aunque no tenga `minimumStock`. Esos artículos ya no salen además como `LOW_STOCK`. Siguiente acción sugerida: `RECONCILE_INVENTORY` (prioridad 2).
- `AgroAuditReportService`: hallazgo `WARNING` de inventario por stock negativo en el informe semanal.

## Verificación

- `agro-inventory-overdraft.test.ts`: 7/7 (servicio, dashboard e informe). Control negativo con el código de `main`: fallan 6; el que pasa cubre el stock bajo positivo, que no debía cambiar.
- Todos los tests agro: 227 pass / 0 fail (7 omitidos).
- Suite API: 3975 pass / 12 fail. Son los mismos 12 de entorno de siempre (motor de Prisma y DNS).
- `tsc --noEmit` limpio; eslint sin errores en los archivos tocados.

## No verificado / pendiente

- **En vivo:** sin probar.
- **Al fusionar este PR y #1032:** marcar 0.49a como `[x]` en el plan y pasar su ruta a `CLOSED`.
- **Fuera de alcance:** las notificaciones push al supervisor. El aviso se da en el dashboard, el informe semanal y la auditoría de la finca.
- **Concurrencia:** el stock resultante se calcula después de insertar, sin bloqueo. Con dos salidas simultáneas, las dos pueden marcarse como sobregiro o ninguna hasta la siguiente lectura. El dashboard siempre recalcula el saldo real, así que la alerta no se pierde.
