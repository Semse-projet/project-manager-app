# T-008 — Ventana de freeze en producción

Proyecto Railway: **SEMSEproject**. Servicios: **semse-API** (una réplica) y **semse-worker**. Los originales de evidencia están en el volumen de semse-API montado en `/data` (5 GB), referenciados por `SEMSE_STORAGE_ROOT` y `SEMSE_MULTIPART_STORAGE_ROOT`. No hay buckets.

Este runbook no autoriza por sí solo la ventana. Hace falta una aprobación humana explícita para cambiar variables de semse-API y para copiar originales. Railway despliega cada push a `main` sin esperar al CI: no fusionar el PR que introduce este slice hasta que el CI del SHA esté verde, y no poner `mutate` en el mismo momento del merge.

## Qué queda igual si no se toca nada

Si `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE` no existe, está vacía, vale `off`, `observe` o `provision`, el control plane sigue el canary OPEN-only de `docs/runbooks/FIELD_MEMORY_T008_PRODUCTION_OPEN_CANARY.md`. Drain, freeze, thaw, coverage, window-closed y recovery responden 503. El runtime en `off` no consulta el gate.

## Opt-in

Las dos variables son independientes y las dos hacen falta para mutar:

| Variable | Valor para la ventana | Efecto |
|---|---|---|
| `SEMSE_STORAGE_WRITE_GATE_MODE` | `production` | semse-API aplica el gate a escrituras de originales, multipart y registro de Evidence. `off` vuelve al comportamiento anterior. |
| `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE` | `mutate` | habilita el control plane de drain/freeze/thaw. Sin este valor, `mutate` sigue denegado aunque el runtime esté en `production`. |

Además, el llamador tiene que ser `OPS_ADMIN` y tener el permiso `ops:storage-write-gate:production-mutate` (solo ese rol lo recibe). Cada mutación exige `ticket`, `reason` (3–1000 caracteres) e `idempotencyKey`. El recibo es la respuesta HTTP (`phase`, `epoch`) y la fila de `StorageWriteGateAudit`.

`observe` y `provision` siguen pidiendo solo `ops:storage-write-gate:manage`.

## Orden

No saltar pasos. Endpoints bajo `POST/GET /v1/internal/storage-write-gate/…`, autenticados. No imprimir paths, hashes de originales ni manifiestos en issues, PRs o logs compartidos.

1. Confirmar en SEMSEproject que semse-API está sano, que el SHA desplegado es el que pasó CI, y que el volumen `/data` sigue montado solo en semse-API. semse-worker es otro servicio: no monta `/data` y no llama a `StorageService`. Sus escrituras de runtime de desarrollo están confinadas al repo; si una ruta resuelta cae en `/data`, `SEMSE_STORAGE_ROOT` o `SEMSE_MULTIPART_STORAGE_ROOT`, el worker la rechaza con `worker_evidence_volume_write_refused` (reintentable). Un proceso SSH o un cron no inventariado sigue siendo un hueco: no declarar quiescencia solo con este código.
2. Con el runtime todavía en `off` y el control en `provision`, un OPS_ADMIN llama a `provision` (ticket, reason, idempotencyKey). Confirmar `status`: una fila `OPEN`, cero operaciones `ACTIVE`. Detalle del canary: `FIELD_MEMORY_T008_PRODUCTION_OPEN_CANARY.md`.
3. Pasar el control a `observe`.
4. Poner `SEMSE_STORAGE_WRITE_GATE_MODE=production` y redesplegar semse-API. Comprobar `/v1/health` y que un write sintético entra y sale de `ACTIVE`.
5. Solo dentro de la ventana aprobada, poner `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE=mutate` y redesplegar.
6. `status`. Anotar `epoch`.
7. `transition` `BEGIN_DRAIN` con ese `expectedEpoch`. Las admisiones nuevas fallan. Una operación ya admitida puede terminar.
8. Esperar `activeOperations` vacío. Un ticket `ACTIVE` de un proceso muerto no caduca por reloj. Recuperarlo solo con `operations/:id/recover` y un `terminationEvidenceDigest` que pruebe que ese writer ya no puede publicar.
9. `coverage` con el `coverageDigest` (SHA-256 de la nota privada del censo de writers, no de las fotos).
10. `transition` `MARK_FROZEN` con `freezeTtlSeconds` entre 300 y 14400. Sin TTL en producción la llamada se rechaza (`freeze_ttl_required`).
11. Inventario de antes (abajo), con el gate en `FROZEN`.
12. Copia de solo lectura hacia un volumen o servicio de prueba aislado. Inventario de después sobre el origen y sobre la copia. Comparar.
13. `window-closed` con el digest de la evidencia de cierre de esa ventana (nota privada).
14. `transition` `THAW` con el epoch vigente. La respuesta debe ser `OPEN` y el epoch incrementado en 1. `freezeExpiresAt` queda vacío.
15. Repetir `THAW` con la misma `idempotencyKey` (mismo resultado) o con una clave nueva y el epoch ya abierto (recibo, el epoch no vuelve a subir).
16. Devolver el control a `observe` o quitar la variable.

