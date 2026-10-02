# C67 — EvidenceGateway como adaptador del canónico (2026-10-01)

Opción (a) acordada: ampliar el canónico con un contrato validado de `metadataJson` y convertir el gateway en adaptador.

## Cambios
- `evidence/evidence-metadata.ts` (`parseEvidenceMetadata`): objeto JSON, ≤ 64 KB, profundidad ≤ 6, sin claves de prototipo y **sin claves reservadas** (`jobId`, `filename`, `category`, `description`: las fija el canónico, así un cliente no puede forjar el contexto). Se aplica en `EvidenceRepository.create` (único punto) y `EvidenceService.register` acepta `metadata`.
- `EvidenceGatewayService.uploadEvidence` ya **no escribe** `Evidence`: valida acceso/milestone y delega en `EvidenceService.register` (clave tenant-scoped, idempotencia por `requestId`, outbox `evidence.uploaded.v1`, audit, invalidación de contexto operacional). Se mantiene la validación temprana de la clave y el SSE/validación asíncrona del gateway. Se elimina `EvidenceGatewayRepository.createEvidence` (segundo camino de escritura) y el flag `trustedSyntheticKey` de #717.
- `browser-agent`: la evidencia apunta ahora a un **archivo real** tenant-scoped (PNG de la captura, o el informe JSON si no hubo captura) en vez de una clave sintética con el base64 dentro de `metadataJson`. La captura sigue en la salida de la inspección (`run.output`, que es lo que consume la UI admin); nadie leía el base64 desde la evidencia.
- DI: `EvidenceGatewayModule` importa `EvidenceModule`; `BrowserAgentModule` importa `StorageModule`.

## Cambios de contrato (a vigilar)
- `POST /v1/evidence/upload`: ahora cada llamada pasa por el registro canónico (idempotente por request-id, emite el evento outbox); `metadataJson` con claves reservadas, > 64 KB o no-objeto → 400.
- Evidencias nuevas de browser-agent: `bucketKey` es una clave de storage real; sin `screenshotBase64` en metadatos.

## Verificación
- `tsc` limpio; suite API **2610 pass / 0 fail** (+7 `evidence-metadata`, gateway-scope actualizado: delegación con requestId/clave/metadata, requestId generado distinto por llamada, clave sintética rechazada).
- **El `AppModule` real arranca** contra Postgres 16 local (esquema migrado) sin errores de DI; `EvidenceGatewayService` recibe `EvidenceService` y `BrowserAgentService` recibe `StorageService`.
- No probado: registro canónico de evidencia extremo a extremo contra DB con fixtures de proyecto/milestone (lo cubre el CI de integración si existe) ni smoke en producción.
- `evidence-gateway.service.spec.ts` (jest) no se actualizó: no parsea en el repo y está fuera de CI (ya anotado en #702).

## Pendiente
Deprecar `POST /v1/evidence/upload` (cabecera `Deprecation`/`Sunset`, migrar clientes a `POST /v1/evidence` + ruta de validación) y retirar `trustedSyntheticKey` ya está hecho. C67 sigue PARTIAL hasta ese paso y el smoke.
