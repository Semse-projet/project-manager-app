# Worker 2.28 — mitigación de verificación engañosa

Fecha: 2026-07-25
Plan: `2.28 CRÍTICO / REVIEW_REQUIRED`
Specs: `api.worker-verification-remediation` v1.1,
`ui.pro-flows-remediation` v1.9

## Resultado

- `/worker/profile` dejó de llamar `POST /v1/users/:userId/verify`.
- Se retiraron botones y estados que simulaban una solicitud para luego fallar
  con 403.
- Identidad, antecedentes y teléfono aparecen como próximos pasos no
  disponibles.
- El copy explica que faltan cola, evidencia y proveedor aprobados y
  desaconseja enviar documentos por canales alternos.
- El endpoint administrativo conserva permiso `users:verify` y policy
  OPS_ADMIN; no se amplió acceso ni se generó un estado `VERIFIED`.

La feature final permanece en `REVIEW` hasta decidir proveedor KYC/DID,
evidencia, retención y ceremonia administrativa.

## Validación focal

- [x] 3/3 pruebas de UI y frontera administrativa.
- [x] TypeScript Web.
- [x] ESLint focal: 0 errores y 0 advertencias.
- [x] ESLint Web completo: 0 errores; 54 advertencias preexistentes.
- [x] Validación estricta de specs: 105 archivos, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 159/159 hallazgos, sin faltantes ni extras.

No se hizo push, deploy ni mutación de producción.
