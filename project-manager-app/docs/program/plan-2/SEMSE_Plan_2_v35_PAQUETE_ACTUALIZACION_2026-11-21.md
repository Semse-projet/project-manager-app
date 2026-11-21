# SEMSE — Plan 2 «Preservación de datos y linaje» · Paquete de actualización v34 → v35

**Fecha de ejecución:** 2026-11-21 · **Preparado por:** agente técnico de ejecución (sesión Claude Code) · **Estado de este documento:** BORRADOR PARA EL PROPIETARIO — no aprobado, no fusionado en el plan.

> ## Aviso de autoridad — leer primero
>
> El contrato de trabajo es `SEMSE_Plan_2_Preservacion_Datos_Linaje.md` **v34 (modificado 2026-11-20)**. **Ese archivo no estuvo accesible en esta sesión**: no está en el repositorio `Semse-projet/project-manager-app` (rama `claude/plan-2-preservacion-datos-linaje-c53u3e`, HEAD `86c0be5`), ni en las cargas de la sesión (`/mnt/user-data/uploads` vacío), ni en Google Drive (búsquedas por título y texto), ni entre los artifacts del usuario. Tampoco fueron accesibles los Planes 0, 1, 3, 4, 6 y 11, el respaldo JSON (SHA-256 `821f55d1…b357`), las dos exportaciones JSON, el CSV ni el Site v4/v6.
>
> Por eso este documento **no es el plan íntegro v35** y no reproduce ni reescribe el contenido de v34. Es el conjunto de cambios, evidencias, matriz y conclusiones que el propietario debe incorporar sobre v34 para producir v35. Los identificadores `P2-…` de la matriz son provisionales: hay que mapearlos a los IDs de v34. Nada aquí declara el plan aprobado ni cerrado.

---

## 1. Procedencia de la ejecución

