# C19/C10 — Acceso firmado a archivos subidos (2026-10-01)

- Spec `platform.signed-file-access` → APPROVED (valores §9 aceptados por el dueño en sesión).
- Código: `infrastructure/storage/signed-url.ts` (HMAC-SHA256 sobre `GET\n{key}\n{exp}`, tiempo constante, 2 secretos para rotación), `StorageService.publicUrl(key,{ttl})`, `UploadsController.getFile` (autoriza antes de tocar el storage; 403 idéntico exista o no la clave). Vision y evidence-gateway piden URLs de 5 min.
- Modo por defecto `off` (sin cambio de comportamiento); `shadow` registra `uploads_unsigned_read`; `enforce` exige firma o sesión del tenant de la clave.
- Pruebas: `apps/api/test/signed-file-access.test.ts` (firma válida/expirada/alterada/otra clave/otro verbo, rotación, matriz por modo, tenant ajeno 403, OPS_ADMIN, claves legacy, publicUrl por modo/TTL, controlador E2E). Suite API unit: 2573 pass, 0 fail.
- Límites conocidos: `referenceImageUrl` de `checklistSchema` puede ser una URL sin firmar guardada → verificar en shadow; el proxy BFF web de lectura no existe (los navegadores usan URL directa firmada); la lectura por sesión solo admite bearer/headers de dev.
- Activación (pendiente, del operador): configurar `UPLOADS_SIGNING_SECRET`, pasar a `shadow` ≥7 días, revisar logs, luego `enforce`. Sin eso, C19 sigue abierta en producción.
