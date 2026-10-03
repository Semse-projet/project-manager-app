# Frontera de job al crear viajes — 2026-07-25

## Resultado

`POST /v1/travel` ya no crea una asignación a partir de un `jobId` confiado:

- resuelve un job no eliminado por `id + tenantId`;
- permite CLIENT únicamente si su org es dueña del job;
- permite PRO/WORKER únicamente si su org es la asignada al proyecto;
- permite OPS_ADMIN únicamente después de confirmar que el job existe en su
  tenant;
- repite la frontera en `updateMany` y rechaza `count !== 1` antes de insertar
  la asignación;
- ejecuta lectura, compare-and-set y creación en una sola transacción;
- falla cerrado si no hay persistencia para comprobar ownership.

## Validación

- [x] Build de API.
- [x] Lint de API.
- [x] 14/14 pruebas focales de controller y service.
- [x] Índice regenerado; validación estricta: 105 specs, 0 errores, 0 advertencias.
- [x] Cobertura integral del plan: 159/159 ítems mapeados.

No se hizo deploy ni consulta a producción.