| Elemento | Valor |
|---|---|
| Repositorio | `Semse-projet/project-manager-app` (raíz canónica `project-manager-app/`) |
| Rama | `claude/plan-2-preservacion-datos-linaje-c53u3e` |
| HEAD al iniciar | `86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f` (2026-11-20, «feat(mobile): perfil EAS pilot… (#1167)»), idéntico a `origin/main` en el clon superficial de esta sesión |
| Estado del árbol al iniciar | limpio (`git status --short` vacío) |
| Entorno | contenedor efímero de Claude Code en la nube, Linux, Node `v22.23.5`; sin acceso a Railway, sin sesión autenticada en SEMSE, sin datos de producción |
| Fecha UTC | 2026-11-21 |

### 1.1 Fuentes consultadas (solo lectura)

| Fuente | Versión / identificador | Uso |
|---|---|---|
| `apps/api/src/modules/labor-engine/labor-engine.controller.ts` | blob `41d967a1` | rutas de lectura de TimeEntry (bloque C) |
| `apps/api/src/modules/labor-engine/labor-engine.repository.ts` | blob `8237b66e` | filtros, orden y paginación de TimeEntry; cálculo de `durationMinutes` (bloques A y C) |
| `apps/api/src/common/parse-query.ts` | blob `505c94aa` | `limit` sin tope superior (C) |
| `apps/web/app/(app)/worker/tracker/sections/trackerUi.tsx` | blob `537eaaa1` | cómo suma la interfaz la duración (A, diferencia de 120 s) |
| `packages/db/prisma/schema.prisma` | blob `147d5ad1` | modelos `TimeEntry`, `TimeEvidence`, `Evidence` (D) |
| `docs/specs/labor/personal-record-export.spec.md` | blob `b47ee172`, `status: DRAFT` | contrato de exportación (C) |
| `docs/reportes/2026-10-24_worker-personal-export-as-is.md` | en HEAD | inventario previo F1-H01…H07 (C), **histórico** |
| `docs/runbooks/BACKUP_RESTORE.md`, `docs/reportes/2026-10-12_f07_primer_drill_restore_postgres.md`, `docs/reportes/2026-10-13_field-memory-offsite-recovery-gates.md`, `scripts/field-memory-offsite-restore-rehearsal.mjs` | `BACKUP_RESTORE.md` último commit `c64d01c5` | procedimiento y gates candidatos de recuperación (E), **histórico** |
| `.claude/skills/semse-backup-restore-verification/SKILL.md` | en HEAD | criterios de nivel de evidencia (E) |
| Google Drive, carpeta privada `15_RESPALDO_GITHUB_Y_RAILWAY` (`1P2TL-YxZv_YSy-3gc0LMixiz4LYvYfsh`) | `INFORME_RESPALDO_INTEGRAL_SEMSE_2026-11-05.md` (mod. 2026-11-06T00:23:37Z), `LEEME_RESPALDO_SEMSE_2026-11-05.md` (mod. 2026-11-06T00:23:53Z), metadatos y fragmento inicial de `SEMSE_DATOS_MANIFIESTO_2026-11-05.json` (mod. 2026-11-06T00:23:32Z, visibilidad PRIVATE) | candidato de evidencia de respaldo/restore (E). **No** se descargaron ni abrieron el dump de PostgreSQL, el RDB, el tar del volumen ni los zip |

### 1.2 Fuentes no accesibles (no se infirió su contenido)

`SEMSE_Plan_2_Preservacion_Datos_Linaje.md` v34 · Planes 0, 1, 3, 4, 6, 11 · respaldo JSON `821f55d1…b357` · dos exportaciones JSON · CSV · Site publicado v4 y vista previa v6 · kit v4→v6 · capturas de interfaz con totales/Excepciones · panel `Backups` de Railway.

---

## 2. Cabecera propuesta para v35

| Campo | Propuesta |
|---|---|
| Versión | 35 |
| Fecha | 2026-11-21 |
| Estado documental | Actualizado con evidencia de 2026-11-21; **pendiente de revisión y aprobación del propietario** |
| Estado operativo | **ABIERTO**: ningún gate operativo cerrado en esta versión; ver matriz §5 |

### 2.1 Entrada de historial propuesta

> **v35 — 2026-11-21.** Revalidación estática en `main@86c0be5`: confirmado que no existe extracción organizacional exhaustiva de TimeEntry (C) y que el modelo de datos no enlaza `TimeEvidence` con `Evidence` (D). Añadidos verificadores reproducibles de solo lectura (`scripts/plan2/*`) con 9 pruebas sintéticas PASS. Identificada en código la regla de suma de la interfaz (`durationMinutes·60` truncado por fila) como **hipótesis verificable** de la diferencia de 120 s, sin cerrarla. Registrado como candidato —no verificado— el respaldo 2026-11-05 en Drive para Plan 11/O11-10. Sin acceso en esta ejecución a v34, al respaldo JSON, al CSV ni al Site: A y B quedan sin reproducción nueva.

---

## 3. Resultados por bloque

### A. Paquete de preservación

**Hecho en esta ejecución**
- Verificador reproducible `scripts/plan2/verify-preservation-package.mjs` (v1.0.0): lee cada original una sola vez en modo `r`, calcula SHA-256 y parsea **desde los mismos bytes**; compara hashes esperados; exige que las exportaciones declaradas distintas sigan separadas por hash (`mustRemainDistinct`); coteja IDs y duraciones JSON↔CSV con tolerancia declarada; cuenta y **preserva** las filas sintéticas sin sumarlas; informa —sin atribuir causa— la diferencia entre el total de interfaz y la suma laboral; vuelve a verificar tamaño, `mtime` y hash al terminar (`ORIGINAL_CHANGED_DURING_RUN` ⇒ FAIL). Rechaza escribir el reporte sobre un original o en su mismo directorio y nunca sobrescribe (`flag: 'wx'`).
- Pruebas sintéticas: `tests/unit/plan2-preservation-tools.test.mjs`, 9/9 PASS con `node --test` (Node v22.23.5) en 2026-11-21. Cubren: PASS con tolerancia de 24 s y sintético excluido; FAIL por hash alterado; FAIL si dos exportaciones son idénticas; FAIL por diferencia CSV fuera de tolerancia; parseo CSV con comillas/CRLF/BOM; sumas alternativas.
- Prueba de CLI con fixture sintético: rechazo `exit=2` al intentar escribir en el directorio de originales; `PASS exit=0` con salida en directorio separado.

**No hecho (falta acceso)**
- **No** se reprodujo el SHA-256 `821f55d1…b357`, la separación de las dos exportaciones, ni el cotejo de 20 IDs: los archivos no estaban en la sesión. Esos resultados siguen siendo **evidencia histórica** de una ejecución anterior.

**Hallazgo de código relevante para la diferencia de 120 s (hipótesis, no causa)**
- Servidor: al detener un temporizador, `durationMinutes = Math.floor(totalSeconds / 60)` y `accumulatedSeconds = totalSeconds` (`labor-engine.repository.ts`, `stopTimeEntryInternal`). En entrada manual, `durationMinutes = floor((endedAt − startedAt)/60000) − breakMinutes`.
- Interfaz: `entrySeconds()` usa `durationMinutes · 60` cuando existe y solo recurre a `accumulatedSeconds` si `durationMinutes` es nulo (`trackerUi.tsx`); `fmtHours` redondea a 0,01 h (36 s). Filas locales `pending_sync` usan `Math.round(seconds/60)`.
- Consecuencia: un total de interfaz puede diferir de la suma en segundos hasta 59 s por fila (15 filas ⇒ hasta 885 s), más el redondeo de presentación y la posible mezcla de filas `pending_sync` o de otro propósito. **Esto no demuestra la causa** de los 120 s; solo define qué medir.
- **Siguiente acción verificable:** ejecutar el verificador sobre el respaldo preservado con `alternativeDurations = [{field:"durationMinutes", unit:"minutes", fallbackField:"accumulatedSeconds"}]` y `expect.uiTotalSeconds = <total de interfaz capturado>`. Si `uiMinusThisSeconds = 0` para la regla de la interfaz, la hipótesis queda **corroborada**; para cerrarla además hace falta la captura de la vista (fecha, filtros, periodo, propósito, presencia de `pending_sync`) que produjo el total.

**Límites que se mantienen visibles:** hash igual = mismos bytes, no autenticidad del origen ni exactitud laboral; la fila `synthetic` se preserva y no es trabajo registrado; el verificador no deduplica, no combina y no clasifica.

### B. Discrepancia del Site (Excepciones 0 frente a 2) y kit v4→v6

**Hecho:** herramienta `scripts/plan2/diff-site-collections.mjs` que compara dos exportaciones de colecciones por clave, enumera sólo-en-v4, sólo-en-v6, idénticos y **colisiones con hash de ambas versiones y campos que difieren**; cuenta claves duplicadas y registros sin clave como no resueltos; opción `--count "<colección>:<campo>=<valor>"` para contrastar filtros de vista; los cuerpos de ambas versiones solo se escriben si se pide `--bodies-out`, en archivo aparte. Veredicto `COLLISIONS_UNRESOLVED_DO_NOT_IMPORT` si queda cualquier conflicto. No publica, no importa, no resuelve.

**No hecho (falta acceso):** no se inspeccionó el Site publicado v4 ni la vista previa v6; no hay exportación de colecciones ni sesión autenticada. La diferencia de Excepciones **sigue abierta**; no se cierra por inferencia. El kit v4→v6 **se mantiene bloqueado** para publicar, importar o combinar.

### C. Comparación con TimeEntry

Verificado estáticamente en `main@86c0be5` (`node scripts/plan2/static-evidence.mjs`, salida en `static-evidence_2026-11-21.json`):

| Control | Resultado | Evidencia |
|---|---|---|
| C-01 `GET /v1/labor/entries` filtra `createdBy = a.userId` (ruta personal) | HOLDS | `labor-engine.controller.ts:296` |
| C-02 sin `cursor`/`offset` en la query de esa ruta | HOLDS | sección `@Get("entries")` |
| C-03 `limit` sin tope superior (`parsePositiveInt`) | HOLDS | `parse-query.ts:7` |
| C-04 orden solo por `startedAt`, sin desempate por `id` | HOLDS | `labor-engine.repository.ts:346` |
| C-05 `listTimeEntries` filtra por `tenantId`, no por `orgId` | HOLDS | `labor-engine.repository.ts:319` |
| C-06 vistas admin acotadas a la semana con `take: 50` | HOLDS | `labor-engine.repository.ts:444` |
| C-07 `labor.personal-record-export` en `DRAFT` | HOLDS | spec `:7` |

Otros lectores revisados: `daily-reports.service.ts` (por crew/día, `orgId` + miembros, no exportación), `field-ops.repository.ts` (por `createdBy`, `purpose: job_linked`, `take`), `geofence` y `labor-policy` (`findFirst`). **Conclusión: no existe contrato aprobado ni ruta que permita extracción autorizada, exhaustiva, estable y paginada por organización.** La ruta personal y un `limit` grande no son sustitutos. No se implementó ninguna ruta (fuera de alcance de Plan 2).

**Criterio de reanudación (lo debe aportar el plan responsable del contrato de API/permisos, Plan 3 o 4 según v34):**
1. Spec SDD aprobada para extracción organizacional (no la personal), con autoridad de negocio y legal para su uso.
2. Alcance explícito actor → tenant → org → persona(s), con permiso dedicado y auditoría (`EVENT_CATALOG.md`).
3. Paginación por cursor con orden total estable (`startedAt, id`) y desempate determinista.
4. Corte consistente (snapshot o `asOf` + `updatedAt ≤ asOf`) documentado frente a escrituras concurrentes.
5. Conteo total del corte devuelto y reconciliable con la suma de páginas.
6. Pruebas negativas: otro usuario del mismo tenant, otra org, otro tenant ⇒ 403/404 neutro sin datos; usuario sin permiso ⇒ 403.
7. Ejecución en entorno autorizado de solo lectura, con evidencia de SHA desplegado y resultados de las pruebas.

### D. Evidence y custodia

- Referencias en respaldos: según el estado conocido, el respaldo no contiene IDs de Evidence; **no se pudo re-verificar** porque el archivo no estaba accesible. No se enumeró Evidence ni se abrió ningún binario.
- Modelo de datos (`schema.prisma`, blob `147d5ad1`): `TimeEvidence` **no tiene FK a `Evidence`** (D-01), **no tiene `tenantId`** propio (D-02), **no tiene checksum ni versionado** (D-03); solo `fileUrl` libre. `Evidence.checksum` es opcional (D-04). Ningún código de `apps/` o `packages/` lee o escribe `prisma.timeEvidence` (D-05).
- Consecuencia: la relación completa `TimeEntry`–`TimeEvidence`–`Evidence` **no existe en el esquema**; aunque apareciera una referencia, no habría ownership doble caso/objeto demostrable por el modelo. Existen rutas `GET v1/evidence/:evidenceId`, `v1/jobs/:jobId/evidence` y `v1/projects/:projectId/evidence` con `evidence:read`, pero su uso para Plan 2 requiere primero lo que sigue.
- **Bloqueo coordinado con Plan 6** (sin cambiar su alcance): Plan 6 debe aportar decisión de ownership, relación canónica (FK o tabla de enlace con tenant/org), DTO allowlist de metadatos, checksum obligatorio/versionado y política de retención; y evidencia de prueba de doble autorización caso/objeto con negativos. Hasta entonces: **no leer bytes**.

### E. Recuperación aislada (coordinación con Plan 11 / O11-10)

- Procedimiento vigente: `docs/runbooks/BACKUP_RESTORE.md` (drill aislado sí; `Restore` nativo de Railway en producción **prohibido** como prueba). Herramientas existentes: `scripts/backup/pg-restore-drill.sh`, `scripts/field-memory-offsite-restore-rehearsal.mjs`, `scripts/field-memory-source-inventory.mjs`.
- Historia: drill de PostgreSQL 2026-10-12 (`PARTIAL`, 8/8 conteos, dump destruido, no es punto recuperable).
- **Candidato nuevo, no verificado por esta sesión:** carpeta privada de Drive con respaldo del 2026-11-05 (commit `645ce3b8`): dump PostgreSQL 20 933 554 B, SHA-256 `25f7593c…879d`; RDB 2 538 099 B, `735d49db…0b96`; tar del volumen `/data` 13 062 306 B, `a6f65133…0445`. El informe —redactado por una ejecución anterior— declara restauración aislada de PostgreSQL (218 tablas, 266 178 filas), Redis (254 claves, 249 vigentes) y cotejo SHA-256 de 6 archivos del volumen. Capturas no atómicas entre sistemas (23:57:18–23:57:33 UTC). **Es autodeclarado**: esta sesión no descargó ni restauró nada.
- Observaciones de custodia para Plan 11 (sin acción tomada): la visibilidad PRIVATE de Drive no equivale al «destino cifrado» que pide el runbook para dumps con PII y pagos; falta registro de operador, ventana sin nuevas cargas y autorización vinculada; la copia es anterior al estado actual y no constituye backup programado ni RPO/RTO.
- Faltan para ejecutar la prueba no destructiva desde Plan 2: operador designado, autorización puntual, ventana sin nuevas cargas, copia de origen identificada con digest, destino aislado y cifrado, y manifiesto previo de originales. **No se ejecutó ningún restore.** O11-10 **no se cierra** por inferencia.

---

## 4. Dependencias y responsables

| Dependencia | Plan responsable | Qué debe aportar | Criterio comprobable para reanudar Plan 2 |
|---|---|---|---|
| Texto vigente del Plan 2 v34 y Planes 0/1 | Propietario | Archivo v34 y fuentes de arquitectura/gobierno que cita | Archivo disponible con fecha y hash; IDs `P2-…` mapeados |
| Extracción organizacional de TimeEntry | Plan 3 o 4 (según v34) | Spec aprobada + ruta autorizada (§3.C) | Los 7 puntos del criterio C con evidencia de entorno autorizado |
| Ownership/relación/retención de Evidence | Plan 6 | Decisión + modelo canónico + DTO + checksum + retención | Esquema con FK/tenant, pruebas de doble autorización y negativos |
| Backup/restore aislado (O11-10) | Plan 11 | Prueba aislada aprobada sobre copia identificada, destino cifrado | Inventario/tamaños/hashes, faltantes/inesperados = 0, resultado firmado por el operador |
| Site v4/v6 y kit | Propietario del Site | Exportaciones de colecciones v4 y v6, capturas de vistas con filtros/periodo | `diff-site-collections` sin colisiones o decisión humana por colisión |

---

## 5. Matriz final de pendientes

Estados: **demostrado** · **pendiente** · **bloquea** · **requiere revisión humana** · **mantener bloqueado**. Fecha de la evidencia: 2026-11-21 salvo indicación. Entorno: contenedor de sesión, `main@86c0be5`, sin producción.

| ID prov. | Pendiente | Estado | Evidencia concreta y fecha | Fuente / versión / entorno | Dependencia y responsable | Siguiente acción verificable | Criterio de cierre |
|---|---|---|---|---|---|---|---|
| P2-A1 | SHA-256 del respaldo JSON `821f55d1…b357` | pendiente | Histórica (ejecución previa); no reproducida hoy: archivo no accesible | — | Propietario: facilitar copia de trabajo | `verify-preservation-package` con `expectedSha256` | Reporte PASS con `hashMatches: true` y comando/versión registrados |
| P2-A2 | Dos exportaciones JSON separadas por hash | pendiente | Histórica; no reproducida | — | Propietario | `mustRemainDistinct` en el manifiesto | Sin `EXPORTS_NOT_DISTINCT`; hashes de ambas listados |
| P2-A3 | Cotejo 20 IDs/duraciones JSON↔CSV; diferencia de precisión de 24 s explicada | pendiente | Histórica; tolerancia soportada y probada con fixture (9/9 PASS) | `scripts/plan2/verify-preservation-package.mjs` 1.0.0, Node 22.23.5 | Propietario | Ejecutar con `toleranceSeconds: 24`, `expect.comparedIds: 20` | `compared = 20`, `mismatched = []`; la explicación de 24 s documentada con su fuente |
| P2-A4 | Diferencia de 120 s total de interfaz vs 15 filas `payable` | requiere revisión humana | Hipótesis de código 2026-11-21: UI suma `durationMinutes·60` (truncado `floor`) y redondea a 0,01 h | `trackerUi.tsx` blob `537eaaa1`; `labor-engine.repository.ts` blob `8237b66e` | Propietario: captura de la vista con total, filtros y periodo | Ejecutar `alternativeDurations` con `expect.uiTotalSeconds` | Regla de la UI reproduce el total exacto **y** la captura confirma filtros/filas; si no, sigue sin causa |
| P2-A5 | Fila `synthetic` preservada y excluida | pendiente (reproducción) | Verificador la cuenta y no la suma (prueba sintética) | idem A3 | Propietario | `syntheticMarker` + `expect.syntheticRecords: 1` | `syntheticPreserved = 1` y `laborRecords = 15` sobre el respaldo |
| P2-B1 | Excepciones 0 vs 2 entre vistas | bloquea | Sin acceso a Site ni sesión | — | Propietario del Site | Exportar ambas vistas/colecciones; `--count` con el filtro de cada vista | Diferencia explicada por filtro/alcance documentado con captura y conteo reproducible |
| P2-B2 | Verificar vista previa v6 | bloquea | Sin acceso | — | Propietario del Site | Exportación v6 de solo lectura | Versión, fecha y conteos de v6 registrados |
| P2-B3 | Colisiones v4↔v6 por colección | mantener bloqueado | Herramienta lista y probada (sintético) | `scripts/plan2/diff-site-collections.mjs` | Propietario del Site | Ejecutar diff con `--bodies-out` en almacenamiento controlado | `NO_COLLISIONS` o decisión humana registrada por colisión, conservando ambas versiones |
| P2-B4 | Publicar/usar kit v4→v6 para importar o combinar | mantener bloqueado | Depende de B1–B3 | — | Propietario | Ninguna hasta cerrar B3 | B3 cerrado + aprobación explícita |
| P2-C1 | Comparación del respaldo con TimeEntry (extracción organizacional exhaustiva) | bloquea | Controles C-01…C-07 HOLDS, 2026-11-21 | `static-evidence_2026-11-21.json`, `main@86c0be5` | Plan 3/4: contrato y ruta | Ver criterio §3.C | Los 7 puntos demostrados en entorno autorizado de solo lectura |
| P2-C2 | No usar ruta personal ni `limit` grande como sustituto | demostrado (como regla) | C-01, C-03, C-04 HOLDS | idem | — | Re-ejecutar `static-evidence` en cada revisión | Regla vigente mientras C1 siga abierto |
| P2-D1 | Referencias concretas de Evidence en el respaldo | requiere revisión humana | Estado previo: ninguna; no re-verificado hoy | — | Propietario | Búsqueda de claves de Evidence en la copia de trabajo, sin abrir binarios | Resultado registrado (sí/no) con hash del archivo inspeccionado |
| P2-D2 | Relación `TimeEntry`–`TimeEvidence`–`Evidence`, ownership doble, DTO, checksum, retención | bloquea | D-01…D-05 HOLDS: sin FK, sin tenant, sin checksum, sin uso en código | `schema.prisma` blob `147d5ad1` | Plan 6 | Plan 6 publica decisión y modelo | Esquema y pruebas de autorización doble con negativos aprobados en Plan 6 |
| P2-D3 | Abrir/descargar binarios de Evidence | mantener bloqueado | No se abrió nada | — | Plan 6 + propietario | Ninguna | D2 cerrado + autorización explícita |
| P2-E1 | Prueba de recuperación aislada (O11-10) | mantener bloqueado | Candidato Drive 2026-11-05 autodeclarado; no verificado | Drive `1P2TL-YxZv…`, archivos mod. 2026-11-06 | Plan 11 | Plan 11 valida o repite la prueba con operador, ventana, destino cifrado | Inventario + tamaños + hashes, `missing = altered = unexpected = 0`, registro de operador y autorización |
| P2-E2 | Custodia del dump con PII en Drive | requiere revisión humana | Visibilidad PRIVATE; cifrado de destino no demostrado | metadatos Drive | Plan 11 / propietario | Decidir cifrado/retención/eliminación | Decisión registrada y aplicada por el responsable |
| P2-R1 | Fuentes de autoridad (v34, Planes 0/1/3/4/6/11) | bloquea | No accesibles en la sesión | — | Propietario | Proporcionar archivos | Archivos con fecha/hash y mapeo de IDs |

---

## 6. Solicitud única al propietario

Para continuar el trabajo de Plan 2 que depende de datos que esta sesión no tuvo, hace falta **una sola acción**: compartir en la sesión (adjunto o carpeta de Drive con acceso de lectura) **el archivo vigente `SEMSE_Plan_2_Preservacion_Datos_Linaje.md` v34 y las copias de trabajo del paquete de preservación** (respaldo JSON, las dos exportaciones JSON, el CSV y, si existen, las exportaciones de colecciones del Site v4/v6 con la captura de cada vista). Motivo: sin v34 no se puede producir el archivo íntegro v35, y sin las copias no se pueden reproducir A1–A5 ni B1–B3. Con eso, la ejecución es local y de solo lectura con las herramientas de §7. No hace falta acceso a Railway, a producción ni a Evidence.

---

## 7. Reproducción

Desde `project-manager-app/`:

```bash
# Pruebas sintéticas (sin datos reales)
node --test tests/unit/plan2-preservation-tools.test.mjs

# Evidencia estática de C y D (solo lectura del repo)
node scripts/plan2/static-evidence.mjs --out /ruta/fuera/del/repo/static-evidence.json

# Paquete de preservación (copias de trabajo; el reporte va a otro directorio)
node scripts/plan2/verify-preservation-package.mjs --manifest /copias/manifest.json --out /reportes/plan2-A.json

# Colecciones del Site v4 ↔ v6
node scripts/plan2/diff-site-collections.mjs --a /copias/site-v4.json --b /copias/site-v6.json \
  --out /reportes/plan2-B.json --bodies-out /reportes-privados/colisiones.json --count "Excepciones:<campo>=<valor>"
```

Manifiesto de ejemplo (los nombres de campo deben ajustarse a la estructura real del respaldo, que esta sesión no conoce):

```json
{
  "files": [
    { "role": "backup_json", "path": "respaldo.json", "expectedSha256": "821f55d183fbade159ee20a268aec9d90bf8714ce4bbd13292077689b1ecb357" },
    { "role": "export_a", "path": "export-1.json" },
    { "role": "export_b", "path": "export-2.json" },
    { "role": "csv", "path": "registros.csv" }
  ],
  "mustRemainDistinct": [["export_a", "export_b"]],
  "records": {
    "jsonRole": "backup_json", "recordsPath": "<ruta al arreglo>", "idField": "id",
    "durationField": "accumulatedSeconds", "durationUnit": "seconds",
    "purposeField": "purpose", "laborPurpose": "payable",
    "syntheticMarker": { "field": "<campo>", "value": "synthetic" },
    "alternativeDurations": [
      { "label": "Regla UI", "field": "durationMinutes", "unit": "minutes", "fallbackField": "accumulatedSeconds", "fallbackUnit": "seconds" }
    ]
  },
  "csv": { "role": "csv", "idColumn": "<col id>", "durationColumn": "<col duración>", "durationUnit": "seconds", "toleranceSeconds": 24 },
  "expect": { "laborRecords": 15, "syntheticRecords": 1, "comparedIds": 20, "uiTotalSeconds": "<total de interfaz>" }
}
```

Huellas SHA-256 de las herramientas entregadas (2026-11-21): `verify-preservation-package.mjs` `8ae73a74…2771`; `diff-site-collections.mjs` `65b4d540…6552`; `static-evidence.mjs` `128172f9…e9ec`; test `459697d4…e7ad`. (Si se modifican, recalcular.)

---

## 8. Conclusiones

1. **Estado documental del Plan 2:** este paquete está listo para revisión, pero el archivo íntegro v35 **no** se ha producido porque v34 no estuvo accesible. El plan **no** está aprobado; la aprobación corresponde al propietario.
2. **Estado operativo de cada gate:** A1–A5 pendientes de reproducción (evidencia histórica, herramienta lista); A4 requiere revisión humana con hipótesis verificable; B1–B2 bloquean y B3–B4 se mantienen bloqueados; C1 bloquea (confirmado en código hoy); D2 bloquea (confirmado en esquema hoy) y D3 se mantiene bloqueado; E1 se mantiene bloqueado y E2 requiere revisión humana. **Ningún gate operativo queda cerrado.**
3. **Tareas completadas:** inspección de procedencia; revalidación estática de C y D con evidencia reproducible; tres herramientas de solo lectura con 9 pruebas sintéticas PASS; hallazgo de la regla de suma de la interfaz; inventario de metadatos del respaldo candidato para Plan 11; matriz, dependencias y criterios de reanudación.
4. **Bloqueos externos y decisiones humanas:** acceso a v34 y al paquete (propietario); contrato de extracción organizacional (Plan 3/4); modelo de Evidence (Plan 6); prueba aislada O11-10 y custodia del dump en Drive (Plan 11); exportaciones y capturas del Site (propietario del Site).
5. **Límites — no consultado ni ejecutado:** no se leyó ni cambió ningún dato de producción; no se descargaron el dump, el RDB, el tar ni los zip de Drive; no se ejecutaron migraciones, imports, restores, pagos, despliegues, publicación del Site ni cambios de permisos/flags/secretos; no se abrió Evidence; no se consultó Railway; no se verificó el estado desplegado (un hallazgo en `main` no equivale a lo que corre en Railway); no se ejecutó CI.
