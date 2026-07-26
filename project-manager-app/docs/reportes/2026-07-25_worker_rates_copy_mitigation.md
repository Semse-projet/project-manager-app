# Worker 2.40 — mitigación de promesas de tarifas

Fecha: 2026-07-25
Plan: `2.40 CRÍTICO / DECISION_REQUIRED`
Specs: `ui.audit-product-decisions` v1.1,
`ui.pro-flows-remediation` v1.10

## Resultado

- `/worker/rates` conserva el guardado y borrado de una referencia de perfil.
- El encabezado y la confirmación explican que esos valores hoy no modifican
  estimados ni cotizaciones.
- Se retiraron los estados “Activas”, “Multiplicador aplicado” y “Factor
  aplicado”, que comunicaban una integración inexistente.
- El borrado ya no promete cambiar el motor a BLS; elimina la referencia
  personalizada.
- No se conectó la tarifa a ProTools, pricing, matching ni otro estimador.

La feature final permanece en `DECISION_REQUIRED` hasta definir qué cálculos
deben consumir la tarifa y cómo se selecciona al profesional correspondiente.

## Validación focal

- [x] 3/3 pruebas focales de copy y frontera de producto.
- [x] TypeScript Web.
- [x] ESLint focal: 0 errores y 0 advertencias.
- [x] ESLint Web completo: 0 errores; 54 advertencias preexistentes.
- [x] Validación estricta de specs: 105 archivos, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 159/159 hallazgos, sin faltantes ni extras.

No se hizo push, deploy ni mutación de producción.
