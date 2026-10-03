# Labor Engine 2.10 — frontera de tarifa y moneda

Fecha: 2026-07-25
Plan: `2.10 ALTO`
Spec primaria: `labor.engine-remediation` v1.1

## Resultado

El payload de una entrada manual ya no puede decidir el costo que ve un
supervisor:

- el controller no extrae `hourlyRate` ni `currency`;
- el service persiste la entrada sin tarifa controlada por el cliente;
- payloads legacy siguen sincronizando, pero esos campos se ignoran;
- el formulario manual retiró ambos controles y explica la fuente del KPI;
- `getTeamSummary()` no consulta tarifas históricas sin procedencia;
- el costo de equipo usa el baseline nacional BLS en USD y conserva overtime
  semanal 1.5x;
- la vista admin nunca usa el override del administrador como tarifa de todo el
  equipo;
- el endpoint dedicado de overrides rechaza tarifas no finitas o fuera de
  USD 10..250 y markup fuera de 0..1.

## Decisión conservadora

No se usó `ContractorRateOverride` para calcular el costo de cada worker.
Hacerlo definiría parcialmente el producto pendiente `2.40` y no resolvería la
procedencia de filas históricas. Hasta que exista una decisión y snapshot
trazable por entrada, BLS USD es la única fuente autorizada del KPI.

## Compatibilidad

Los eventos offline antiguos pueden contener `hourlyRate`/`currency`. El API
no los rechaza para evitar atascar la cola; simplemente no los propaga. Los
tipos legacy permanecen temporalmente para poder leer y drenar esos eventos.

## Validación

- [x] Build API.
- [x] 36 tests focalizados de controller/service/repository/policy y frontera.
- [x] Test estático de frontera API/UI.
- [x] Typecheck web; lint API/web con 0 errores (54 warnings preexistentes).
- [x] Specs estrictas: 105 specs, 0 errores, 0 warnings.
- [x] Cobertura del plan: 159/159, sin faltantes ni extras.

## Riesgo residual

- No se consultó producción. Conviene auditar la distribución histórica de
  `TimeEntry.hourlyRate`/`currency`, aunque ya no alimenta el KPI nuevo.
- `2.40` sigue abierto: la promesa general de `/worker/rates` requiere una
  decisión de producto separada.
- No se añadió conversión FX ni se mezclan fuentes de moneda.
