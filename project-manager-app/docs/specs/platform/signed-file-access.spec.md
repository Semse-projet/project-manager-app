---
id: "platform.signed-file-access"
title: "Acceso firmado y con alcance a archivos subidos (evidencia)"
domain: "platform"
sdd_version: "2.0"
version: "0.3"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["UPLOADS_SIGNED_GET_MODE"]
production_evidence: []
related_files:
  - apps/api/src/infrastructure/storage/uploads.controller.ts
  - apps/api/src/infrastructure/storage/storage.service.ts
  - apps/api/src/infrastructure/storage/storage-key.ts
  - apps/api/src/modules/vision/vision.service.ts
  - apps/api/src/modules/evidence-gateway/evidence-gateway.service.ts
  - apps/web/app/api/semse/uploads/files/[...key]/route.ts
related_tests:
  - apps/api/test/signed-file-access.test.ts
  - apps/api/test/uploads.controller.test.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-30"
---

# Spec: Acceso firmado y con alcance a archivos subidos (C19 · C10)

> **Aprobado por el dueño en sesión (2026-09-30, "Acepto los propuestos") con los valores de §9 abajo.** Riesgo `high`: toca lectura de evidencia y a los consumidores browser + vision-service. Se entrega con `UPLOADS_SIGNED_GET_MODE=off` por defecto; pasar a `shadow` y luego `enforce` es una activación aparte.

## 1. Problema y resultado
**Para quién:** clientes, profesionales y ops que suben/consultan evidencia; vision-service que la analiza.

**Problema (verificado en `main`):**
- `GET /v1/uploads/files/*` es `@Public()`; su protección es solo que la clave `tenants/{tenantId}/{scope}{domain}/{nonce}{ext}` es difícil de adivinar (`storage-key.ts`).
- Las URLs `StorageService.publicUrl(key)` se emiten a muchos sitios (evidence-gateway, vision, contributor-program previewUrl) y se propagan en respuestas y eventos; cualquiera que obtenga una URL (logs, SSE, capturas, terceros) lee el archivo para siempre, sin tenant ni expiración.
- La web no tiene proxy GET (solo PUT); los navegadores usan la URL directa de la API, y el vision-service la consume sin sesión.
- `Cache-Control: private, max-age=3600` no equivale a control de acceso.

**Resultado esperado:** toda lectura de un archivo exige (a) una URL firmada y con expiración emitida por el backend tras verificar tenant+org+recurso, o (b) una sesión válida cuyo tenant coincida con el de la clave; las URLs viejas dejan de funcionar de forma controlada (modo shadow → enforce).

## 2. Alcance
**Incluido:** firma HMAC con expiración de `publicUrl()`; validación en `GET files/*`; chequeo de tenant contra el prefijo de la clave para lecturas autenticadas; modo `UPLOADS_SIGNED_GET_MODE=off|shadow|enforce`; métricas de lecturas sin firma; rotación de secreto.
**Fuera de alcance:** cambiar el formato de claves existentes; migrar a S3/R2 (C72, spec aparte) — pero el diseño debe ser compatible con URLs presignadas de S3/R2; antivirus/DLP de archivos.

## 3. Actores, permisos y límites
- Emisor de URLs: el backend, al servir un recurso ya autorizado (evidencia legible por el actor según `evidence.policy`).
- Consumidores: navegadores (vía URL firmada), vision-service (URL firmada de corta vida o credencial de servicio), usuarios autenticados por cookie/bearer.
- Regla: una clave `tenants/T/...` solo puede leerse con sesión cuyo `tenantId === T` (u OPS_ADMIN), o con firma válida.

## 4. Escenarios y criterios de aceptación
1. URL firmada válida → 200; expirada o con firma alterada → 403 (nunca 404 distinto que revele existencia).
2. Sin firma y sin sesión → 401/403 en `enforce`; en `shadow` se sirve pero se registra `uploads_unsigned_read` (con tenant de la clave y origen).
3. Sesión de otro tenant sobre una clave ajena → 403.
4. El vision-service sigue analizando evidencia sin cambios visibles (URL firmada generada al momento de la llamada).
5. `off` = comportamiento actual (rollback inmediato por variable).
6. La firma no es reutilizable para otra clave ni para escritura.

