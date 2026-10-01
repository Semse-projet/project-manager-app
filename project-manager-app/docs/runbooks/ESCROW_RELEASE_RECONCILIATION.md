# Runbook — Reconciliación de releases de escrow (ADR-041 · 2b)

Un RELEASE en `PENDING` (resultado `unknown` o proveedor "en proceso" cuyo webhook no llegó) **bloquea los reintentos de ese milestone** hasta resolverse: es deliberado para no pagar dos veces. Este runbook es el procedimiento manual; el informe es de **solo lectura**.

## 1. Detectar
```bash
pnpm --filter @semse/api build
pnpm payments:reconcile-report -- --stale-minutes=30 --report=reconcile.json   # exit 3 si hay estancados
```
- `stale_no_provider_ref` — la reserva nunca recibió `providerRef`: **no sabemos si el dinero se movió**. Usar `providerSearchKey` (la referencia de reserva) para buscar en el proveedor (Stripe: metadata `semse_external_ref` / idempotency key `semse_payout_<ref>`; PayPal: `sender_batch_id`; Adyen: `reference`).
- `stale_awaiting_webhook` — hay `providerRef`: consultar su estado en el proveedor; el webhook pudo perderse.

## 2. Resolver (manual, con evidencia)
1. Confirmar en el panel/API del proveedor el estado real.
2. Existe y está pagada → finalizar el `PaymentTxn` como `SUCCEEDED` con el id real del proveedor y el milestone como `PAID`; **no** reintentar.
3. No existe / falló → marcar `FAILED` (libera el saldo y permite reintentar con otra `Idempotency-Key`).
4. Registrar quién resolvió, la evidencia (id/captura del proveedor) y el `transactionId` en el reporte de la sesión. Cualquier escritura en `PaymentTxn` la hace un operador autorizado; el informe nunca escribe.

## 3. Lo que NO hace todavía (pendiente)
Consulta automática al proveedor, resolución asistida y alerta programada (job de worker). Hasta entonces **`PAYMENTS_RELEASE_COMMAND` debe seguir apagado en producción**.
