# SEMSE Field Memory — evaluación de respaldo/restauración de originales

**Fecha:** 2026-10-11 · **Ambiente:** Railway `SEMSEproject / production` · **Estado final:** `PARTIAL — RESTORE NOT VERIFIED`

## Evidencia observada

| Control | Resultado | Fundamento |
|---|---|---|
| Servicio propietario de bytes | API `semse-API` | Railway describe_environment/describe_service de production |
| Volumen de originales | `project-manager-app-volume`, LIVE, 5000 MB, montado `/data` | Railway inventario live, no cambio staged |
| Montaje Web/Worker | ninguno | Railway describe_service |
| `SEMSE_STORAGE_ROOT` | configurado, valor oculto en conexión OAuth | Railway list_variables; la ruta `/data/semse-storage` solo es la **prevista** por `infra/railway/DEPLOY.md` |
| `SEMSE_MULTIPART_STORAGE_ROOT` | configurado, valor oculto | Railway list_variables; no asumir coincidencia real con mount |
| Bucket separado de objetos | no aparece en inventario production | Railway describe_environment |
| `UPLOADS_SIGNED_GET_MODE` / `UPLOADS_SIGNING_SECRET` | nombres ausentes | Railway list_variables. Default código de lectura `off` |
| Uso de disco API (24h) | aprox. 0.159 GB en metrica `DISK_USAGE_GB` | Railway get_service_metrics; no determina cantidad ni durabilidad de originales |
| Snapshots/backups reales | **UNVERIFIED** | El conector Railway no ofrece inventario de backups, ni operación segura de restore aislado |
| Restore de fotografías productivas | **NOT RUN** | No se dispone de respaldo/entorno aislado comprobados |
| Pruebas sintéticas de integridad | 8/8 PASS en ejecución aislada inicial; versión ampliada con multipart pendiente de CI exacto | prueba local aislada y tests de PR #874 |
| Cobertura tenant/org/proyecto en lectura | **UNVERIFIED** | Signed URLs y control por recurso aún requieren canary con cuentas reales |

## Resultados técnicos separados

1. **Volumen montado**: evidencia de infraestructura existente, no evidencia de backup.
2. **Verificador SHA-256**: `scripts/field-memory-originals-restore-drill.mjs`, `tests/unit/field-memory-originals-restore-drill.test.mjs`; `--fixture` usa solo imágenes sintéticas y confirma detección de corrupción.
3. **Preflight real**: `scripts/field-memory-storage-preflight.mjs` debe ejecutarse **en el contenedor API** para verificar rutas montadas, permisos y configuración. Aún no ejecutado allí.
4. **Restore real**: necesita snapshot identificado + copia en entorno aislado + inventario fuente consistente + comparación hash/tamaño/recuento, y correlación con Evidence/DB del mismo punto temporal.
5. **Producción:** no se tocó variable, volumen, backup, snapshot, registro Evidence, política financiera ni llave de firma.

## Criterio para desbloquear CaptureSession como repositorio duradero

- [ ] Backup real de originales identificado por ID y fecha, ubicación de copia independiente.
- [ ] Snapshot abarca todos los archivos referenciados por Evidence a la hora del backup; multipart transitorio excluido.
- [ ] Manifiesto privado SHA-256 generado sin divulgar keys/PII.
- [ ] Restore aislado de ese backup, verificaciones 0 alterados/0 faltantes/0 inesperados y test de revocación/autorización cross-org.
- [ ] Prueba de recuperación de referencias Evidence/Project/Job contra Postgres de ventana temporal compatible.
- [ ] Política de retención, legal hold, responsable y RPO/RTO medidos.
- [ ] Signed GET en enforce y control por recurso/Org con dos identidades reales.
- [ ] Registrar SHA de deploy y logs sin datos sensibles.

**Regla:** No marcar `VERIFIED`, no activar `CaptureSession` para originales de clientes y no ejecutar pipeline GPU para reconstrucción 3D real mientras falte el restore o la política de acceso por recurso.

**Siguiente acción operativa externa:** revisar `SEMSEproject → production → semse-API → Volumes/Backups` en Railway. Comprobar si existe backup y mecanismo de copia/restauración aislada **sin pulsar Restore sobre la API en producción**. El conector de esta conversación no puede consultar backups del proveedor; registrar resultado aquí solo después de verificación independiente.
