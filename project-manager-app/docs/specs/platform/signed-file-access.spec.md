---
id: "platform.signed-file-access"
title: "Acceso firmado y con alcance a archivos subidos (evidencia)"
domain: "platform"
sdd_version: "2.0"
version: "0.2"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
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
