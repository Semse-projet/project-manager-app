# SEMSE Field Memory — Matriz de custodia y aceptación (2026-10-13)

**Alcance:** CaptureSession CAP-0, Evidence, originales y reconstrucción 3D.  
**Estado real:** PARTIAL / NO ACTIVAR. No se ha restaurado aún una foto real productiva.

## Estado verificable

| Control | Evidencia | Límite |
| --- | --- | --- |
| Volumen de API | LIVE, 5 GB en /data, Railway 2026-10-13 | No prueba backup |
| Backups creados | Propietario confirma los del volumen API | ID, COMPLETED y retención no inspeccionados |
| PR #874 | MERGED, CI SUCCESS | Script preflight y hash sintético |
| PR #913 | MERGED, CI SUCCESS | Exportación offsite y restauración simulada |
| PR #914 | En revisión | Inventario doble, gate integrado y reconciliación offline |
| Restauración real | NOT RUN | Sin shell SSH/autorización para leer origen desde esta conexión |
| Restauración de snapshot Railway | NOT RUN | No usar Restore en API productiva |
| CaptureSession activo | NO | Requiere cadena de custodia íntegra |

## Amenazas P0 constatadas en main

1. **Huella incompleta en Evidence.** El campo checksum en modelo Evidence es opcional. EvidenceRepository.create registra bucketKey pero no demuestra cálculo y persistencia transaccional de SHA-256 desde bytes almacenados. Una fila puede señalar un archivo distinto; un hash aportado por cliente nunca equivale a hash autoritativo.
2. **Punto temporal inconsistente.** Dos inventarios iguales antes/después de SCP NO constituyen snapshot atómico. Cambios transitorios entre scans A→B→A pueden pasar sin detectarse. Hace falta suspensión verificable de escrituras y snapshot de DB del mismo punto temporal.
3. **Confundir backup y restore.** Exportar archivos del servicio vivo no demuestra que un snapshot Railway sea restaurable. Es obligatorio declarar ambas evidencias por separado.
4. **Permisos por recurso.** tenantId no autoriza acceso a proyectos, empleadores ni fotos por sí solo. Comprobar Org/Project/Job y revocación con sesión autenticada en cada acción y URL firmada.
5. **Preservación.** JPEG original no se reemplaza con thumbnails, panorama 360, Gaussian splats, modelos 3D, resultados de IA ni anotaciones. Todo derivado lleva ID y hash de original, transformación versionada, rightsPolicy y cadena de custodia.
6. **Privacidad.** Los manifiestos y proyecciones Evidence contienen claves vinculadas a obras. Solo en almacenamiento privado CIFRADO; prohibido CI artifacts públicos, PR, chat, logs o buckets abiertos.

## Gate obligatorio antes de CaptureSession real

- [ ] Comprobar snapshot COMPLETED de project-manager-app-volume, con ID, fecha, retención y responsable.
- [ ] Comprobar SEMSE_STORAGE_ROOT dentro de /data; fallar cerrado ante fallback a /tmp o proveedor ficticio en producción.
- [ ] Ventana controlada sin escrituras con responsable, inicio/fin y snapshot de Postgres compatible.
- [ ] SHA-256 de todos los originales con dos inventarios antes y después, misma referencia, sin cambios.
- [ ] Copia independiente cifrada y autenticada; integridad verificada con el gate único y directorio temporal aislado.
- [ ] Medir RPO/RTO y registrar pruebas de backup/restauración sin compartir IDs privados.
- [ ] SHA-256 calculado por servidor sobre cada original, asociado transaccionalmente a Evidence y auditable.
- [ ] Reconciliar Evidence.id/tenantId/projectId/bucketKey/checksum con inventario del MISMO punto temporal, fallando cerrado.
- [ ] Comprobar autorización con clientes, pro asignado, supervisor, org ajena del mismo tenant y revocación.
- [ ] Verificar una foto recuperada desde una sesión autorizada, no solo comparar hashes.
- [ ] Canary de CaptureSession con rollback de flags y auditar todas las acciones; no liberar escrow por reconstrucciones.

## UX y usabilidad de nivel producto

**Operador:** distinguir claramente Backups CREATED, Snapshot INSPECTED, Offsite RESTORE PASS, Railway snapshot UNTESTED y Evidence hash NOT ATTESTED. Un gate único con exit no cero si algún requisito falla. Estado de bloqueo y siguiente acción concreta. No permitir botón de cierre global si falta prueba.

**Contratista:** captura en pared/zona/etapa + Job/Project; mensajes separados de Captured local, Uploaded, Submitted, Reviewed, Verified y Restored. Fotos originales inmutables; modo offline sin sincronización automática hasta verificar autorización e idempotencia.

**Cliente/inspector:** ver solo evidencias propias y revisiones explícitas; consentimiento para fotos de terceros, retención/legal hold, auditoría de uso y derivados IA/3D. Reconstrucciones no suponen autorización de aprobación o pago.

## Estado de utilidades

El verificador field-memory-evidence-reconcile.mjs compara el manifest privado con una proyección privada exportada de Evidence del siguiente esquema conceptual (NO compartir datos reales):
schema semse-evidence-backup-projection-v1; records: id, tenantId, projectId, bucketKey, checksum.

La herramienta falla cerrado ante checksum nulo, archivo faltante, duplicados, claves legacy sin alcance y tenant discordante. Incluso al coincidir los metadatos, su salida mantiene checksumAuthorityVerified=false, organizationPolicyVerified=false y captureSessionActivationPermitted=false hasta que esas garantías estén comprobadas del lado servidor.

**No hace SQL**, no autentica a un usuario y no valida un snapshot de Postgres por sí sola. Exportar la proyección solo desde una sesión privilegiada de lectura, en transacción consistente, a disco cifrado fuera de GitHub. El siguiente PR de runtime debe implementar el hash del servidor, validación de bytes/ownership y pruebas reales multi-tenant antes de activar CAP-1.

**Referencias:** docs/specs/evidence/field-memory-capture-session.spec.md, docs/specs/platform/signed-file-access.spec.md, docs/runbooks/FIELD_MEMORY_STORAGE_PREFLIGHT.md, docs/architecture/ADR-043-write-once-storage-originals.md.
