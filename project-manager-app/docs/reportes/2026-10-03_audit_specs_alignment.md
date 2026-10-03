# Alineación de specs de la auditoría con el código de `main` (grupo 5)

Fecha: 2026-10-03

## Qué se revisó

El grupo 5 de la rama de respaldo `backup/money-security-batch-v2-20260723`
(trabajo de Codex del 23 al 25 de julio): los commits `070615e3` y `b305643a`,
que son casi solo documentación (traen además un script y un test), más los
documentos que acompañaban a cada commit de código. La rama original no se podía aplicar tal cual: varias de sus specs
describen el estado de julio, no el de `main` hoy.

## Qué se incorporó

| Pieza | Decisión |
|---|---|
| `scripts/audit-plan-spec-coverage.mjs` y el script `spec:audit-plan-coverage` | Incorporados sin cambios. Comparan los IDs del plan de remediación con el mapeo de `audit-remediation-program.spec.md`. |
| `api.payout-method-tokenization` | Incorporada y **actualizada**: la decisión de riel (solo Stripe, sin Plaid; PR #458) ya estaba tomada y ejecutada, así que la spec dejó de pedirla. Se añadió una tabla de lo verificado en `main` y se marcó lo que no se verificó. |
| `api.worker-verification-remediation` | Incorporada y **actualizada**: la spec presentaba como propuesta un flujo que ya existe. Se documentan los dos sistemas reales (`users` y `worker-verification`) y sus brechas frente a las invariantes. |
| `ui.audit-product-decisions` | Incorporada y **actualizada**: cinco de las siete decisiones (PD-01, PD-02, PD-04, PD-06, PD-07) ya las resolvió el owner el 2026-07-27, con PR; PD-03 sigue abierta y PD-05 es parcial. |
| `ui.design-system-remediation` | Incorporada y **actualizada** con el estado real de `1.15`, `1.16`, `1.17` y `1.19`, que el plan registra como cerrados o parciales. |
| `client-presentation-remediation.test.ts` | Incorporado sin cambios; ya pasa contra `main`. |
| `audit-remediation-program.spec.md` | Se actualizó el routing: los ítems cuya decisión ya se resolvió pasan a `CLOSED` y se mapean `2.49`, `3.45` y `3.46`, que no estaban. |

## Qué no se incorporó

- **El reporte `2026-07-23_audit_plan_spec_alignment.md` de la rama original:**
  documenta la sesión de Codex y sus conteos de julio; este reporte lo
  reemplaza.
- **Los cambios de `pro-flows-remediation.spec.md` y
  `client-flows-remediation.spec.md` del commit `b305643a`:** `main` los modificó
  después con estados más recientes; las notas fechadas del plan ya registran
  lo que cambió.
- **`labor-engine-remediation.spec.md` y `travel.spec.md`:** ya llegaron por los
  PRs #761 y #763.

## Corrección del mapeo de la spec de programa

El script midió el estado real contra `main` antes de este cambio:
161 hallazgos en el plan, 158 mapeados, 3 sin mapear (`2.49`, `3.45`, `3.46`) y
1 sobrante (`0.1b`, que no existe en el plan). Tras el cambio: 161 de 161, sin
faltantes ni sobrantes. Los contadores por sección (36, 23, 54 y 48) salen de
esa medición, no de una suma a mano.

## Pendiente

- Cuando se mergee el PR #766, el plan tendrá el hallazgo `3.47` y el script lo
  marcará como sin mapear hasta que se amplíe el rango `3.0`–`3.46` a `3.47`.
- `spec:validate:strict` tiene un error restante: la spec de programa referencia
  `docs/specs/api/travel.spec.md`, que restituye el PR #763. Con ambos mergeados
  queda en cero.
- Las decisiones abiertas están listadas en cada spec: proveedor KYC/DID y
  evidencia mínima (verificación), países y migración de métodos legacy
  (payout), y la fuente del "nivel de confianza" que menciona Prometeo (`1.11b`).
- El script no está conectado a CI; hoy se ejecuta a mano con
  `pnpm spec:audit-plan-coverage`.
