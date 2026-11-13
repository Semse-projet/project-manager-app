# T-008i — Evidence/PostgreSQL snapshot de solo lectura en staging

**Estado: implementación aislada; no operada todavía en Railway.** Complementa [T-008 staging](FIELD_MEMORY_T008_ISOLATED_STAGING.md) y [issue #954](https://github.com/Semse-projet/project-manager-app/issues/954).

## Contrato implementado

`readFrozenEvidenceProjection(prisma, {scope,expectedEpoch,env})` vive en `apps/api/src/infrastructure/storage/field-memory-evidence-snapshot.ts`. No está registrado como proveedor Nest ni expuesto en controladores o jobs productivos.

La lectura solo puede ejecutarse con `SEMSE_STORAGE_WRITE_GATE_MODE=staging` y sin los marcadores de producción `NODE_ENV`, `RAILWAY_ENVIRONMENT`, `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_PROJECT_ID` o `RAILWAY_ENVIRONMENT_ID` reales. **Limitación temporal obligatoria:** hasta que exista verificación independiente de la identidad de PostgreSQL y del volumen staging, esta implementación solo permite PostgreSQL CI efímero `127.0.0.1:5433/semse` (usuario `semse`, `CI=true`). **Rechaza cualquier ejecución bajo Railway**, incluso un entorno llamado `staging`. Nombrar un entorno distinto no garantiza que no comparta la conexión de PostgreSQL productiva. Una futura fase de habilitación necesitará acreditación de aislamiento, un mecanismo de autorización del operador y nuevas pruebas antes de permitir la lectura privada.

Dentro de **una transacción PostgreSQL `REPEATABLE READ`**:

1. Bloquea la fila de `StorageWriteGate` mediante `FOR SHARE` para impedir un `THAW` concurrente durante la lectura. Requiere `FROZEN`, epoch esperado y un digest de cobertura de 64 caracteres hexadecimales.
2. Comprueba **0 operaciones ACTIVE** y la presencia de auditoría `MARK_FROZEN` para esa época. Ni el digest ni la auditoría sustituyen una verificación externa de la identidad de cada writer.
3. Obtiene una proyección privada de `Evidence` (ID, tenant, proyecto, clave y checksum) y verifica contra `Project.tenantId`. El límite duro de 200,000 filas prohíbe truncamientos silenciosos.
4. Cuenta checksums ausentes, claves inseguras/legacy, claves duplicadas y discrepancias entre tenant del registro, ruta y proyecto. Una proyección vacía se clasifica como **BLOCKED**.
5. Devuelve `DB_PROJECTION_ONLY` si no detecta esas inconsistencias. Nunca responde `BACKUP_PASS`, `FROZEN_VERIFIED` ni permiso para activar CaptureSession.

## Confidencialidad

`privateProjection.records` contiene identificadores de proyectos, tenants y claves de almacenamiento. **Nunca** debe registrarse en stdout, HTTP, observabilidad ni adjuntarse a un PR/issue. Si una futura herramienta de operador necesita usarlo, solo debe guardarlo en almacenamiento **cifrado, de acceso restringido**, con procedencia/autorización auditable.

## Gates aún obligatorios

- Probar en staging con PostgreSQL **real** y dos procesos, incluida concurrencia `THAW` vs. `SELECT ... FOR SHARE`.
- Vincular la transacción y el epoch con la ventana consistente de hash SHA-256 del volumen, junto con el [preflight multipart del PR #986](https://github.com/Semse-projet/project-manager-app/pull/986). No se deben confundir dos lecturas hechas en instantes independientes con un snapshot atómico.
- Atestar procedencia de checksums calculados por servidor; el campo `checksum` presente en PostgreSQL no prueba por sí solo que el contenido original fue validado.
- Resolver claves legacy, originales no referenciados, Evidence sin original, sesiones multipart caducadas y writers desconocidos.
- Exportación cifrada fuera del volumen, dos inventarios concordantes, restauración en directorio aislado y cierre de ventana auditado.

**La implementación y las pruebas sintéticas no tocan Railway, ni leen fotografías de producción, ni ejecutan SQL productivo.**


## Verificación adicional de concurrencia

La prueba `field-memory-evidence-snapshot-integration.test.ts` mantiene una conexión PostgreSQL de lectura con `FOR SHARE` dentro de una transacción abierta y, desde otra conexión distinta, intenta adquirir `FOR UPDATE` con timeout. El resultado exigido es rechazo mientras la lectura está activa y éxito de `FOR UPDATE` después del commit de la proyección. Este ensayo únicamente demuestra **fencing de la fila del gate**, no inmovilidad del filesystem, autenticidad de las evidencias ni ausencia de escritores ajenos.

El checkpoint también rechaza claves de almacenamiento no canónicas: segmentos vacíos, `.`, `..`, claves absolutas, separadores Windows, rutas sin archivo y longitudes excesivas. Una ruta inválida bloquea `DB_PROJECTION_ONLY`, sin emitir los identificadores afectados en registros de CI.


## T-008j — comparación offline con digest de proyección

El comando de reconciliación offline acepta ahora opcionalmente un **envelope privado de checkpoint**, además de su modo legado `--projection`:

```bash
node scripts/field-memory-evidence-reconcile.mjs \
  --manifest /RUTA_PRIVADA/originals.json \
  --checkpoint /RUTA_PRIVADA/evidence-checkpoint.json
```

`--checkpoint` exige `FROZEN`, epoch positivo, digest de cobertura, `DB_PROJECTION_ONLY`, los cinco contadores de violaciones a cero, consistencia de transacción declarada y todos los flags de custodia inactivos. Recalcula SHA-256 sobre el JSON de `privateProjection` exactamente como lo genera el productor, exige que coincida con `projectionDigest`, y luego compara referencias contra el inventario de hashes de originales.

La salida **solo incluye contadores**; jamás claves, tenants, IDs ni hashes individuales. **Siempre sale con código 2**, incluso para `OFFLINE_CHECKPOINT_MATCH_NOT_ATTESTED`, porque todavía no hay autenticidad de origen ni constancia de que PostgreSQL, volumen y evidencia fueron inmovilizados en una ventana común. Un hash coincidente puede demostrar consistencia interna de dos artefactos, no quién los creó ni cuándo. No automatizar decisiones de thaw, escrow, CaptureSession o offsite PASS basadas en esta salida.

Los archivos privados utilizados para la comparación deben almacenarse en un directorio de acceso restringido y cifrado. Esta función no descarga datos, no consulta Railway ni PostgreSQL, y no mueve archivos.
