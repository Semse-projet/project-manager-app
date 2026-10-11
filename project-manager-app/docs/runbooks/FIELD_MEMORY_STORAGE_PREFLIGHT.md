# Runbook — Field Memory / Storage production preflight (solo lectura)

> Creado el 2026-10-11. **Estado: PREFLIGHT CODE, no prueba de backup/restauración.**
> Complementa `docs/runbooks/BACKUP_RESTORE.md` y `docs/specs/platform/signed-file-access.spec.md`.
> Este procedimiento no lee imágenes, no ejecuta SQL, no cambia secretos ni activa modos de lectura.

## Estado verificable de SEMSEproject / production (Railway)

- API: servicio `semse-API`, volumen `project-manager-app-volume` **LIVE**, capacidad **5000 MB** y mount `/data`.
- Web y Worker: **sin volúmenes**; almacenar originales solo desde el servicio API.
- Redis y Postgres: cada uno con su propio volumen; no confundirlos con los originales.
- Variables visibles solo por nombre por la conexión Railway OAuth: `SEMSE_STORAGE_ROOT`, `SEMSE_MULTIPART_STORAGE_ROOT` y `STORAGE_PROVIDER` están definidas; **sus valores no son legibles desde la conexión**. El runbook `infra/railway/DEPLOY.md` prescribe `/data/semse-storage` y `/data/semse-storage/multipart`, **pero eso no acredita los valores reales**.
- No hay bucket de objetos en el entorno consultado.
- No se encontraron variables `UPLOADS_SIGNED_GET_MODE` ni `UPLOADS_SIGNING_SECRET`: el código usa `off` por defecto para lectura firmada.
- `docs/runbooks/BACKUP_RESTORE.md` de 2026-09-13 reportaba 0 backup de volumen y 0 restauraciones probadas. **No se pudo revalidar inventario de backups** con los conectores disponibles: *unverificado*, no afirmar que continúa en cero.

## Fase A — Ejecutar diagnóstico de solo lectura (sin exponer credenciales)

Dentro del proceso/contenedor de la **API** del entorno correspondiente (no en laptop ni Web):

```bash
node scripts/field-memory-storage-preflight.mjs --strict-layout
```

El script consulta `/proc/self/mountinfo`, existencia y permisos de las raíces de archivos, compara que ambas estén realmente bajo `/data`, comprueba nombre del driver y presencia/formato del modo firmado. Solo emite **estados por check**. No imprime `AUTH_SECRET`, el secreto de firmas, rutas de Evidence, URLs, ni datos de usuario. No crea directorios ni sube archivos.

**Importante:** permiso W_OK detectado no demuestra que bytes sobrevivan a redeploy. El script usa `privateCaptureReady: false` aunque todos los checks de layout pasen, porque no puede atestiguar backup/restore ni la autorización por recurso.

Interpretación: `storageLayoutReady: true` significa *configuración local potencialmente válida*, **no cumplimiento de custodia ni liberación del flag de capturas**. Ante fallo BLOCK no activar Field Memory; reparar configuración sin modificar originales existentes.

## Fase B — Evidencia que falta para custodia persistente

1. Revisar valores efectivos de `STORAGE_PROVIDER`, `SEMSE_STORAGE_ROOT` y `SEMSE_MULTIPART_STORAGE_ROOT` **solo en una terminal autorizada**; no pegarlos en GitHub. Confirmar mount verdadero con el script.
2. Seleccionar backup de volumen cifrado y aislamiento por organización; definir RPO/RTO y retención contractual.
3. Crear backup/snapshot sin detener ni sobrescribir originales; registrar ID del backup, fecha, scope y hash de un objeto de prueba (no publicar nombres/keys reales).
4. Restaurar **a un entorno desechable aislado**, jamás encima del volume API de producción. Validar read-only tamaño/hash SHA-256 de archivos de prueba y correspondencia con las referencias Evidence/DB restauradas.
5. Documentar resultado de restauración, duración y errores. Hasta tener esa evidencia, status **NOT VERIFIED**.
6. Probar flujo canario de subida auténtica: PUT exitoso, registro Evidence, consulta autenticada, reinicio/deploy controlado y comparación de hash. Esto **sí cambia producción** si se hace en productivo, por lo que requiere aprobación de ejecución y ventana específica aparte del diagnóstico.

## Fase C — Lectura privada firmada (sin cambiar variables ahora)

1. Configurar un secreto `UPLOADS_SIGNING_SECRET` fuerte distinto de `AUTH_SECRET`; valor siempre sellado/secret manager. No mostrarlo en registros. Preferir un entorno de staging primero.
2. Activar `UPLOADS_SIGNED_GET_MODE=shadow` y observar durante **≥7 días** `uploads_unsigned_read` por origen: browser, Vision, mobile, agentes y consumidores externos. La respuesta sigue operativa durante shadow, pero firmas malas/expiradas devuelven 403.
3. Corregir consumidores que guardan URLs permanentes y probar expiración de 15 min browser / 5 min Vision según spec.
4. Solo después de pruebas de acceso cross-tenant y **cross-Org a nivel Evidence/Project** y confirmación de derechos, pasar a `enforce`. **Una firma de clave no concede por sí misma derecho a otro recurso**.
5. Rollback: `off` según spec aprobado, con registro de incidente; no perder seguimiento de exposiciones pasadas. Volver a shadow una vez reparado.
6. Considerar BFF #873 y PUT write-once #870 como requisitos separados: ninguna aprobación de CAP-0 evita sus pruebas CI/security.

## Gate de cierre

