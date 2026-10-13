# Field Memory — control de recuperación independiente (2026-10-13)

**Proyecto:** SEMSEproject / production
**Feature:** CaptureSession CAP-0 (spec aprobada; runtime inactivo)
**Estado:** TOOLING PREPARADO / RESTORE REAL PENDIENTE

## Estado comprobado

- PR #874 MERGED en `main`; incluye scripts de SHA-256 y runbook. Su CI terminó en SUCCESS.
- Railway production (13-oct-2026): `semse-API` SUCCESS, volumen `project-manager-app-volume` 5000 MB montado en `/data`; sin cambios staged. Railway OAuth devuelve nombres de variables, no valores reales.
- Propietario informó que creó backups e incluyó el volumen de originales. No se ha accedido a los identificadores ni a su estado COMPLETED por carecer de herramienta de lectura de backups.
- Railway restaura snapshots del volumen en el mismo proyecto/entorno sustituyendo montaje en servicio; no se ha seleccionado Restore ni modificado volumen de producción.
- La conexión actual no ejecuta comandos SSH ni lee bytes de un volumen remoto; no consta recuperación real de fotografías.

## Mejoras preparadas en este PR

1. `scripts/field-memory-source-inventory.mjs`: inventario read-only de nombres relativos, tamaño y SHA-256 directamente desde los originales del contenedor API (con una ventana sin escrituras). Rechaza fuente fuera de /data, symlinks, staging multipart y modificaciones detectadas.
2. `scripts/field-memory-offsite-restore-rehearsal.mjs`: exige manifest fuente previo, valida exportación cifrada, copia a directorio efímero separado y vuelve a comparar hashes y recuentos. Limpia la copia temporal y genera informe agregado.
3. El runbook `FIELD_MEMORY_STORAGE_PREFLIGHT.md` incluye comandos SSH/SCP de Railway, precondiciones de cifrado, exclusión de escritura sobre producción y criterio PASS.
4. 13 pruebas locales sintéticas de la lógica de ensayo y CLI con interfaz de verificación representativa, todas PASS. La integración sobre el verificador de `main` queda sujeta al CI del PR (no confundir ambas verificaciones).

## Gates estrictos

- [ ] Confirmar ID, estado COMPLETED, fecha y retención del backup específico de `project-manager-app-volume`.
- [ ] Confirmar en Railway el valor real de SEMSE_STORAGE_ROOT y una ventana coherente sin uploads.
- [ ] Obtener manifiesto desde el origen y una exportación privada cifrada en repositorio **fuera de /data**.
- [ ] Restaurar esa exportación en directorio aislado cifrado, hashes y tamaños idénticos con número de archivos mayor que cero.
- [ ] Reconciliar referencias de Evidence y base Postgres con la misma ventana, verificar límites tenant/Org y política de retención/legal hold.
- [ ] Validar por separado capacidad real de recuperar un backup gestionado de Railway sin experimentar sobre la API productiva.

## Definición precisa de conclusión

`CI SUCCESS` no implica recuperabilidad real. `OFFSITE_EXPORT PASS` valida solo una copia independiente, no un snapshot gestionado por Railway. Hasta tener pruebas de recuperación y correlación DB/Evidence, **no declarar CAP-1 VERIFIED ni activar CaptureSession/3D para originales de clientes**.

Fuente proveedor: https://docs.railway.com/cli/ssh y https://docs.railway.com/volumes/backups
