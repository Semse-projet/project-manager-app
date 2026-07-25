# Consistencias de Travel y Field Ops — 2026-07-25

## Resultado

- El tab Tracker de `/worker/field-ops` usa la familia canónica
  `/api/semse/time-tracker/sessions/**` para start, pause, resume y stop.
- Los aliases BFF legacy `/api/semse/tracker/**` permanecen disponibles para
  compatibilidad, pero ya no se mezclan dentro del mismo flujo.
- Lista y detalle de Travel, tanto Worker como Admin, muestran “falta hospedaje
  requerido” cuando corresponde; se eliminó la frase ambigua “sin hospedaje
  requerido”.

## Validación

- [x] 5/5 pruebas focales de lista y consistencia.
- [x] TypeScript web.
- [x] Lint web: 0 errores; 54 advertencias preexistentes.
- [x] Índice regenerado; validación estricta: 105 specs, 0 errores, 0 advertencias.
- [x] Cobertura integral del plan: 159/159 ítems mapeados.

No se hizo deploy ni consulta a producción.
