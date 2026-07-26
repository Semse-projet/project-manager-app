# Admin 3.45 — Compliance fail-closed

Fecha: 2026-07-25
Plan: `3.45 ALTO`
Specs: `ui.admin-flows-remediation` v1.5,
`governance.audit-remediation-program` v1.3

## Resultado

- Jobs, disputas, membresías, reseñas y viajes conservan si la consulta estuvo
  disponible; un error ya no se convierte en una lista vacía “cumplida”.
- Cada control dependiente de una fuente caída queda `pending` y explica que no
  se asume cumplimiento.
- La pantalla muestra las fuentes incompletas y oculta la tasa general cuando
  no puede verificarse.
- La verificación de identidad consulta todas las organizaciones; una falla
  parcial impide declarar el control verde.
- Consentimiento y reporte fiscal se muestran como revisiones manuales, sin
  fechas ni integración regulatoria/fiscal inventadas.

## Validación focal

- [x] 5/5 pruebas de derivación y fail-closed.
- [x] TypeScript Web.
- [x] ESLint focal: 0 errores y 0 advertencias.
- [x] ESLint Web completo: 0 errores; 54 advertencias preexistentes.
- [x] Validación estricta de specs: 105 archivos, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 160/160 hallazgos, sin faltantes ni extras.

No se hizo push, deploy ni mutación de producción.
