# ADR-043 — Originales de archivos bajo StorageService son write-once

- **Date:** 2026-10-11
- **Status:** Accepted
- **Production activation:** gated by terminal CI and canary verification
- **Owners:** SEMSE Core, Storage/Evidence
- **Affected domains:** Evidence, Uploads API, multipart, Browser Agent, future S3/R2/Field Memory 4D
- **Governing spec:** `docs/specs/platform/signed-file-access.spec.md` §13 (APPROVED)

## Contexto
La API validaba que el usuario tuviera `evidence:write` pero el `key` recibido por PUT podía apuntar a bytes existentes. El PR #870 añadió alcance por tenant. Devin confirmó que el mismo tenant puede contener varias Orgs: si un usuario conoce la clave de otra Org, `StorageService.store` con `createWriteStream(filePath)` la sobrescribiría. Pérdida de integridad de Evidence implica riesgo de disputa/pago y reconstrucciones 3D fraudulentas.

## Opciones evaluadas
A) Confiar solo en el prefijo tenant (rechazada: no limita Org ni overwrite).
B) Primero `stat`, después `write` (rechazada: race TOCTOU bajo concurrencia).
C) Crear original de modo exclusivo en el driver, tratar reintento ambiguo como conflicto y emitir nueva clave (elegida; protección irreversible de bytes).
D) Sobrescribir si el usuario dice ser propietario (rechazada: no hay capability/resource grant verificado en PUT).

## Decisión
`StorageService.store` crea objetos por clave solo si aún no existen; el driver filesystem usa `createWriteStream(...,{flags:"wx"})` para creación atómica y traduce `EEXIST` a `409`. Limpia únicamente archivos parciales **creados por el intento actual**. Un 409 nunca prueba que el archivo es del actor ni que coincide su checksum; se obtiene **un nuevo plan de subida**. No deduplicar por key no verificada, no borrar ni reemplazar evidencia original. Sólo el registro Evidence vincula el original a Project/Org/Job y audita esa relación. El GET firmado requiere política separada por recurso.

A futuro S3/R2 debe implementar escritura condicional `If-None-Match: *` y evitar overwrite también en MultipartComplete. La coherencia de respuesta API (409 local vs 412 nativo S3) se normalizará al contrato de Storage.

## Compatibilidad y migración
No modifica schema ni convierte originales históricos. Multipart, Browser Agent y flujos Web/Mobile usan claves únicas basadas en `randomUUID`; un replay tras timeout no se declara éxito si se recibe 409. Volver a planificar con nonce nuevo; registrar el éxito al recibir 2xx y confirmar bytes. Deben añadirse capacidades firmadas asociadas a recurso para detener ataques de creación arbitraria dentro de tenant y acceso cross-org por GET. Antes del deploy, revisar clientes con retry; si no pasan smoke, revertir código, sin borrar objetos existentes.

## Pruebas
- Dos usuarios de distintas orgs, mismo tenant, clave conocida → original no sobrescrito.
- Tenant distinto o clave legacy/public → 403 antes de tocar storage.
- Escrituras concurrentes → única creación.
- Multipart y captura IA no rompen con nuevas claves.
- Reintento legítimo obtiene nuevo key sin duplicar Evidence/outbox.
- Validar GET autenticado, membership, signed URL y retención independientemente.

## Investigación
1. Node.js `fs` flags `wx`: https://nodejs.org/api/fs.html — aplicado.
2. Amazon S3 conditional writes: https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html — backlog.
3. OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html — aplicado.


## Extension de publicación atómica propuesta (PR 2026-10-13, pendiente de CI/canary)

**Riesgo adicional observado:** el nombre definitivo se crea con wx antes de finalizar el stream. Un GET, un hash SHA-256 o un backup del volumen podría detectar bytes incompletos durante la subida, pese a que un segundo PUT no pueda sobrescribirlos.

**Nuevo algoritmo propuesto para el backend local:**
1. Subir bytes a un archivo único de permisos 0600 dentro de SEMSE_STORAGE_ROOT/multipart/.put-staging; este directorio se excluye del manifiesto de originales, pues no contiene originales publicados.
2. Finalizar por completo pipeline y cerrar el descriptor, sin exposición del key definitivo.
3. Crear hard link exclusivo desde staging hasta la ruta final. La operación link falla con EEXIST si otro PUT ya publicó el original; solo un escritor gana. Jamás usar rename sin RENAME_NOREPLACE ni secuencia check-then-write como garantía.
4. Borrar solo el nombre temporal propio, tanto en éxito como en error, sin tocar el objeto publicado por un intento concurrente.
5. Verificar test que la ruta final NO existe entre dos chunks, y que abortar un stream deja cero archivos visibles y staging limpio.

**Límites pendientes:** no hay snapshot atómico entre Postgres/Evidence y filesystem; hardlink necesita filesystem compatible en Railway, a probar antes del deploy. Persistencia de checksum servidor y control por organización forman etapa separada. No considerar este ADR extensión VERIFIED hasta CI/merge/deploy, smoke y restore de datos reales.

La extensión mantiene las garantías de 409, PUT tenant-scoped, nuevos nonce para reintentos, idempotencia de registro y compatibilidad de consumidores. Ninguna fotografía o política de pago se transforma automáticamente.
