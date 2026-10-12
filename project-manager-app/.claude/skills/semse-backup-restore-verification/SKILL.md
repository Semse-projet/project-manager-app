---
name: semse-backup-restore-verification
description: "Verificar respaldos y restauración aislada de PostgreSQL, Evidence y archivos originales mediante inventarios, hash SHA-256, consistencia y pruebas negativas sin tocar datos productivos."
---

# SEMSE — Backup & Restore Verification
**Versión:** 1.0.0 | **Ámbito:** validación de recuperabilidad de datos y cadena de custodia; complementa `semse-upload-flow`, `semse-prisma-workflow` y `semse-security-baseline`.

## Activación
Usar cuando haya backups de Railway, originales de fotos/video, Evidence, CaptureSession, restauración, DR, comparación SHA-256, RPO/RTO o reconciliación entre BD y almacenamiento.

## Autoridad y límites
- Antes de actuar, leer `project-manager-app/AGENTS.md`, la constitución, `docs/SPEC_INDEX.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/foundation/DOMAIN_INVARIANTS.md` y la spec del dominio correspondiente.
- `semseproject` y `semse-spec-kit-flow` gobiernan permisos, aprobaciones, trazabilidad y secuencia SDD. Esta skill no concede permisos de merge, gastos, pagos, secretos, escrituras en producción ni bypass de CI.
- Comprobar GitHub HEAD, branch, PRs concurrentes, specs, contratos, rutas reales y Railway antes de cambiar archivos. Elegir REUSE → EXTEND → ADAPT → CONSOLIDATE → NEW.
- Trabajar en rama y PR borrador; no modificar producción ni datos de terceros por implicación. Registrar incertidumbres como UNVERIFIED, no como éxito.
- Diferenciar: diseño ≠ código ≠ tests ≠ CI ≠ merge ≠ deploy ≠ activation ≠ piloto real.

## 1. Diferenciar niveles de evidencia
- **Volumen montado ≠ backup.** Nombre de snapshot ≠ posibilidad probada de restauración; `SUCCESS` de Railway ≠ recuperación de datos.
- **Fixture sintético ≠ backup productivo restaurado.** Un hash coincidente ≠ permisos/metadata/historial correctos. Copiar originales a un bucket sin verificación no establece custodia.
- Documentar fuente real, método de captura, política de retención/cifrado, fecha de punto de recuperación, RPO, RTO y custodia de credenciales; no imprimir claves o rutas que revelen datos privados.

## 2. Precondiciones de restauración real
1. Identificar snapshot/backup externo con su ID, fecha, entorno de origen, inventario DB y originales, retención y controles de acceso.
2. Requiere entorno DESTINO AISLADO, sin conexiones a proveedores de pagos, firmas o correo real y sin escritura posible a producción; verificar DNS/variables/nombres de DB antes de cargar datos.
3. Obtención de autorización puntual para restauración o exportación que implique datos reales, migraciones, secretos, volúmenes o riesgo irreversible. Por defecto ejecutar solo preflight no destructivo.
4. Minimizar PII y evitar transportar originales a máquinas sin controles adecuados; compartir solo resultados agregados.
5. Revisar `docs/runbooks/FIELD_MEMORY_STORAGE_PREFLIGHT.md`, `scripts/field-memory-storage-preflight.mjs` y `scripts/field-memory-originals-restore-drill.mjs` antes de inventar otro mecanismo.

## 3. Prueba sintética segura
- Crear fixture con original binario, hash SHA-256, tamaño, mediaType, tenant/org, `EvidenceId`/`CaptureSessionId` ficticios, y un manifiesto inmutable.
- Copiar el fixture a una ruta efímera distinta y comparar conteo, tamaño y SHA-256; simular alteración/archivo ausente/extra y exigir `FAIL`.
- Validar que `--fixture` solo acredita algoritmo de comparación: emitir `syntheticRestoreDrill=true`, `actualRailwayBackupVerified=false`.
- Borrar exclusivamente el directorio temporal creado por el test, sin apuntar rutas de origen productivas.

## 4. Restauración controlada de originales y PostgreSQL
- Confirmar que los snapshots DB y objeto/volumen pertenecen al mismo punto temporal; anotar desviaciones.
- Restaurar en aislamiento, verificar esquema/migraciones, claves foráneas, ownership, índices, relaciones Job→Project→Evidence, blobs y versiones sin crear pagos.
- Comparar `manifest` contra los originales restaurados: `expectedFiles`, `matchedFiles`, `missingFiles`, `alteredFiles`, `unexpectedFiles`. Requerir coincidencia exacta, ningún faltante/alterado/extra y una `SHA-256` por original.
- Probar lectura autorizada y rechazo de lectura por otra organización (403/404), vigencia de enlaces, legal hold y política de retención en un entorno que no entregue archivos a externos.
- Medir tiempo real de recuperación (RTO) y antigüedad de snapshot (RPO); reportar ambas cifras o `UNVERIFIED`.

## 5. Resultado verificable
Salida: `backupRef | snapshotAt | restoreEnv | checkedAt | dbConsistency | expected | matched | missing | altered | unexpected | tenantAuth | RPO | RTO | evidenceRef | status`.
Estados: `SYNTHETIC_HASH_TEST_PASSED` para fixture; `ISOLATED_RESTORE_VERIFIED` solo para snapshot real restaurado con conciliación de DB y originales; `PENDING_REAL_RESTORE` si falta cualquiera.
No activar captura tridimensional/CaptureSession real ni declarar originales recuperables hasta el gate de restauración aislada adecuado.
