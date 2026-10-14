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

**Estado de esta revisión (2026-10-11):** el propietario informó que creó backups. Esto se registra como **DECLARADO POR EL PROPIETARIO**, con confirmación verbal adicional del propietario de que también los creó para el volumen de fotografías de API (`project-manager-app-volume`); **no se ha inspeccionado estado `Completed`, fecha, retención ni ID del snapshot**. La ejecución CI de las pruebas de integridad del PR #874 fue satisfactoria en un commit previo; el merge y restore real siguen pendientes. Un restore aislado de un snapshot Railway no está soportado en el flujo público de la plataforma; usar exportación independiente para el ensayo. Ninguna de estas acciones marca `CAP-1 VERIFIED`.


## Fase E — transferencia segura SSH/SFTP para el ensayo real (pendiente de ejecución)

**Propósito:** obtener una COPIA secundaria para restaurarla sin cambiar el montaje productivo. Railway [documenta SSH/SFTP/SCP](https://docs.railway.com/cli/ssh) para transferencias desde el contenedor, incluidos volúmenes persistentes. No es una función para recuperar directamente los bytes de un snapshot nativo de Railway; esa restauración **no admite montaje aislado en otro servicio**.

**Operador autorizado, desde equipo cifrado y administrado (no GitHub Actions):**

1. Instalar/configurar Railway CLI y vincular `SEMSEproject / production`. No colocar tokens, claves o credenciales en instrucciones, comentarios de PR ni logs compartidos.
2. Utilizar `railway ssh -p 95ad1b14-d1d9-467d-82d8-5354619ba873 -e d682210a-956a-4508-9c5b-4ca5959278f9 -s semse-API -- printenv SEMSE_STORAGE_ROOT` para **leer exclusivamente el nombre del directorio**, no volcar otras variables de entorno. La ruta prevista `/data/semse-storage` NO ha sido confirmada en ejecución.
3. Comprobar permisos y ejecutar las operaciones sobre una **ventana consistente de archivos**. Si el backend acepta uploads mientras se transfiere, no afirmar que el conjunto es un snapshot coherente. Detener/controlar las escrituras mediante procedimiento autorizado y registrar hora de inicio/fin. No eliminar ni mover originales.
4. Generar manifiesto SHA-256 del mismo conjunto, guardándolo en almacenamiento privado cifrado. Nunca mandar el inventario con keys de clientes a CI o al chat.
5. Según la documentación CLI, `railway ssh config` permite generar un alias SSH de la instancia y `scp -r <alias>:<origen> <destino_local>` extrae un directorio a un equipo del operador. **Utilizar una ubicación cifrada** como destino; no realizar esta transferencia en un portátil/disco sin cifrado ni en servidores compartidos. El alias y la ruta se deben confirmar primero con el comando `railway ssh config --dry-run` y el directorio `SEMSE_STORAGE_ROOT` real (no asumir ruta fija). SSH/SFTP accede al sistema de archivos en ejecución, **NO** descarga un backup de Railway.
6. Excluir `multipart/` del inventario de originales; la copia completa puede incluirlo, pero no debe sumarse como evidencia. Separar el respaldo de evidencia legal del staging temporal. Comprobar capacidad, costes y retención para almacenamiento externo privado.
7. Restaurar esa copia en un **directorio nuevo aislado** de la máquina o un contenedor efímero en un entorno diferente. Ejecutar `--verify --manifest ... --restored-root ...` y exigir `PASS` con cero faltantes, alterados o adicionales. No aceptar inventario de cero originales.
8. Registrar ID de copia, cobertura temporal, número de originales, hashes agregados del manifiesto (sin publicar entradas), duración del restore, RPO/RTO observados y resultados de referencias Evidence/DB. Borrar la copia temporal solo tras aprobación de conservación/retención y confirmar cifrado del destino permanente.

**Limitaciones del ensayo:** SHA-256 íntegro demuestra coincidencia de bytes entre inventario y copia recuperada, no demuestra que un snapshot gestionado Railway sea restaurable ni reemplaza la correlación con registros Evidence. Hasta tener ambos controles, `RESTORE NOT VERIFIED` para backups Railway.

**Prohibido:** pulsar `Restore` en producción con fines de prueba; adjuntar el volumen original a otra app, subir un archive de fotos a GitHub o publicar un endpoint de descarga de originales sin autorización por tenant/Org/recurso.


## Fase F — recuperación reproducible desde exportación privada (2026-10-13)

**Estado:** Herramientas en revisión. Ninguna recuperación con bytes reales de producción se ha efectuado todavía. Este procedimiento verifica una exportación independiente, **no extrae un snapshot gestionado por Railway** ni permite restaurarlo aisladamente.

**Precondiciones:** autorización del propietario, computadora controlada con Railway CLI y OpenSSH, Node 20+, un disco PRIVADO CIFRADO en reposo con espacio para dos copias, y ventana de escritura de originales suspendida por procedimiento autorizado. Nunca guardar manifest ni fotografías en CI, GitHub, chat o carpeta compartida. Documentación oficial: https://docs.railway.com/cli/ssh

### A. Confirmar raíz productiva y configurar alias SSH (no modifica el volumen)

~~~bash
railway ssh --project 95ad1b14-d1d9-467d-82d8-5354619ba873 \
  --environment d682210a-956a-4508-9c5b-4ca5959278f9 \
  --service semse-API -- printenv SEMSE_STORAGE_ROOT

railway ssh config --project 95ad1b14-d1d9-467d-82d8-5354619ba873 \
  --environment d682210a-956a-4508-9c5b-4ca5959278f9 \
  --service semse-API --alias semse-api-prod
~~~

### B. Inventario SHA-256 read-only ANTES de copiar, en ventana sin subidas

Ejecutar la secuencia desde un shell Bash en una computadora con disco privado realmente **cifrado**. Si falla cualquier paso, detener todo y NO marcar PASS. Los manifests contienen keys privadas: no copiarlos en issue, CI ni conversación. Usar el mismo ID opaco en ambas observaciones, que NO es el ID del backup Railway.

~~~bash
set -euo pipefail
umask 077
export SECURE_DIR="/RUTA/CIFRADA/semse-field-memory-20261013"
export ORIGINALS_ROOT="/data/semse-storage" # solo usar después de confirmar ruta real en Railway
mkdir -p "$SECURE_DIR/export" "$SECURE_DIR/rehearsal"

railway ssh --project 95ad1b14-d1d9-467d-82d8-5354619ba873 \
  --environment d682210a-956a-4508-9c5b-4ca5959278f9 \
  --service semse-API -- node --input-type=module \
  -e "$(cat scripts/field-memory-source-inventory.mjs)" -- export-cap-20261013 \
  > "$SECURE_DIR/manifest-before.partial.json"
mv "$SECURE_DIR/manifest-before.partial.json" "$SECURE_DIR/manifest-before.json"
~~~

La utilidad lee el volumen sin modificarlo y comprueba hashes SHA-256, tamaño y marcas de modificación de cada archivo, pero no obtiene una instantánea atómica. Un archivo editado durante el escaneo hace fallar el proceso si se detecta el cambio.

### C. Extraer originales y repetir inventario DESPUÉS (mismo punto lógico)

~~~bash
# Solo dentro de la misma ventana de custodia y sin nuevas escrituras:
scp -r "semse-api-prod:$ORIGINALS_ROOT/." "$SECURE_DIR/export"

railway ssh --project 95ad1b14-d1d9-467d-82d8-5354619ba873 \
  --environment d682210a-956a-4508-9c5b-4ca5959278f9 \
  --service semse-API -- node --input-type=module \
  -e "$(cat scripts/field-memory-source-inventory.mjs)" -- export-cap-20261013 \
  > "$SECURE_DIR/manifest-after.partial.json"
mv "$SECURE_DIR/manifest-after.partial.json" "$SECURE_DIR/manifest-after.json"

node scripts/field-memory-compare-inventories.mjs \
  --before "$SECURE_DIR/manifest-before.json" \
  --after "$SECURE_DIR/manifest-after.json"
~~~

**Control bloqueante:** la comparación solo acepta status PASS, con addedFiles, removedFiles y changedFiles iguales a cero. Si no coincide, invalidar toda la exportación, no ejecutar la Fase D y programar otra ventana consistente. **Incluso con PASS, dos scans iguales NO prueban congelación atómica**; se requiere que el operador haya detenido escrituras/ingresos durante ambos scans y la transferencia.

La exportación SSH/SCP lee el filesystem activo, no un snapshot de Railway. Nunca utilizar la función nativa Restore sobre la API productiva para esta prueba.

### D. Restaurar en carpeta temporal aislada y validar todos los archivos

~~~bash
node scripts/field-memory-custody-gate.mjs \
  --before "$SECURE_DIR/manifest-before.json" \
  --after "$SECURE_DIR/manifest-after.json" \
  --export-root "$SECURE_DIR/export" \
  --isolated-parent "$SECURE_DIR/rehearsal" \
  --confirm-encrypted-destination \
  --confirm-quiescent-export > "$SECURE_DIR/custody-gate.partial.json"
mv "$SECURE_DIR/custody-gate.partial.json" "$SECURE_DIR/custody-gate-report.json"
~~~

El comando integrado **exige** los inventarios antes/después, una secuencia temporal diferenciada, un directorio cifrado confirmado y atestación explícita del operador de que el periodo de extracción tuvo escrituras suspendidas. Si cualquiera falla, sale con código no cero y NUNCA ejecuta la copia de recuperación. Si ambos inventarios son estables, compara los bytes exportados, crea una copia temporal aislada, repite SHA-256/tamaño/recuento y la elimina. El informe contiene solo totales y checksums del manifiesto, nunca rutas relativas ni keys. El equipo debe retener registros operativos de quién autorizó, cuándo se congelaron escrituras y el mismo punto temporal en Postgres/Evidence. No se admite mostrar una pantalla de PASS sin dicha evidencia.

**Criterio PASS (solo exportación independiente):** result OFFSITE_RESTORE_PASS, missingFiles=0, alteredFiles=0, unexpectedFiles=0, filesRestored=sourceFiles mayor que cero y las banderas railwaySnapshotRestored, evidenceDatabaseReconciled y captureSessionActivationPermitted **false**. Adjuntar a auditoría solo referencia opaca, SHA del manifiesto, totales y duración; no manifest privado.

**Separación de evidencias:** CI SUCCESS cubre bytes sintéticos; rehearsal PASS cubre una exportación independiente realmente probada; la restaurabilidad de un snapshot Railway permanece UNVERIFIED hasta contar con prueba propia y segura. La reconciliación temporal con Postgres/Evidence y los permisos por organización también permanecen pendientes.

**Prohibido:** pulsar Restore del backup productivo para ensayar, crear endpoints públicos de extracción, alterar variables en Railway, activar CaptureSession o publicar originales o su inventario.


## Fase G — reconciliación offline Evidence/Postgres (P0, no activación por coincidencia)

El esquema Postgres real contiene Evidence.id, tenantId, projectId, bucketKey y checksum nullable. Antes de cualquier consulta, debe garantizarse una transacción READ ONLY con snapshot temporal compatible con el manifiesto de originales. Los datos de la proyección son PRIVADOS y no se pueden colocar en GitHub, chats, capturas ni artefactos públicos. No enviar claves de acceso Postgres al asistente.

El operador de base de datos debe exportar a archivo JSON cifrado el siguiente esquema (valores ilustrativos, NO claves reales): schema = semse-evidence-backup-projection-v1, records = arreglo de objetos con id, tenantId, projectId, bucketKey, checksum. Debe quedar auditado el operador, snapshot, inicio/fin, entorno y total de filas. Si el checksum está vacío o fue proporcionado por el cliente y no calculado sobre bytes por el servidor, la custodia todavía NO está acreditada.

~~~bash
set -euo pipefail
umask 077
node scripts/field-memory-evidence-reconcile.mjs \
  --manifest "$SECURE_DIR/manifest-before.json" \
  --projection "$SECURE_DIR/evidence-projection.json" \
  > "$SECURE_DIR/evidence-reconcile.json"
~~~

**ATENCIÓN:** la herramienta devuelve exit status 2 incluso con MATCHED_METADATA_NOT_ATTESTED. Coincidencia entre JSON y disco NO acredita que el hash fuera originado por API ni que la organización tenga acceso al recurso. No reetiquetar la salida manualmente como VERIFIED para saltarse este gate. Una comprobación completa requiere: Evidence.sha256 calculado por servidor, datos reales exportados del mismo punto temporal, pertenencia de Org/Project/Job verificada con sesiones reales, un restore íntegro y un registro de auditoría de consentimiento/retención.

Los nombres de estado deben distinguir cuatro garantías independientes: RAID/volumen visible, backup Railway creado, copia cifrada offsite recuperable y Evidence con provenance/rights verificadas. No activar CaptureSession hasta que todas tengan evidencia auditada.


## Fase H — operador Windows 11 / PowerShell (13-oct-2026)

El conector Railway OAuth no proporciona acceso SSH al equipo local del propietario. Para efectuar el ensayo real sin abrir puertos públicos, usar el runner PowerShell versionado en scripts/field-memory-offsite-recovery-windows.ps1. No inventar una ruta D:\ que no exista; ejecutarlo desde el checkout actualizado.

**Primero:** revisar el PR que incorporó el runner y su CI, actualizar el repositorio, verificar Test-Path y comprobar Railway CLI, SSH, SCP y Node. El modo Preflight consulta solamente la ubicación de originales, y no copia fotografías.

~~~powershell
# Ejecutar desde project-manager-app/ después de integrar el PR
Test-Path -LiteralPath .\scripts\field-memory-offsite-recovery-windows.ps1
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\field-memory-offsite-recovery-windows.ps1 -Mode Preflight -RepoRoot (Get-Location).Path
~~~

**Ensayo REAL:** solamente cuando se confirme BitLocker activo en la unidad, se disponga de espacio para exportación y copia temporal y esté suspendida efectivamente la escritura de originales en TODAS las rutas (API, multipart, agentes, worker y clientes). Una suspensión de una sola pantalla web no garantiza quiescencia global. No indicar UploadsQuiescedConfirmed si no se ha asegurado.

~~~powershell
# SecureRoot es un ejemplo, NO se crea automáticamente ni presupone cifrado.
# Elegir una carpeta existente en una unidad Windows con BitLocker ProtectionStatus On.
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\field-memory-offsite-recovery-windows.ps1 -Mode ExportAndVerify -RepoRoot (Get-Location).Path -SecureRoot 'D:\SEMSE-Secure-Recovery' -EncryptedStorageConfirmed -UploadsQuiescedConfirmed
~~~

El runner falla cerrado si SEMSE_STORAGE_ROOT no está en /data, no encuentra código o dependencias, BitLocker no puede comprobarse, no se confirmó quiescencia, SCP falla, hay cambios de inventario o fallan SHA-256 en el restore. Cada ejecución crea una carpeta exclusiva y no sobrescribe backups antiguos. Solo muestra cantidades, sin nombres de fotos.

**Salida aceptable:** OFFSITE_RESTORE_PASS y un recuento mayor que cero, pero CaptureSessionActivationPermitted permanece false. Se verifica una exportación independiente del filesystem vivo, NO la restauración de un snapshot nativo de Railway ni la autoridad de Evidence/Postgres/Org. Conservar solo el informe agregado y el SHA del manifiesto en el expediente de auditoría restringido. Jamás enviar fotos, claves, rutas privadas o manifests al chat o repositorio.

## Fase I — originales sin fila de Evidence (informe, nunca limpieza)

La subida son tres pasos sin transacción: presign, PUT (los bytes ya quedan publicados) y register (fila de Evidence). Si el tercero no ocurre o es rechazado (p. ej. `EXIF_INVALID`, que no deja rastro en AuditLog), el original queda sin fila. Un original recién subido sin fila es normal; uno antiguo requiere una decisión del operador.

~~~bash
set -euo pipefail
umask 077
node scripts/field-memory-orphan-originals-report.mjs \
  --manifest "$SECURE_DIR/manifest-before.json" \
  --projection "$SECURE_DIR/evidence-projection.json" \
  --grace-hours 24 \
  --private-detail "$SECURE_DIR/orphan-originals-detail.json" \
  > "$SECURE_DIR/orphan-originals-report.json"
~~~

La salida agregada no contiene claves, rutas, IDs ni hashes. Las claves de los huérfanos antiguos solo se escriben en `--private-detail` (no sobrescribe un archivo existente) y son datos PRIVADOS. Exit status 0 = sin huérfanos antiguos, 3 = hay huérfanos antiguos, 1 = entrada inválida. Los objetos sin marca de tiempo en el nombre (`<epoch-ms>-<uuid>`) nunca se tratan como "en vuelo".

**Prohibido** borrar, mover o sobrescribir un original a partir de este informe: ADR-043 declara los originales write-once. Cada huérfano antiguo se resuelve por decisión del operador (registrarlo por el flujo normal, o conservarlo sin cambios). Esta herramienta no sustituye la conciliación de la Fase G ni acredita custodia.


## Fase H — protección fail-closed de almacenamiento productivo (PR 2026-10-14)

**P0 identificado:** StorageService tenía fallback a /tmp/semse-storage sin raíz explícita, y permitía usar almacenamiento local cuando se configuraba un proveedor no implementado. La API podía aceptar originales sin garantía de persistencia.

El PR de protección impide que una instalación en producción cree directorios de originales, admita PUT o publique planes de carga cuando no se pueda probar:
1. STORAGE_PROVIDER está configurado explícitamente como local.
2. SEMSE_STORAGE_ROOT es ruta absoluta que reside DENTRO de /data, nunca en /tmp ni exactamente /data.
3. /proc/self/mountinfo confirma un punto de montaje EXACTO en /data, no una carpeta efímera cualquiera.
4. realpath de la carpeta existe, es directorio y permanece dentro de ese montaje; no se fabrica un volumen mediante mkdir.
5. Cualquier incumplimiento devuelve 503 genérico, sin exponer archivos o paths.

El diagnóstico read-only ahora incluye EVIDENCE_ORIGINAL_SHA256_MODE, distinguiendo off/shadow de enforce; no cambia ni activa la variable. Un modo enforce todavía NO acredita que se haya restaurado un backup ni comprobado derechos por Org/recurso.

**Antes de merge/despliegue:** comprobar el valor efectivo de SEMSE_STORAGE_ROOT, STORAGE_PROVIDER y EVIDENCE_ORIGINAL_SHA256_MODE desde Railway SSH; ejecutar el preflight dentro de semse-API, hacer canary de PUT/GET de originales con dos organizaciones y error de volumen ausente simulado SOLO en un entorno desechable; monitorizar errores 503 y mantener rollback documentado. No ejecutar pruebas destructivas en producción.

**Situación 2026-10-14:** Railway confirmó volumen semse-API montado /data y existencia de las variables de storage, con valores redacted. EVIDENCE_ORIGINAL_SHA256_MODE no se encontró en los nombres configurados al auditar el servicio, por lo que no existe prueba de enforce. El propietario creó backups de volumen, pero la recuperación efectiva de fotografías reales aún NO está demostrada. CaptureSession sigue inactivo.
