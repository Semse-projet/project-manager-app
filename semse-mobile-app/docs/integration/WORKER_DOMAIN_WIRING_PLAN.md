# Worker Domain Wiring Plan

## Orden de integracion

1. `jobs`
2. `evidence`
3. `travel`
4. `tasks`
5. `payments`
6. `incidents`
7. `field-ops`

## Regla de cableado

Cada pantalla worker debe consumir:

1. `types` de dominio
2. `repository` con estrategia `mock | bff | api-direct`
3. `hook` de lectura
4. `telemetry` minima por carga

## Primer lote

- `Dashboard.tsx`
- `Trabajos.tsx`
- `Evidencias.tsx`
- `Viajes.tsx`

## Resultado esperado

El usuario final sigue viendo la misma experiencia visual, pero la app deja de depender del dataset acoplado a UI y empieza a responder a una capa estable de dominio.
