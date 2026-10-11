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
| Snapshots/backups reales | **DECLARADOS POR PROPIETARIO / NO INSPECCIONADOS** | El usuario informó que creó backups el 2026-10-11; falta confirmar específicamente respaldo completado del volumen `project-manager-app-volume` asociado a semse-API, fecha, retención e ID. El conector Railway no ofrece inventario de backups |
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

- [ ] Backup real del volumen `project-manager-app-volume` confirmado como COMPLETED por ID y fecha (usuario informa backups creados; alcance exacto aún por comprobar).
- [ ] Copia privada externa a `/data`, cifrada, correspondiente al mismo punto de manifiesto SHA-256; ensayo aislado de esta copia distinto del snapshot Railway.
- [ ] Snapshot abarca todos los archivos referenciados por Evidence a la hora del backup; multipart transitorio excluido.
- [ ] Manifiesto privado SHA-256 generado sin divulgar keys/PII.
- [ ] Restore aislado de ese backup, verificaciones 0 alterados/0 faltantes/0 inesperados y test de revocación/autorización cross-org.
- [ ] Prueba de recuperación de referencias Evidence/Project/Job contra Postgres de ventana temporal compatible.
- [ ] Política de retención, legal hold, responsable y RPO/RTO medidos.
- [ ] Signed GET en enforce y control por recurso/Org con dos identidades reales.
- [ ] Registrar SHA de deploy y logs sin datos sensibles.

**Regla:** No marcar `VERIFIED`, no activar `CaptureSession` para originales de clientes y no ejecutar pipeline GPU para reconstrucción 3D real mientras falte el restore o la política de acceso por recurso.

**Actualización del propietario 2026-10-11:** informó que ya creó backups. No confirma cuáles servicios/volúmenes, fecha exacta ni estado terminal; por eso los originales continúan RESTORE NOT VERIFIED. **Railway restaura un snapshot de volumen solamente dentro del mismo proyecto/entorno y cambia el volumen de servicio cuando se confirma Deploy**; no sirve como ensayo de restore aislado sin intervenir producción. Fuente: https://docs.railway.com/volumes/backups. **Siguiente acción segura:** verificar la entrada completada de backup en `SEMSEproject → production → semse-API → Backups` sin pulsar Restore; luego aprobar una copia cifrada independiente y realizar restore aislado de esa copia. No marcar el backup de Railway como restaurado por el ensayo de la copia externa.
