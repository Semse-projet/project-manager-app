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
| `scripts/audit-plan-spec-coverage.mjs` y el script `spec:audit-plan-coverage` | Incorporados y endurecidos el 2026-10-04: solo las filas de routing aportan cobertura primaria; las excepciones exigen ruta primaria y contratos existentes. |
| `api.payout-method-tokenization` | Incorporada y **actualizada**: la decisión de riel (solo Stripe, sin Plaid; PR #458) ya estaba tomada y ejecutada, así que la spec dejó de pedirla. Se añadió una tabla de lo verificado en `main` y se marcó lo que no se verificó. |
| `api.worker-verification-remediation` | Incorporada y **actualizada**: la spec presentaba como propuesta un flujo que ya existe. Se documentan los dos sistemas reales (`users` y `worker-verification`) y sus brechas frente a las invariantes. |
| `ui.audit-product-decisions` | Incorporada y **actualizada**: cinco de las siete decisiones (PD-01, PD-02, PD-04, PD-06, PD-07) ya las resolvió el owner el 2026-07-27, con PR; PD-03 y PD-05 son parciales. |
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

- El PR #766 ya se mergeó y el plan tiene el hallazgo `3.47`; el mapeo se
  reconcilió en este PR (ver "Reconciliación tras el merge de #766").
- El PR #763 se fusionó el 2026-10-03 a las 13:59 UTC. `travel.spec.md` existe en la base actual; strict ya no conserva ese error.
- Las decisiones abiertas están listadas en cada spec: proveedor KYC/DID y
  evidencia mínima (verificación), países y migración de métodos legacy
  (payout), y, en `1.11b`, si el score Trust del lente 5D debe tener una
  superficie de UI y para qué roles (su origen ya está identificado; corregido
  el 2026-10-04, esta línea decía antes que faltaba averiguarlo).
- CI ahora ejecuta cobertura primaria, validación strict y regresiones de ambos controles. `spec:preflight` conserva su preflight de Railway; el gate SDD tiene un paso explícito separado.


## Correcciones de revisión — 2026-10-04

Base revisada: `main` en `90c7537013bc87aeb37ffa2523fa01016eeef893`.
HEAD de partida del PR #768: `214df6b7b4866e5253dff74d6159c93533bddd42`.

- **Cobertura:** el caso de Devin (quitar `3.13` de la ruta primaria conservando la excepción) ahora retorna un faltante, un error de excepción huérfana y salida 1. Texto incidental ya no aporta cobertura. Se rechazan rutas duplicadas, contratos inexistentes, rangos inválidos y planes vacíos.
- **Field Ops:** `2.49` tiene fila propia, `api-field-ops` como contrato de dominio y `CLOSED` conforme al cierre correctivo del plan. Conserva `ui.pro-flows-remediation` como contrato de superficie de la sección. La verificación DB pendiente de la spec de Field Ops sigue pendiente; no se declara `VERIFIED`.
- **Diseño:** `1.17` y `1.19` quedan `CLOSED`; `1.15` y `1.16` conservan `REVIEW_REQUIRED`. El ADR y la matriz de QA pendientes gobiernan consolidación futura y no reabren fixes corregidos. No se ejecutó una nueva verificación visual de producción.
- **SDD 2.0:** las cuatro specs recuperadas y la spec de programa declaran metadata de entrega y el índice se regenera. Las cuatro primeras conservan `DRAFT`/`REVIEW`, código `IN_PROGRESS` por sus decisiones/brechas abiertas y CI funcional `NOT_RUN`. La spec de programa registra el control completo localmente; ninguna declara nuevo merge, deploy, activación o evidencia de producción.
- **Gate de metadata:** `spec-validate.mjs --strict --base-ref <SHA>` exige SDD 2.0 en specs añadidas/modificadas/renombradas contra esa base. Los contratos históricos no tocados siguen compatibles. Base ausente/inválida falla cerrado; rutas Unicode no eluden el gate.
- **CI:** el paso `Validate SDD contracts and primary audit coverage` es bloqueante dentro de `quality-gates`. Usa la base del PR (o el SHA anterior de un push), la recupera explícitamente y ejecuta strict, cobertura y pruebas negativas. Se conserva el preflight operativo existente.

### Validación local

- `node --test tests/unit/spec-lib.test.mjs tests/unit/spec-validate.test.mjs tests/unit/audit-plan-spec-coverage.test.mjs`: 23/23.
- `node --experimental-strip-types --test tests/unit/client-presentation-remediation.test.ts`: 2/2.
- `node scripts/spec-validate.mjs --strict --base-ref 90c7537013bc87aeb37ffa2523fa01016eeef893`: 160 specs, 0 errores y 0 warnings.
- `node scripts/audit-plan-spec-coverage.mjs`: 161 rutas primarias, 0 faltantes, 0 extras y 0 errores.
- `node scripts/spec-index.mjs`: 160 specs; generación reproducible.
- `git diff --check`: sin errores.

Publicación bloqueada: la conexión GitHub devolvió 403 (Resource not accessible by integration) tanto al crear el árbol como al actualizar un archivo de la rama. No hubo cambios externos. Se entrega el commit como parche aplicable. El nuevo CI remoto todavía no se ha ejecutado.
Las suites completas, builds y E2E remotos deben comprobarse contra el SHA
publicado. No se fusiona, despliega ni decide producto desde este cambio.
Si #766 incorpora `3.47`, el gate de cobertura exigirá reconciliarlo.

### Investigación externa

1. Consulta: checkout de `pull_request` y SHA de base — [eventos de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
2. Consulta: `git diff --relative`, `--name-only`, `--diff-filter` — [documentación de Git](https://git-scm.com/docs/git-diff).
3. Consulta: shell y propagación de exit codes en pasos — [sintaxis de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

- Aplicado ahora: base explícita, diff relativo delimitado por NUL y pasos que propagan el fallo de los controles.
- Backlog: evidencia operativa de los contratos de dominio y decisiones ya enumeradas en las specs.
- Descartado: inferir CI funcional, deploy o activación a partir de validación documental.

## Reconciliación tras el merge de #766 — 2026-10-04

El PR #766 se mergeó mientras este PR estaba abierto: `main` pasó a tener el
hallazgo `3.47` en el plan y la fila `3.0`–`3.47` en la spec de programa. Al
rebasar sobre esa base, el gate de cobertura marcó `3.47` como faltante (la
fila de este PR decía `3.0`–`3.46`), que es justo el control funcionando.

- La fila de admin queda en `3.0`–`3.47`.
- Los contadores pasan a 162 IDs en total y 49 en la sección de admin.
- Cobertura medida con el script sobre el plan actual: 162 de 162, sin
  faltantes, sobrantes ni errores.
- El resto de la revisión de Codex (rutas de `2.49`, `1.17`, `1.19`, metadata
  SDD 2.0 y paso de CI) no cambia.