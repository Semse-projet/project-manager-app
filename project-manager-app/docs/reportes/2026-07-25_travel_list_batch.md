# Lista batch de viajes — 2026-07-25

## Resultado

- `GET /v1/travel` devuelve cada asignación con `totalSpent`,
  `expectedBalance`, contadores de gastos/hospedajes/anticipos y estado de
  comprobantes.
- La API usa una consulta de assignments y tres consultas batch por el conjunto
  de `travelId`; el número de consultas no crece por viaje.
- Las listas Worker y Admin consumen el resumen y eliminan las tres peticiones
  por fila.
- La lectura de la lista ya no llama `computeSettlement`, por lo que tampoco
  hace upserts de settlements como efecto colateral.
- Inicializar el job predeterminado del formulario Worker ya no vuelve a
  disparar el efecto de carga.

## Validación

- [x] Build API y TypeScript web.
- [x] Lint API/web: 0 errores; web conserva 54 advertencias preexistentes.
- [x] 18/18 pruebas focales.
- [x] Índice regenerado; validación estricta: 105 specs, 0 errores, 0 advertencias.
- [x] Cobertura integral del plan: 159/159 ítems mapeados.

No se hizo deploy ni consulta a producción.
