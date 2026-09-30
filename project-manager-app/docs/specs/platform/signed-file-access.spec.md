---
id: "platform.signed-file-access"
title: "Acceso firmado y con alcance a archivos subidos (evidencia)"
domain: "platform"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
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
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-30"
---

# Spec: Acceso firmado y con alcance a archivos subidos (C19 · C10)

> **Borrador para aprobación humana — no implementar.** Las preguntas abiertas (§9) deben resolverse antes de pasar a `APPROVED`. Riesgo `high`: toca lectura de evidencia (fotos/PDF de obra) y a los consumidores browser + vision-service.

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
- Secreto: `UPLOADS_SIGNING_SECRET` (distinto de `AUTH_SECRET`); soporte de dos secretos activos para rotación.

## 6. FSM, eventos y reconstrucción
Sin cambios de FSM. Observabilidad: contador `uploads_reads{mode,signed,authenticated,result}` y log estructurado `uploads_unsigned_read` (sin PII; solo tenant de la clave y `Referer` host).

## 7. Datos y migración
Sin migración de datos ni de esquema. Las URLs ya emitidas (guardadas en respuestas/clientes) dejan de valer solo al pasar a `enforce`; un recálculo bajo demanda es posible porque se derivan de la clave.

## 8. Observabilidad, despliegue y activación
Rollout: `off` → `shadow` (≥ 7 días, revisar lecturas sin firma por origen) → `enforce` por entorno. Canary con tenant interno. Activación solo con evidencia de que browser y vision-service no dependen de URLs sin firma.

## 9. Preguntas abiertas (requieren decisión humana)
1. **TTL**: ¿cuánto vive una URL para el navegador (p. ej. 15 min) y para el vision-service (p. ej. 5 min)?
2. **Clientes que guardan URLs** (web, mobile, reportes/PDF generados): ¿se acepta recalcular la URL en cada lectura de la entidad, o hay URLs persistidas que deban seguir vivas?
3. **Vision-service**: ¿firma corta por llamada (propuesta) o credencial de servicio propia?
4. **Mobile/offline**: ¿la app móvil cachea URLs? Afecta a la expiración.
5. **Contributor-program `previewUrl`**: ¿debe ser pública por diseño (assets de marketing) y quedar fuera de la regla?
6. **Activos públicos legítimos** (p. ej. logos): ¿prefijo de clave explícitamente público?

## 10. Tests requeridos
Firma válida/expirada/alterada/otra clave; comparación en tiempo constante; sesión de otro tenant; modos off/shadow/enforce; vision-service con URL firmada; compatibilidad con rotación de secreto; no-regresión de subida (PUT) y del proxy BFF.

## 11. Mapa de implementación
API: `storage.service.ts` (`publicUrl` firmado), `uploads.controller.ts` (validación), `storage-key.ts` (extraer tenant de la clave). Consumidores: `vision.service.ts`, `evidence-gateway.service.ts`. Web: revisar componentes que usan la URL directa. Tests en `apps/api/test/`.

## 12. Gates de cierre
Spec `APPROVED` · preguntas §9 resueltas · tests · CI terminal · merge SHA · deploy · shadow sin lecturas sin firma inesperadas · smoke autenticado multi-tenant · evidencia registrada.