- [x] Inventario de mount de Railway realizado de forma no destructiva.
- [ ] Script ejecutado dentro del **contenedor real de API** con resultado de layout PASS.
- [ ] Backup real y restauración **verificada** en entorno aislado (RPO/RTO medidos).
- [ ] Signed GET `shadow` ≥7 días y consumidores auditados.
- [ ] Signed GET `enforce` + política tenant/Org/Project probada con identidades reales.
- [ ] Smoke de preservación de bytes y autorización después de redeploy.
- [ ] Reconciliar reporte de restauración con Evidence hashes y marcar estado solo según pruebas.

Sin estos gates, CAP-1 puede permanecer en desarrollo pero **no habilitar almacenamiento privado 3D/4D a usuarios externos**.


## Fase D — Inventario SHA-256 y restore aislado verificable

La herramienta `scripts/field-memory-originals-restore-drill.mjs` implementa un **verificador de copias originales**, no crea backups de Railway ni restaura sobre `/data`. Rechaza symlinks, rutas traversal y archivos especiales; compara el inventario exacto y cada SHA-256, tamaño, faltantes, alterados y archivos inesperados. Ignora únicamente la carpeta superior `multipart/` por ser área transitoria de chunks y NO evidencia original.

**Paso 1: Validación automática con fotos sintéticas, sin datos de clientes** (se puede ejecutar en CI o laptop):

```sh
node --test tests/unit/field-memory-originals-restore-drill.test.mjs
node scripts/field-memory-originals-restore-drill.mjs --fixture
```

El resultado `cleanRestore: PASS` y `corruptionDetected: true` valida que el código diferencia una recuperación íntegra de una alterada; `actualRailwayBackupVerified: false` será siempre falso en este modo.

**Paso 2: Inventario del punto de copia, solo durante una ventana consistente y autorizada.** Confirmar el valor real de `SEMSE_STORAGE_ROOT` por terminal Railway de API. Restringir uploads nuevos al tomar el punto de respaldo: si se suben archivos mientras se hace el inventario no hay snapshot consistente. Guardar el manifiesto **fuera del volumen de originales**, en almacenamiento privado cifrado (contiene nombres/keys de archivo que son sensibles). Nunca publicarlo como artifact público de CI:

```sh
node scripts/field-memory-originals-restore-drill.mjs --create-manifest \
  --source "$SEMSE_STORAGE_ROOT" \
  --backup-reference "backup-id-REEMPLAZAR" \
  --output "$PRIVATE_AUDIT_DIR/originals-manifest.json"
```

Esto solamente crea un manifiesto; NO ejecuta el respaldo. La copia real debe hacerse con un mecanismo autorizado de Railway/backups o exportación cifrada. El identificador debe corresponder al backup real y quedar anotado por el operador, con hora, entorno y política de retención. No utilizar como respaldo el mismo volumen `/data`.

**Paso 3: recuperación aislada por copia independiente (no por la opción Restore del snapshot Railway).** La [documentación oficial de backups de volúmenes](https://docs.railway.com/volumes/backups) aclara que su opción `Restore` solo opera en el mismo proyecto/entorno, crea un volumen restaurado que **sustituye al montado en el servicio**, y requiere confirmar `Deploy`. Por ello NO debe utilizarse para un ensayo en la API productiva.

**Dos tipos de control — no confundirlos:**
- **Respaldo Railway**: confirmar en `semse-API → Backups` que existe un backup de `project-manager-app-volume`, con fecha, estado completado y retención. Esto protege contra incidentes pero **todavía no prueba la recuperación**; no tocar `Restore`.
- **Ensayo independiente**: producir además una copia cifrada coherente de los originales desde una ventana de lectura/backup controlada, guardarla **fuera del mismo volumen** (por ejemplo bucket privado autorizado), restaurarla en un contenedor temporal aislado y ejecutar `--verify` contra el manifiesto SHA-256 del **mismo punto temporal**. No inventar que la copia procede del snapshot interno de Railway: este ensayo comprueba la copia independiente, no la restaurabilidad del snapshot Railway.

Si aún no existe medio seguro para extraer/cifrar/restaurar la copia independiente, el control de restore queda `UNVERIFIED`. No crear nuevos servicios, buckets o credenciales automáticamente ni entrar en `Restore` durante la prueba.

**Paso 4: Verificar integridad de la copia RESTAURADA**, en un contenedor aislado cuyo directorio no sea `/data` productivo:

```sh
node scripts/field-memory-originals-restore-drill.mjs --verify \
  --manifest "$PRIVATE_AUDIT_DIR/originals-manifest.json" \
  --restored-root "$ISOLATED_RESTORED_ORIGINALS_DIR"
```

Gate de aceptación: `status:PASS`, `missingFiles=0`, `alteredFiles=0`, `unexpectedFiles=0`, `matchedFiles=expectedFiles`; adjuntar a auditoría **solo resultado agregado y ref de backup**, no manifest con rutas/PII. Complementarlo con recuento de Evidence y referencias originales de la base restaurada **del mismo punto temporal**, legal hold y políticas tenant/Org; la coincidencia de hashes por sí sola no demuestra acceso correcto ni completitud del snapshot.

**Estado de esta revisión (2026-10-11):** el propietario informó que creó backups. Esto se registra como **DECLARADO POR EL PROPIETARIO**, sin confirmación de que incluyan el volumen API ni de snapshot completado. La ejecución CI de las pruebas de integridad del PR #874 fue satisfactoria en un commit previo; el merge y restore real siguen pendientes. Un restore aislado de un snapshot Railway no está soportado en el flujo público de la plataforma; usar exportación independiente para el ensayo. Ninguna de estas acciones marca `CAP-1 VERIFIED`.