## 5. Contratos
- `publicUrl(key, { ttlSeconds })` → `…/v1/uploads/files/{key}?exp={unix}&sig={hmac}`; `sig = HMAC-SHA256(secret, "GET\n{key}\n{exp}")`, comparación en tiempo constante.
- `GET files/*` valida `exp`/`sig` o sesión; respuesta sin cambios de formato.
- Secreto: `UPLOADS_SIGNING_SECRET` (≥16 caracteres, distinto de `AUTH_SECRET`); `UPLOADS_SIGNING_SECRET_PREVIOUS` acepta firmas del secreto anterior durante la rotación (rotar: mover el actual a `_PREVIOUS`, poner uno nuevo, retirar `_PREVIOUS` tras el TTL máximo).
- Reglas implementadas (`signed-url.ts`): firma mala/expirada → 403 siempre (también en shadow); sesión de otro tenant → 403 (también en shadow); clave legacy sin tenant solo por firma u OPS_ADMIN; la autorización se decide antes de tocar el storage (403 idéntico exista o no la clave).

## 6. FSM, eventos y reconstrucción
Sin cambios de FSM. Observabilidad: contador `uploads_reads{mode,signed,authenticated,result}` y log estructurado `uploads_unsigned_read` (sin PII; solo tenant de la clave y `Referer` host).

## 7. Datos y migración
Sin migración de datos ni de esquema. Las URLs ya emitidas (guardadas en respuestas/clientes) dejan de valer solo al pasar a `enforce`; un recálculo bajo demanda es posible porque se derivan de la clave.

## 8. Observabilidad, despliegue y activación
Rollout: `off` → `shadow` (≥ 7 días, revisar lecturas sin firma por origen) → `enforce` por entorno. Canary con tenant interno. Activación solo con evidencia de que browser y vision-service no dependen de URLs sin firma.

## 9. Decisiones (resueltas — valores propuestos aceptados por el dueño)
1. **TTL**: 15 min navegador (`UPLOADS_SIGNED_URL_TTL_SECONDS`), 5 min vision (`UPLOADS_SIGNED_URL_TTL_VISION_SECONDS`); máximo 1 h.
2. **Clientes que guardan URLs**: se recalcula la URL en cada lectura de la entidad; las persistidas dejan de valer en `enforce`.
3. **Vision-service**: firma corta generada por llamada (`publicUrl(key,{ttl:"vision"})`).
4. **Mobile/offline**: no cachea URLs persistentes (se recalculan); a verificar en shadow con los logs `uploads_unsigned_read`.
5. **Contributor `previewUrl`**: queda fuera de la regla de exigir sesión; se emite igualmente firmada (compatible con `enforce`).
6. **Activos públicos**: prefijo explícito `UPLOADS_PUBLIC_KEY_PREFIXES` (por defecto `public/`).

## 10. Tests requeridos
Firma válida/expirada/alterada/otra clave; comparación en tiempo constante; sesión de otro tenant; modos off/shadow/enforce; vision-service con URL firmada; compatibilidad con rotación de secreto; no-regresión de subida (PUT) y del proxy BFF.

## 11. Mapa de implementación
API: `storage.service.ts` (`publicUrl` firmado), `uploads.controller.ts` (validación), `storage-key.ts` (extraer tenant de la clave). Consumidores: `vision.service.ts`, `evidence-gateway.service.ts`. Web: revisar componentes que usan la URL directa. Tests en `apps/api/test/`.

## 12. Gates de cierre
Spec `APPROVED` · preguntas §9 resueltas · tests · CI terminal · merge SHA · deploy · shadow sin lecturas sin firma inesperadas · smoke autenticado multi-tenant · evidencia registrada.

