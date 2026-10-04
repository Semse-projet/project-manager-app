# Worker Materials 2.24–2.25 — validación y estado visual

Fecha: 2026-07-25
Plan: `2.24 MEDIO`, `2.25 BAJO`
Spec primaria: `ui.pro-flows-remediation` v1.5

## Resultado

- La cantidad se convierte mediante una función única que solo acepta números
  finitos mayores que cero.
- La petición no sale si la cantidad está vacía, es cero, negativa o inválida.
- El campo declara `min="0.01"` y `step="any"`, marca `aria-invalid`, enlaza su
  explicación con `aria-describedby` y muestra el error inline.
- El botón de envío también queda deshabilitado si falta un trabajo válido.
- El estado `rejected` usa `StatusBadge` con variante `error`, no neutral.
- La carga inicial de trabajos usa una actualización funcional y mantiene
  estable el callback, evitando una segunda carga causada por el primer
  `formJobId`.

La validación positiva del backend se conserva como frontera autoritativa; este
lote mejora la prevención y el feedback en cliente sin relajar el API.

## Validación

- [x] 2/2 pruebas unitarias focales.
- [x] TypeScript web.
- [x] ESLint focal: 0 errores y 0 advertencias.
- [x] Spec y plan alineados con 2.24/2.25.

No se hizo deploy ni consulta a producción.
