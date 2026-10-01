# C67 — EvidenceGateway: validación de bucketKey (2026-10-01)

**Hallazgo (nuevo):** `POST /v1/evidence/upload` (gateway) guardaba el `bucketKey` del body sin validar; la ruta canónica (`EvidenceRepository.create`) exige clave de storage con prefijo del tenant. Un actor con `evidence:write` podía registrar evidencia apuntando a la clave de OTRO tenant (y, con C19 en `off`, la URL pública servía ese archivo).

**Cambio:** `EvidenceGatewayService.uploadEvidence` aplica `normalizeEvidenceBucketKey` (ahora exportada del repositorio canónico) salvo `trustedSyntheticKey`, que solo rellena `browser-agent` (clave sintética; la captura va en `metadataJson`). El controller HTTP nunca lo propaga desde el body.

**Pruebas:** `evidence-gateway-scope.test.ts` +2 (clave de otro tenant/sin prefijo/traversal/otro dominio/`s3://` → 400 sin crear; sintética solo con flag). Suite API: 2567 pass, 0 fail.

**Cambio de contrato (a vigilar):** clientes que enviaban claves no tenant-scoped al gateway ahora reciben 400 (en producción tampoco se aceptan claves legacy). Es el mismo contrato que `POST /v1/evidence`.

**No hecho — convergencia completa:** el gateway sigue escribiendo `Evidence` por su propio repositorio (sin outbox `evidence.uploaded.v1`, sin audit, sin idempotencia, sin invalidación de contexto operacional). Delegar a `EvidenceService.register` cambia el contrato (la canónica descarta `metadataJson` arbitrario y exige `requestId`) y rompe a `browser-agent` (guarda base64 en `metadataJson`). Decisión pendiente: (a) ampliar el canónico con metadatos validados, o (b) retirar `POST /v1/evidence/upload` a favor de `POST /v1/evidence` + una ruta de validación. Estado: PARTIAL.