## 13. Aprobación de seguridad de subida — tenant scope y originales write-once (2026-10-11)

**Scope de este complemento:** el contrato SDD APPROVED de acceso por recurso se extiende a la **escritura**, sin alterar por esta sola modificación los estados del flag de lectura. ADR: `docs/architecture/ADR-043-write-once-storage-originals.md`. Se implementa en PR #870, no se marca verificado por escribir estas reglas.

**PUT /v1/uploads/files/* (autorización y contrato):**
- Requiere `evidence:write` y actor autenticado, y clave normalizada bajo `tenants/<actor.tenantId>/...`.
- Una clave de tenant distinto, una clave legacy sin prefijo tenant o `public/...` → **403** antes de abrir el stream/consultar existencia. Sin bypass ni siquiera para OPS_ADMIN en este endpoint de carga; herramientas administrativas de migración, si se necesitan, requieren operaciones separadas auditadas.
- Si la clave ya existe: **409 Upload key already exists** desde el driver de almacenamiento; jamás modificar los bytes existentes. El filesystem local implementa apertura atómica `wx` (O_EXCL); una prueba `stat` previa seguida de write no es suficiente.
- Error de contenido, límites, stream fallido o almacenamiento disponible → códigos existentes; borrar solamente una carga incompleta que este mismo intento creó, nunca la de otro actor.
- El dominio Evidence autoriza Org/Project/Job en el **registro**; el PUT tenant-scoped por sí solo no acredita pertenencia a un Project ni derecho de lectura. La capacidad de escritura por Org queda como tarea separada, junto al modelo de plan firmado e idempotencia. No publicar hasta permisos completos.

**Reintentos/clientes:** un 409 no equivale a éxito porque el cliente no puede comprobar hash/tamaño contra una clave ajena. El cliente debe pedir un plan nuevo con clave/nonce nuevo, volver a PUT, y registrar Evidence sólo después de 2xx del nuevo PUT. Flujo web Worker/Travel/Agro/Contributors que utiliza `/v1/uploads/plan` obtiene un key nuevo por cada intento; mobile debe solicitar nuevo presign al recuperarse de 409. La ruta multipart reintentada después de fallo ambiguo exige confirmar estado legítimo o reiniciar sesión con clave nueva; no borrar/reescribir original. Idempotencia por checksum + idempotencyKey queda para un slice posterior auditable.

**Escenarios P1:**
- Actor de tenant A intenta escribir una clave B → 403, sin bytes alterados.
- Actor de Org B dentro del MISMO tenant intenta reemplazar una clave existente de Org A → 409, byte-por-byte idéntico a antes.
- Actor con key legacy o public → 403.
- Dos PUT concurrentes al mismo key → como máximo uno lo crea; segundo 409.
- Reintento móvil tras timeout recibe 409; se solicita plan fresco, no se falsifica evidencia ni se borra original.

**Trazabilidad:** `apps/api/test/uploads.controller.test.ts`; API, multipart, browser-agent, futuras migraciones S3/R2 usan la misma semántica write-once. Futuro S3/R2: `If-None-Match: *` en PUT / CompleteMultipartUpload (no confundir con un ETag de verificación de contenido). Logs nunca contienen material de imagen.

**Investigación primaria independiente (decisiones):**
1. Node.js fs `wx` / O_EXCL: https://nodejs.org/api/fs.html — aplicado: creación exclusiva atómica por clave.
2. AWS S3 conditional writes: https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html — backlog: paridad `If-None-Match: *` cuando driver S3/R2 se implemente.
3. OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html — aplicado: autenticación, autorización y límites de archivo. Descartado: sobrescritura o tratar una clave como prueba de ownership.

**Activación:** PR #870 requiere CI completo y smoke real multi-Org/tenant con bytes, prueba de reintentos, backup/restore y política de acceso a lectura; este complemento no activa `UPLOADS_SIGNED_GET_MODE` de producción.
