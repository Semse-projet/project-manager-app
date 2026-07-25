# Worker 2.1c/2.1d — transparencia de payout y trust

Fecha: 2026-07-25
Plan: `2.1c ALTO`, `2.1d MEDIO`
Specs: `ui.pro-flows-remediation` v1.6, `api-payments-escrow` v1.1

## Resultado

- Stripe Connect muestra estado de carga, habilitado o bloqueado.
- Sin cuenta activa, la UI dice explícitamente que el payout automático queda
  bloqueado y que SEMSE no lo redirige a una cuenta compartida.
- El aviso de fondos en escrow usa la misma frontera.
- Un fallo al consultar Connect ya no se interpreta silenciosamente como una
  cuenta confirmada.
- `trustScore === 0` se presenta como “Trust en construcción”, no “Trust 0%”.
- El copy de cold-start coincide con el prior neutral `0.5` aplicado por
  matching solo cuando no hay trabajos completados y el score almacenado es 0.
- Scores reales mayores que cero siguen mostrándose como porcentaje.

## Validación

- [x] 5/5 pruebas focales de UI y fronteras backend.
- [x] TypeScript web.
- [x] ESLint focal: 0 errores y 0 advertencias.
- [x] ESLint web completo: 0 errores; 54 advertencias preexistentes.
- [x] Validación estricta de specs: 105 archivos, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 159/159 hallazgos, sin faltantes ni extras.
- [x] Plan y specs UI/API alineados con 0.16, 0.28, 2.1c y 2.1d.

No se hizo deploy ni consulta a producción.
