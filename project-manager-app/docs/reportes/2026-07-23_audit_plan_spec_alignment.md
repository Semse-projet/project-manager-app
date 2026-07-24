# Alineación integral de specs del plan de remediación

**Fecha:** 2026-07-23

**Rama:** `fix/audit-money-security-batch-v2`

**Alcance:** `docs/AUDIT_REMEDIATION_PLAN.md` completo

## Resultado

Los 157 ítems del plan quedaron enrutados a una spec primaria y a un estado SDD
inequívoco:

| Sección | Ítems | Mapeados |
|---|---:|---:|
| 0 — transversal | 36 | 36 |
| 1 — Cliente | 23 | 23 |
| 2 — PRO/Worker | 53 | 53 |
| 3 — Admin | 45 | 45 |
| **Total** | **157** | **157** |

El mapa canónico es
`docs/specs/governance/audit-remediation-program.spec.md`. El comando
`pnpm spec:audit-plan-coverage` falla si aparece un ID del plan sin routing o
un ID inexistente en el mapa.

## Specs creadas

- `api.auth-account-session-remediation` — `APPROVED`.
- `api.vision-service-security` — `APPROVED`.
- `api.travel-assignments-settlement` — `APPROVED`.
- `labor.engine-remediation` — `APPROVED`.
- `api.worker-verification-remediation` — `REVIEW`.
- `api.payout-method-tokenization` — `REVIEW`.
- `ui.design-system-remediation` — `REVIEW`.
- `ui.audit-product-decisions` — `DRAFT`.
- `governance.audit-remediation-program` — `APPROVED`.

## Specs corregidas

### Cliente

`ui.client-flows-remediation` pasa de `DRAFT` a `APPROVED` solo para los fixes
correctivos ejecutables. Se excluyen explícitamente:

- persona/rol Cliente, trust visible y marca;
- consolidación del sistema de diseño.

Esos puntos conservan specs `DRAFT`/`REVIEW` separadas.

### PRO/Worker

`ui.pro-flows-remediation` pasa de `DRAFT` a `APPROVED` para ejecución por
lotes. No autoriza:

- decisión sobre el tracker legacy;
- verificación de identidad;
- semántica de tarifas del profesional;
- elección del riel/tokenización de cobro.

### Admin

`ui.admin-flows-remediation` ya figuraba `APPROVED`, pero su texto decía que no
debía aprobarse sin navegación en vivo. Se corrigió la contradicción:

- análisis estático y contratos permiten fixes acotados;
- la credencial OPS_ADMIN y navegación real son gate para `VERIFIED`;
- seguridad/dinero siguen requiriendo además la spec API del dominio.

## Gobernanza aplicada

- `EXECUTABLE`: spec `APPROVED`, `IMPLEMENTED` o `VERIFIED`.
- `REVIEW_REQUIRED`: contrato existente con decisiones explícitas pendientes.
- `DECISION_REQUIRED`: comportamiento de producto aún no elegido.
- El checkbox `[x]` del plan no cambia automáticamente el estado de una spec.
- Un `APPROVED` amplio no autoriza los ítems excluidos y enlazados a
  `DRAFT`/`REVIEW`.

## Validación

- `pnpm spec:audit-plan-coverage`: **157 mapeados, 0 faltantes, 0 extras**.
- `node scripts/spec-validate.mjs --strict`: **103 specs, 0 errores, 0 warnings**.
- `node scripts/spec-index.mjs`: índice regenerado con **103 specs**.
- `node scripts/spec-coverage.mjs`: ejecuta correctamente.
- `git diff --check`: sin errores.

## Deuda SDD visible, no ocultada

El reporte global actual indica:

- 90/103 specs enlazan tests (87%).
- 43/103 están `VERIFIED` (42%).
- 41 specs high/critical todavía no están `VERIFIED`.
- Las specs nuevas se dejaron en el estado honesto según su evidencia; no se
  promovieron a `VERIFIED` solo por existir.

Esta deuda incluye programas futuros y specs fuera del plan de remediación. No
impide el routing 157/157, pero sí sigue siendo trabajo de verificación.

## Rollback

No se modificó lógica de negocio ni datos. Revertir este lote elimina el routing
y vuelve a mezclar decisiones de producto con fixes ejecutables; cualquier
rollback debería reemplazarlo por otro mapa completo.