## Freeze, TTL y error de escritura

`freezeExpiresAt` es un plazo, no un interruptor. Si vence y nadie ha hecho thaw, `status` marca `freezeExpired: true` y `explicitThawRequired: true`, y la fase sigue `FROZEN`. Las escrituras nuevas siguen bloqueadas.

Mientras el runtime está en `production`, un upload, una parte multipart, un complete, un delete de original o un registro de Evidence que no puede admitirse responde **503** con `Retry-After: 5` y un mensaje que dice que el gate está draining o frozen y que las lecturas no se tocan. El cliente puede reintentar. Un gate no aprovisionado o una base inalcanzable también falla cerrado (503); no hay un OPEN implícito.

`readBuffer`, `stat` y el GET de uploads no consultan el gate.

## Thaw idempotente

Secuencia obligatoria desde `FROZEN`: `window-closed` y después `THAW`. Sin la atestación, thaw responde `recovery_window_not_closed`.

- La misma `idempotencyKey` devuelve el recibo ya guardado y no aplica la transición dos veces.
- Si la fase ya es `OPEN` y `expectedEpoch` es el epoch actual, `THAW` escribe otro recibo de auditoría y no cambia fase ni epoch.
- Un reinicio, un timeout, un deploy o el vencimiento del TTL no abren el gate.

## Inventarios SHA-256

Reutilizan `scripts/field-memory-source-inventory.mjs` y `scripts/field-memory-compare-inventories.mjs`. El wrapper `scripts/field-memory-storage-inventory.mjs` no escribe en el origen. El stdout contiene rutas relativas: redirigirlo a un disco privado. No commitear manifiestos.

Dentro de semse-API, con el volumen real (la raíz tiene que vivir bajo `/data`):

```bash
node scripts/field-memory-storage-inventory.mjs inventory \
  --reference window-YYYYMMDD > /secure/before.json
```

Sobre la copia aislada, fuera de producción:

```bash
node scripts/field-memory-storage-inventory.mjs inventory \
  --reference window-YYYYMMDD \
  --root /ruta/de/la/copia \
  --isolated-root > /secure/after.json
node scripts/field-memory-storage-inventory.mjs compare \
  --before /secure/before.json \
  --after /secure/after.json
```

`PASS` exige el mismo `backupReference`, los mismos paths, tamaños y SHA-256, y cero added/removed/changed. El directorio `multipart` se excluye. Esto no certifica por sí solo la consistencia Evidence/Postgres.

El preflight de montaje, que no hashea bytes, sigue siendo `scripts/field-memory-storage-preflight.mjs` y `docs/runbooks/FIELD_MEMORY_STORAGE_PREFLIGHT.md`.

## Restore aislado

No pulsar **Restore** en el volumen de semse-API en SEMSEproject. Railway reengancha ese volumen al mismo servicio. No hacer wipe: la documentación de Railway avisa que el wipe se lleva también los backups del volumen.

1. Destino nuevo: otro servicio o un directorio de una máquina que no tenga `DATABASE_URL`, colas, pagos ni correo de producción, y que no monte el volumen de semse-API.
2. Copiar los originales en solo lectura hacia ese destino. No borrar ni reescribir `/data` en semse-API.
3. Inventariar la copia con `--isolated-root` y comparar con el manifiesto tomado en `FROZEN`.
4. Si el drill es el fixture sintético, `scripts/field-memory-originals-restore-drill.mjs` acredita el algoritmo (`syntheticRestoreDrill`), no un backup real de Railway.
5. Un `PASS` de hashes no es un snapshot nativo restaurado ni CAP-1.

## Rollback

1. Poner `SEMSE_STORAGE_WRITE_GATE_MODE=off` en semse-API y redesplegar. Las escrituras dejan de consultar el gate de inmediato, aunque la fila siga en `FROZEN`.
2. Quitar `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE` o dejarla en `observe`.
3. No borrar la fila ni la auditoría.
4. Antes de volver a `MODE=production`, hacer `THAW` (con el control en `mutate`) o confirmar por `status` que la fase es `OPEN` y que no hay `ACTIVE`. Si se enciende el runtime con la fila en `FROZEN`, las escrituras vuelven a quedar fail-closed.
5. Comprobar `/v1/health` y un write sintético.

## Fuera de alcance

Este runbook no exporta originales, no abre CaptureSession, no marca T-008 como VERIFIED y no sustituye la reconciliación Evidence/Postgres.
