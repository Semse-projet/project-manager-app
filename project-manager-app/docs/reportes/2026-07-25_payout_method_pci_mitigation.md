# Worker 2.44 — mitigación inmediata de captura PCI

Fecha: 2026-07-25
Plan: `2.44 ALTO / REVIEW_REQUIRED`
Specs: `api.payout-method-tokenization` v1.1, `api-payments-escrow` v1.2,
`ui.pro-flows-remediation` v1.8

## Resultado

- Se retiraron los inputs propios de PAN, tarjeta, cuenta bancaria y routing.
- Banco y tarjeta legacy quedan solo lectura con instrucción de migración.
- Stripe Connect es el único CTA de payout automático.
- PayPal, Zelle y Cash App conservan solo identificadores no sensibles y copy
  explícito de riel manual.
- El BFF reenvía únicamente una allowlist `{type,email}`.
- La API usa schema estricto y rechaza tipos bancarios/tarjeta o campos extra.
- El servicio y el audit ya no reciben ni procesan credenciales financieras.

La elección del riel tokenizado definitivo permanece abierta; esta mitigación no
selecciona Stripe Elements, Financial Connections, Plaid ni otro proveedor.

## Validación focal

- [x] 4/4 pruebas de frontera Web/BFF/API.
- [x] 34/34 pruebas de pagos y controller.
- [x] TypeScript Web y API.
- [x] ESLint focal Web/API: 0 errores y 0 advertencias.
- [x] ESLint API completo: 0 errores y 0 advertencias.
- [x] ESLint Web completo: 0 errores; 54 advertencias preexistentes.
- [x] Validación estricta de specs: 105 archivos, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 159/159 hallazgos, sin faltantes ni extras.

No se hizo push, deploy ni mutación de producción.
