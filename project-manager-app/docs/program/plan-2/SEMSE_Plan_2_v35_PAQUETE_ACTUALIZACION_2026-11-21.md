# SEMSE — Plan 2 «Preservación de datos y linaje» · Paquete de actualización v34 → v35

**Fecha:** 2026-11-21 · **Revisión del paquete:** r8 · **Preparado por:** agente técnico de ejecución (sesión Claude Code) · **Estado de este documento:** BORRADOR PARA EL PROPIETARIO — no revisado, no aprobado, no fusionado en el plan.

> ## Aviso de autoridad — leer primero
>
> El contrato de trabajo es `SEMSE_Plan_2_Preservacion_Datos_Linaje.md` **v34 (revisado 2026-11-20)**. **Ese archivo no estuvo accesible en ninguna de las dos intervenciones del 2026-11-21:**
> - no está en el repositorio `Semse-projet/project-manager-app` (700 ramas remotas revisadas por nombre; ninguna de Planes 0–13) ni en los otros 4 repositorios accesibles a la sesión;
> - no se cargó en la sesión (`/mnt/user-data/uploads` vacío) ni aparece en Google Drive o en los artifacts del usuario;
> - el enlace compartido `chatgpt.com/library/share/libfile_4984…` devuelve una página vacía sin sesión y, en navegador sin sesión, un desafío de Cloudflare («Just a moment…»). **No se intentó sortearlo.**
>
> Tampoco fueron accesibles: Planes 0, 1 (su rama cerrada), 3, 4, 6, 11 y 13; el respaldo JSON (SHA-256 `821f55d1…b357`); las dos exportaciones JSON; el CSV; el Site v4/v6 y el kit v4→v6.
>
> Por eso este documento **no es el plan íntegro v35** y no reproduce ni reconstruye el contenido de v34. Es el conjunto de cambios, evidencias, matriz y conclusiones que el propietario debe incorporar sobre v34. Los identificadores `P2-…` son provisionales y deben mapearse a los de v34. Las reglas de clasificación del Plan 2 (coincidencia/candidato/conflicto/huérfano) no se conocen textualmente: las definiciones de §3.B son **provisionales** y deben alinearse con v34.

> ## r8 — 2026-11-22: IDs vacíos en el cotejo JSON↔CSV
>
> - Corrige un hallazgo de la revisión automática del PR. Un ID vacío o ausente en el JSON y en el CSV contaba como un ID cotejado. Antes, el ID ausente del JSON se convertía en el texto `"undefined"`.
> - Ahora esos registros no se cotejan y el verificador falla con `MISSING_IDS_IN_JSON` o `MISSING_IDS_IN_CSV`, según el lado.
> - Pruebas: 21/21 PASS, con una nueva para este caso.
> - Sobre las copias de los originales, el resultado no cambia: `PASS`, 20 IDs cotejados, 0 IDs vacíos en cada lado y paquete de entrada 9/9 OK.
> - Los hashes de las herramientas que registra la v36 r2 (§2.33) son los del commit `729a29a`; los vigentes están en §7.

> ## r7 — 2026-11-21: v36 borrador r2 (auditoría humana)
>
> - El plan íntegro **v36 borrador r2** (SHA-256 `01b6f0545f9816d05d1fd103f25ab3ba68f6b8699e1c29641ac510d681473a50`) parte del borrador r1 (`03f21990…550a`). No sobrescribe la v35 (`1a35a30a…4c97`) ni el r1.
> - Se entregó al propietario **fuera de este repositorio**, en la carpeta privada de Drive. Incluye el diff v35→v36 r2 (`4781b550…3838`), el diff r1→r2 y `SHA256SUMS_v36r2.txt` (`1359eeb4…2b19`). Los SHA-256 de los archivos descargados de Drive coinciden con los locales.
> - **Correcciones pedidas por la auditoría**, nueva §2.33 del plan:
>   1. §13 reconcilia las referencias a Plan 6 y Plan 11 con §2.31 y §10.3.1. Plan 6 es v27, no v26. Plan 11 no declara versión y no es v2; su §17 cita Plan 2 v30. También aclara que la comparación por colección existe y ya se ejecutó entre las dos exportaciones disponibles (`NO_COLLISIONS`). Faltan los snapshots de otros perfiles, así que el bloqueo sobre cualquier importación o combinación sigue vigente.
>   2. La frase sobre lecturas en Drive estaba en §13 («Límites vigentes»), no en §15. Ahora se limita al respaldo de producción del 5 nov y ya no contradice la lectura de los Planes 0, 1, 3, 4, 6, 11 y 13 ni la de los HTML v4, v5 y v6.
> - **Correcciones adicionales**, cada una justificada en §2.33:
>   - en §13, «Plan 3 v70» se precisa: el archivo de Plan 3 no declara versión;
>   - el estado de las herramientas pasa a `729a29a`, con 20/20 pruebas y el PR fuera de borrador. Re-ejecutadas sobre copias nuevas, dan los mismos resultados: paquete 9/9, `PASS` y `NO_COLLISIONS` con hash `4cd2eb39…`.
> - **Sin cambios:**
>   - los hallazgos;
>   - los 120 s, que siguen **sin causa confirmada**;
>   - el estado **«No aprobado por el propietario»**;
>   - ninguna puerta cerrada: la operativa y la de ejecución de los Planes 0–13 siguen bloqueadas.
> - La construcción es reproducible desde la v35, y `patch(v35, diff)` da exactamente la v36 r2.

> ## r6 — 2026-11-21: correcciones de la revisión automática del PR
>
> Se atendieron los 15 comentarios de la revisión automática del PR (9 de Devin y 6 de Codex; tres de Codex repetían hallazgos de Devin), todos verificados contra el código. Ninguna corrección cambia los resultados sobre los datos reales; reejecutados sobre copias: PASS con 20 IDs distintos cotejados, `NO_COLLISIONS` con hash canónico `4cd2eb39…` y 15/15 controles HOLDS.
>
> **`verify-preservation-package.mjs`**
> - Falla con `DUPLICATE_IDS_IN_CSV` si el CSV repite IDs. `expect.comparedIds` se compara ahora con los IDs distintos cotejados, no con el número de filas.
> - El parser CSV rechaza una celda final con comillas sin cerrar (archivo truncado).
> - Falla con `INVALID_DURATION` si un registro del propósito laboral no tiene duración numérica, en lugar de sumarla como cero.
> - Falla con `AMBIGUOUS_JSON_IDS` si el JSON repite un ID: esas filas no se cotejan con el CSV, en lugar de quedarse con la última.
>
> **`diff-site-collections.mjs`**
> - Recorre la unión de claves. Una clave duplicada en cualquiera de los lados cuenta como **un** conflicto, conserva sus cuerpos y queda fuera de candidatos y huérfanos.
> - `--count` lee el registro original en las colecciones-mapa.
> - Si **cualquiera** de los dos snapshots no tiene colecciones reconocidas, el veredicto es `NO_COLLECTIONS_FOUND`.
> - Los registros que solo están en un snapshot dan `DIFFERENCES_REQUIRE_DECISION` (Plan 2 §8.2).
>
> **`static-evidence.mjs`**
> - Lee archivos, búsquedas y `--since` de **un único commit** (`--rev`, por defecto HEAD) mediante `git show` y `git grep`, no del árbol de trabajo. Así, el blob citado es el que se analizó.
> - `--out` crea el archivo en exclusiva (nunca sobrescribe) y rechaza destinos dentro del checkout.
>
> **Pruebas:** 20/20 sintéticas en PASS (8 nuevas, que cubren los defectos corregidos).
>
> **Documentación**
> - §5 y §8 quedan marcadas como estado de r2. A1, A2, A3 y A5 pasaron a demostrados en r4.
> - Los hashes de §7 se rotulan como r2 y se añade la tabla vigente de r6.
> - `static-evidence_2026-11-21.json` se regeneró con la herramienta corregida.
>
> El plan íntegro v36, privado, cita en su §2.25 los hashes de las herramientas en el commit `d27952a`. Siguen siendo válidos para ese commit, pero las herramientas vigentes son las de r6.
>
> ## r5 — 2026-11-21: v36 del plan (correcciones documentales)
>
> - El plan íntegro **v36** (SHA-256 `03f219902d3a0f66966f5e3c25384d38d2cef1f1947daea354969c773555550a`) se construyó a partir de la v35 (`1a35a30a…4c97`) sin sobrescribirla. Igual que las versiones anteriores, se entregó al propietario **fuera de este repositorio**, con los diffs v35→v36 y v34→v36.
> - **Revisión documental de v35:** recomienda dar pase a la puerta documental. **No es la aprobación formal del propietario.** La puerta operativa y la de ejecución del conjunto de Planes 0–13 siguen bloqueadas; Plan 13 v8 la registra como CERRADA.
> - **Reproducción con las entradas autorizadas** (solo lectura, sobre copias de trabajo): todo resultó idéntico byte a byte a lo entregado.
>   - Paquete de entrada: 9/9 SHA-256 OK, y los originales siguen intactos.
>   - Diff v34→v35: el regenerado coincide con el entregado, y `patch(v34, diff)` da exactamente la v35.
>   - La construcción de la v35 desde la v34 es reproducible.
>   - Verificador Python: `RESULT: PASS`.
>   - Verificador Node y comparación de colecciones: mismo resultado, con hash canónico `4cd2eb39…`.
>   - Análisis de los 120 s y de subconjuntos: mismas salidas.
>   - Herramientas de este repositorio: 5/5 SHA-256 coinciden con §2.25 del plan.
> - **Correcciones documentales de v36** (no cambian evidencias ni gates):
>   1. El estado de la hipótesis del redondeo del total a 0,1/0,5 h pasa a «aritméticamente compatible, sin apoyo en el código v4 local, que daría 171,54 h». **Los 120 s siguen sin causa confirmada.**
>   2. «Excepciones 0/2 explicado en el código v4 local» queda acotado como no demostrado en el Site publicado.
>   3. Se corrige una referencia ambigua en §11.
>   4. Se corrigen las fechas de las secciones del Plan 11.
> - **No reproducible todavía:**
>   - la tercera captura de Plan 1 (`6ea22fd6…`), que no se ha recibido;
>   - la equivalencia del HTML v4 local con el Site publicado;
>   - la vista previa v6, el archive de Sites v2, el ZIP v5 y el kit.
> - Los archivos con datos personales (planes, JSON, CSV, diffs) se mantienen privados. El paquete compartible solo contiene hashes, salidas agregadas de los verificadores e instrucciones de reproducción.
>
> ## r4 — 2026-11-21: paquete de entrada verificado
>
> - Paquete de entrada recibido (ZIP `56a2173a…cf61`). 9/9 SHA-256 coinciden con los documentados en v34. El verificador Python del propietario da `RESULT: PASS`, re-ejecutado el 21 nov sobre copias de trabajo. Los verificadores de este repo dan PASS y `NO_COLLISIONS`, y el hash canónico de `data` se reproduce en una segunda implementación.
> - Por eso A1, A2, A3 y A5 (P2-A*) pasan a **demostrado (prueba ejecutada 21 nov)**. A4 (120 s) sigue en **revisión humana**: el redondeo por fila queda descartado con datos, y el redondeo del total a 0,1/0,5 h es solo una hipótesis compatible.
> - El plan íntegro v35 se construyó sobre el **archivo auténtico** de v34 (SHA-256 `30f59430…72ff`) y sustituye al borrador anterior basado en el texto pegado. Se entregó con el diff v34→v35 y los reportes, fuera de este repositorio público.
>
> ## r3 — 2026-11-21: v34 recibida; plan íntegro v35 fuera del repositorio
>
> - El propietario pegó en la sesión el texto del Plan 2 (cabecera «Fecha de revisión: 20 de noviembre de 2026», sin número de versión; identificado por el propietario como v34). Con él se produjo el **archivo íntegro `SEMSE_Plan_2_Preservacion_Datos_Linaje.md` v35**, entregado al propietario por la sesión y **no versionado aquí**: el repositorio es público y el plan contiene IDs de registros, nombres de proyectos del cliente, horas e IDs de la Biblioteca (minimización, §12.2 del plan). Este paquete queda como registro técnico sin datos de registros.
> - Los artefactos que cita la v34 (respaldo JSON, segunda exportación, CSV, manifiesto `5547…`, verificador Python `761b…`, derivados de Plan 3) siguen en la Biblioteca de ChatGPT y **no se re-ejecutaron**.
> - **Corrección:** la hipótesis de §3.A sobre los 120 s se basaba en el tracker web de SEMSE. Según la v34 (§2.20), el total histórico de 171,50 h procede de la **interfaz del Site** (HTML v4), así que esa regla no aplica salvo prueba en contrario. Queda **retirada** como hipótesis principal; el verificador ofrece transformaciones por fila (`floorMinute`, `roundMinute`, `roundHours2`) para contrastar reglas sobre el respaldo.
> - Código: `git diff 7029da63…86c0be5` (el SHA que cita la v34 frente al actual) está vacío en todas las rutas relevantes. Nuevos controles D-06 (`UPLOADS_SIGNED_GET_MODE ?? "off"`), D-07 (`EVIDENCE_ORIGINAL_SHA256_MODE ?? "off"`) y D-08 (`@Public()` en `files/*`): todos HOLDS.
> - `diff-site-collections` admite el formato `semse-hours-site-v1` (`data`) y las colecciones-mapa (`assignments`, `reviews`), y compara todos los campos, incluidos `source` y `synthetic`. Cubre por diseño las brechas de merge v5/v6 descritas en la v34. **12/12 pruebas sintéticas PASS.**
> - Mapeo de IDs: P2-C1 = D2-06, P2-D2/D3 = D2-07, P2-E1 = D2-08/O11-10. La matriz completa con 28 pendientes está en §14 del plan íntegro.
> - Se retiró de este documento el identificador de una carpeta privada de Drive que figuraba en r1/r2; permanece en el historial de la rama.

---

## 0. Puerta de ejecución del Plan 2

El propietario indicó que primero termina la planificación de los Planes 0–13 y después entrega los planes para ejecución, y que el trabajo se ejecute cuando el conjunto esté preparado y su alcance aplicable aprobado. **No hay en las fuentes accesibles evidencia de esa aprobación.** En consecuencia:

- Solo se ejecutó trabajo **independiente y de solo lectura**: inspección de código y contratos, lecturas de inventario (Drive y Railway), herramientas de verificación con datos sintéticos y documentación.
- **No** se ejecutó ninguna tarea operativa del Plan 2 sobre datos reales (verificación del respaldo, comparación v4/v6, extracción TimeEntry, Evidence, restore).
- Gate **P2-G1** (aprobación del conjunto y del alcance aplicable): **mantener bloqueado** hasta que el propietario registre la aprobación con versión de cada plan.

### 0.1 Principios recibidos del propietario (2026-11-21, prompt de ejecución; no sustituyen al texto de v34)

1. La conciliación se integra de forma **nativa en Time Tracker**; no un Site separado, ni iframe, ni segunda fuente de horas.
2. `TimeEntry` es el registro **canónico** de horas. Los datos del Site pueden conservar declaraciones, propuestas, reportes, notas, revisiones, diferencias y correcciones **con procedencia**, pero no crean ni cambian horas originales por sí solos.
3. Piloto previsto: Field Operations, Gulf Breeze/Pensacola. Una coincidencia, una foto, una declaración local o una similitud entre filas **no** son aprobación de horas ni autorización de pago.
4. El Plan 2 no autoriza importar, migrar, modificar o borrar datos, cambiar el esquema, acceder sin autorización a producción ni ejecutar pagos.

Aplicación en este paquete: las herramientas no producen «horas», sino sumas descriptivas del respaldo, rotuladas como no aprobadas; la comparación v4/v6 solo clasifica y nunca empareja ni combina; ningún resultado se marca como insumo de pago.

### 0.2 Reparto de responsabilidades (según el propietario; versiones vigentes no accesibles)

| Plan | Responsabilidad | Versión consultada | Relación con Plan 2 |
|---|---|---|---|
| 0 Gobernanza | propósito, autoridad, límites, criterios | no accesible | fija P2-G1 |
| 1 Inventario y respaldo | cerrado en su rama; respaldo vigente del Site, cotejo de jornadas, discrepancia de Railway sin causa confirmada | no accesible (rama no encontrada) | origen del respaldo `821f…`; P2-A6 |
| 3 Contrato de conciliación | semántica nativa con `TimeEntry` canónico | no accesible | contrato de extracción (P2-C1) |
| 4 Permisos y aislamiento | autorización por actor, organización y recurso | no accesible | controles y pruebas negativas (P2-C1, P2-D2) |
| 6 Evidence y custodia | referencias, ownership, archivos, checksums, cámara, OCR, custodia por fases | no accesible | P2-D2, P2-D3 |
| 11 Observabilidad e incidentes | evidencia operativa y recuperación (O11-10) | no accesible | P2-E1, P2-E2 |
| 13 Reconciliación y puerta de ejecución | vínculo con reportes del patrón y BELFOR | no accesible | consume resultados de Plan 2; **ninguna decisión de pago o empleo desde Plan 2** |

No se detectaron diferencias entre planes porque no se pudo leer ninguno; queda registrado como P2-R1.

---

## 1. Procedencia de la ejecución

| Elemento | Valor |
|---|---|
| Repositorio | `Semse-projet/project-manager-app` (raíz canónica `project-manager-app/`) |
| Rama | `claude/plan-2-preservacion-datos-linaje-c53u3e`, PR en borrador #1174 (no fusionado) |
| Base | `main` = `86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f` (sin cambios entre ambas intervenciones) |
| r1 del paquete | commit `01cb3d94549b15147af491ef8f68cf58b14eb97b` |
| Estado del árbol al iniciar r2 | limpio |
| Entorno | contenedor efímero de Claude Code en la nube, Linux, Node `v22.23.5`; sin sesión en SEMSE, sin datos de producción |

### 1.1 Fuentes consultadas (solo lectura)

| Fuente | Versión / identificador | Uso |
|---|---|---|
| `apps/api/src/modules/labor-engine/labor-engine.controller.ts` | blob `41d967a1` | rutas de lectura de TimeEntry (C) |
| `apps/api/src/modules/labor-engine/labor-engine.repository.ts` | blob `8237b66e` | filtros, orden, paginación y cálculo de `durationMinutes` (A, C) |
| `apps/api/src/common/parse-query.ts` | blob `505c94aa` | `limit` sin tope (C) |
| `apps/web/app/(app)/worker/tracker/sections/trackerUi.tsx` | blob `537eaaa1` | regla de suma de la interfaz (A) |
| `packages/db/prisma/schema.prisma` | blob `147d5ad1` | `TimeEntry`, `TimeEvidence`, `Evidence` (D) |
| `docs/specs/labor/personal-record-export.spec.md` | blob `b47ee172`, `DRAFT` | contrato de exportación personal (C) |
| `docs/reportes/2026-10-24_worker-personal-export-as-is.md` | en `main` | inventario previo F1-H01…H07, **histórico** |
| `docs/runbooks/BACKUP_RESTORE.md` (commit `c64d01c5`), `docs/reportes/2026-10-12_f07_primer_drill_restore_postgres.md`, `docs/reportes/2026-10-13_field-memory-offsite-recovery-gates.md`, `scripts/field-memory-offsite-restore-rehearsal.mjs`, `scripts/backup/pg-restore-drill.sh` | en `main` | procedimiento y gates de recuperación (E), **histórico** |
| `.claude/skills/semse-backup-restore-verification/SKILL.md` | en `main` | niveles de evidencia (E) |
| Google Drive, carpeta privada `15_RESPALDO_GITHUB_Y_RAILWAY` (ID omitido) | informe y LEEME (mod. 2026-11-06T00:23Z); metadatos y fragmento inicial del manifiesto JSON | candidato para O11-10 (E). **No** se descargaron dump, RDB, tar ni zip |
| Railway, proyecto `SEMSEproject`, entorno `production` (`d682210a…`) | `describe-environment` y `list-deployments` de `semse-API`, 2026-11-21 | paridad de SHA desplegado (C, D) e inventario de volúmenes (E). Sin logs, variables, SSH, backups ni cambios |

**Railway (solo lectura, 2026-11-21):** el despliegue activo de `semse-API` (`3ce6c26a…`, SUCCESS, creado 2026-11-20T05:14:55Z) declara `commitHash 86c0be5…`, el mismo que se inspeccionó. `semse-web`, `semse-worker` y `semse-vision` tienen despliegues de la misma marca de tiempo. Volúmenes: `postgres-volume`, `redis-volume` y `project-manager-app-volume` (`/data` de `semse-API`), 5000 MB cada uno; sin buckets; sin cambios staged. **Límites:** la paridad de SHA según metadatos de Railway no demuestra el comportamiento en ejecución, y el inventario de volúmenes no demuestra que existan backups ni que sean recuperables.

### 1.2 Fuentes y entornos no consultados

Plan 2 v34 y Planes 0, 1, 3, 4, 6, 11, 13 · respaldo `821f…`, exportaciones JSON y CSV · Site publicado v4, vista previa v6 y kit · capturas de interfaz (total y Excepciones) · panel `Backups` de Railway · base de datos, logs, variables y volúmenes de producción · binarios de Evidence · CI de #1174 (no se esperó ni se presenta como evidencia).

---

## 2. Cabecera propuesta para v35

| Campo | Propuesta |
|---|---|
| Versión | 35 |
| Fecha | 2026-11-21 |
| Estado documental | Actualizado con evidencia de 2026-11-21; **pendiente de revisión y aprobación del propietario** |
| Estado de ejecución | Puerta P2-G1 sin aprobación demostrada: solo trabajo independiente de solo lectura |
| Estado operativo | **ABIERTO**: ningún gate operativo cerrado (§5) |

### 2.1 Historial propuesto

> **v35 — 2026-11-21.** Revalidación estática en `main@86c0be5`, que según Railway es el commit fuente desplegado en `semse-API` de producción: no existe extracción organizacional exhaustiva de TimeEntry (C), y el esquema no enlaza `TimeEvidence` con `Evidence` (D). Verificadores reproducibles de solo lectura en `scripts/plan2/*`, con 10 pruebas sintéticas PASS; la comparación v4/v6 clasifica coincidencias, candidatos, conflictos y huérfanos sin emparejar ni combinar. La regla de suma de la interfaz (`durationMinutes·60` truncado por fila) queda como **hipótesis verificable** de los 120 s, sin cerrarla. El respaldo del 2026-11-05 en Drive queda registrado como candidato no verificado para O11-10. Sin aprobación demostrada del conjunto de Planes 0–13 ni acceso a v34 y a los artefactos, A y B no tienen reproducción nueva.

### 2.2 Historial del paquete

| Rev. | Fecha | Commit | Cambio |
|---|---|---|---|
| r1 | 2026-11-21 | `01cb3d9` | Primera versión: C y D estáticos, tres herramientas, 9 pruebas, matriz |
| r2 | 2026-11-21 | (este commit) | Contexto del propietario (§0), responsables por plan incluido Plan 13, paridad Railway, clasificación v4/v6 con candidatos, rotulado «no son horas aprobadas», 10 pruebas, P2-G1 y P2-A6 |

---

## 3. Resultados por bloque

### A. Respaldo y linaje

**Hecho**
- `scripts/plan2/verify-preservation-package.mjs` (v1.0.0):
  - lee cada original una sola vez en modo `r`, calcula el SHA-256 y parsea **desde los mismos bytes**;
  - compara con los hashes esperados y exige que las exportaciones sigan separadas por hash (`mustRemainDistinct`);
  - coteja IDs y duraciones JSON↔CSV con tolerancia declarada;
  - cuenta y **preserva** las filas `synthetic` sin sumarlas;
  - informa, sin atribuir causa, la diferencia entre el total de interfaz y la suma descriptiva, y calcula sumas alternativas (`alternativeDurations`);
  - al terminar vuelve a verificar tamaño, `mtime` y hash; si un original cambió, `ORIGINAL_CHANGED_DURING_RUN` ⇒ FAIL;
  - rechaza escribir el reporte sobre un original o en su mismo directorio y nunca sobrescribe.
- Pruebas sintéticas: `tests/unit/plan2-preservation-tools.test.mjs`, **10/10 PASS** (`node --test`, Node v22.23.5, 2026-11-21).
- Prueba de CLI con un fixture sintético: con la salida en el directorio de originales, `exit=2`; con la salida separada, `PASS exit=0`.

**No hecho:** no se reprodujo `821f55d1…b357`, la separación de las dos exportaciones ni el cotejo de 20 IDs, porque los archivos no estaban disponibles y P2-G1 no está aprobada. Siguen siendo **evidencia histórica** de Plan 1 o de ejecuciones anteriores.

**Qué demuestra el hash y qué no:** un SHA-256 igual demuestra que los bytes son idénticos a los de la copia de referencia. No demuestra quién generó el archivo, que su contenido sea veraz, que las horas sean exactas o estén aprobadas, ni que el respaldo esté completo frente al Site o a `TimeEntry`.

**Diferencia de 120 s: abierta.** [r3: hipótesis **retirada**: el total procede del Site, no del tracker; ver el aviso r3] Hipótesis derivada del código del tracker, no causa demostrada:
- el servidor guarda `durationMinutes = floor(totalSeconds/60)` y `accumulatedSeconds = totalSeconds`;
- la interfaz (`entrySeconds`) usa `durationMinutes·60` cuando existe y `fmtHours` redondea a 0,01 h (36 s);
- las filas `pending_sync` usan `Math.round(seconds/60)`.

Con 15 filas, el truncado por fila puede explicar hasta 885 s. Siguiente acción verificable: ejecutar el verificador con `alternativeDurations` y `expect.uiTotalSeconds`. El cierre exige que la regla reproduzca el total exacto **y** una captura de la vista (fecha, filtros, periodo, propósito y presencia de `pending_sync`).

**Discrepancia de Railway de Plan 1 (P2-A6):** su contenido no es accesible y no se intentó explicarla. La lectura de hoy solo registra el inventario y el SHA desplegado (§1.1); no la confirma ni la descarta.

### B. Site y kit de versiones

**Hecho:** `scripts/plan2/diff-site-collections.mjs` compara dos exportaciones por colección y por clave. Conserva ambas versiones y nunca empareja, combina ni importa. Clasificación **provisional** (pendiente de alinear con v34):

| Clase | Definición provisional |
|---|---|
| coincidencia | misma clave y contenido canónico idéntico |
| conflicto | misma clave con contenido distinto, o clave duplicada en una versión |
| candidato | sin pareja por clave, pero con contenido sin clave idéntico a un registro sin pareja de la otra versión (posible re-clave). **Requiere revisión humana** |
| huérfano | sin pareja por clave ni candidato, en v4 o en v6 |
| sin clave | registro sin valor de clave |

El veredicto es `COLLISIONS_UNRESOLVED_DO_NOT_IMPORT` si hay conflictos, candidatos o registros sin clave. `--count "<colección>:<campo>=<valor>"` permite contrastar filtros de vista. Los cuerpos completos solo se escriben con `--bodies-out`, en un archivo aparte.

**No hecho:** no se inspeccionaron el Site v4 ni la vista previa v6: no hay exportación, sesión autorizada ni aprobación P2-G1. La diferencia de Excepciones (0 frente a 2) **sigue abierta**. El kit v4→v6 **se mantiene bloqueado** y no se modificó porque no estaba disponible.

**Datos exactos que faltan:** exportación JSON de colecciones de v4 publicado y de v6 en vista previa, con versión y fecha; y, para cada vista de Excepciones, captura con URL o versión, fecha y hora, filtro, periodo y alcance (persona, organización, proyecto).

### C. ¿Puede compararse con TimeEntry?

Verificado estáticamente en `main@86c0be5`, que es el commit fuente desplegado según Railway (`static-evidence_2026-11-21.json`; repetido en r2 con el mismo resultado):

| Control | Resultado | Evidencia |
|---|---|---|
| C-01 `GET /v1/labor/entries` filtra `createdBy = a.userId` (ruta personal) | HOLDS | `labor-engine.controller.ts:296` |
| C-02 sin `cursor` ni `offset` en esa ruta | HOLDS | sección `@Get("entries")` |
| C-03 `limit` sin tope superior | HOLDS | `parse-query.ts:7` |
| C-04 orden solo por `startedAt`, sin desempate | HOLDS | `labor-engine.repository.ts:346` |
| C-05 filtro por `tenantId`, no por `orgId` | HOLDS | `labor-engine.repository.ts:319` |
| C-06 vistas admin acotadas a la semana con `take: 50` | HOLDS | `labor-engine.repository.ts:444` |
| C-07 `labor.personal-record-export` en `DRAFT` | HOLDS | spec `:7` |

Otros lectores revisados, ninguno sirve como exportación: `daily-reports.service.ts` (por crew y día), `field-ops.repository.ts` (por `createdBy`, `job_linked`, `take`), `geofence` y `labor-policy` (`findFirst`). **Bloqueo confirmado:** no existe extracción autorizada, exhaustiva, estable y paginada por organización. La ruta personal, los agregados admin y un `limit` grande no son sustitutos. No se implementó nada y no se leyeron datos.

**Lo que debe aportar Plan 3 (contrato):**
- (1) semántica de conciliación nativa y spec aprobada de la extracción, con propósito y autoridad;
- (2) paginación por cursor con orden total `startedAt, id`;
- (3) corte consistente (`asOf` o snapshot) frente a escrituras concurrentes;
- (4) conteo del corte reconciliable con la suma de páginas.

**Lo que debe aportar Plan 4 (permisos y aislamiento):**
- (5) alcance actor → tenant → organización → persona, con permiso dedicado y auditoría;
- (6) pruebas negativas: otro usuario, otra organización y otro tenant ⇒ 403/404 neutro sin datos; sin permiso ⇒ 403.

**Lo que se valida luego en Plan 2:** (7) ejecución en un entorno autorizado de solo lectura, con SHA desplegado y resultados registrados.

### D. ¿Existe una referencia de Evidence utilizable?

- Respaldo: según el estado conocido, no contiene IDs de Evidence; **no se pudo re-verificar** porque el archivo no está accesible. No hay objeto concreto que cotejar. No se enumeró Evidence ni se abrió ningún binario.
- Esquema (`schema.prisma`, blob `147d5ad1`, commit desplegado):
  - `TimeEvidence` no tiene FK a `Evidence` (D-01), ni `tenantId` (D-02), ni checksum o versionado (D-03); solo `fileUrl` libre;
  - `Evidence.checksum` es opcional (D-04);
  - ningún código lee ni escribe `prisma.timeEvidence` (D-05).
- La relación completa `TimeEntry`–`TimeEvidence`–`Evidence` **no existe**. Las rutas `GET v1/evidence/:evidenceId` y los listados por job o proyecto existen, pero no se usaron: ownership, DTO, checksum y retención no están demostrados.
- **Dependencia de Plan 6 (sin cambiar su alcance):** decisión de ownership, relación canónica (FK o tabla de enlace con tenant y organización), DTO allowlist de metadatos, checksum obligatorio y versionado, retención y pruebas de doble autorización caso/objeto con negativos, todo ello coordinado con Plan 4. Hasta entonces: **no leer bytes**.

### E. Recuperación aislada (coordinación con Plan 11 / O11-10)

- Procedimiento: `docs/runbooks/BACKUP_RESTORE.md`. Permite un drill aislado y prohíbe `Restore` nativo de Railway en producción como prueba. Herramientas: `pg-restore-drill.sh`, `field-memory-offsite-restore-rehearsal.mjs` y `field-memory-source-inventory.mjs`.
- Requisitos del procedimiento y estado:

| Requisito | Estado |
|---|---|
| Origen identificado (backup con ID, fecha y digest) | candidato (Drive 2026-11-05, digests publicados), no verificado |
| Operador designado | no definido en fuentes accesibles |
| Ventana consistente y pausa de nuevas cargas | no definida; las capturas de 2026-11-05 no fueron atómicas (23:57:18–23:57:33 UTC) |
| Destino aislado y cifrado | no demostrado; la visibilidad PRIVATE de Drive no equivale a cifrado de destino |
| Autorización puntual | no demostrada |
| Manifiesto previo de originales | existe en el candidato (autodeclarado) |

- Candidato en Drive (2026-11-05, commit `645ce3b8`), con su informe autodeclarado: dump PG de 20 933 554 B (`25f7593c…879d`), RDB de 2 538 099 B (`735d49db…0b96`) y tar de `/data` de 13 062 306 B (`a6f65133…0445`). **No se descargó ni restauró.**
- Historia: drill PG del 2026-10-12 `PARTIAL`; el dump se destruyó.
- **No se ejecutó ningún restore.** No se presentan CI, deploy ni runs históricos como prueba. O11-10 **no se cierra**.

---

## 4. Dependencias y responsables

| Dependencia | Responsable | Qué debe aportar | Criterio comprobable para reanudar Plan 2 |
|---|---|---|---|
| Aprobación del conjunto 0–13 y del alcance de Plan 2 | Propietario / Plan 0 | Registro de aprobación con versión de cada plan | Aprobación fechada y localizable |
| Plan 2 v34 y planes citados | Propietario | Archivos accesibles sin sesión de terceros | Archivos con fecha y hash; IDs `P2-…` mapeados |
| Respaldo, exportaciones, CSV y discrepancia de Railway | Plan 1 | Copias de trabajo y nota de la discrepancia | Hashes reproducidos por el verificador |
| Extracción TimeEntry | Plan 3 (contrato) + Plan 4 (permisos y pruebas) | Puntos 1–6 de §3.C | Puntos 1–7 con evidencia de entorno autorizado |
| Evidence | Plan 6 (+ Plan 4) | Modelo, DTO, checksum, retención y pruebas | Esquema y pruebas negativas aprobados |
| O11-10 | Plan 11 | Prueba aislada aprobada | Inventario, tamaños y hashes con `missing = altered = unexpected = 0` y registro del operador |
| Uso de resultados | Plan 13 | Decide el vínculo con reportes del patrón y BELFOR | Plan 2 solo entrega evidencia clasificada |
| Site v4/v6 y kit | Propietario del Site | Exportaciones y capturas (§3.B) | Diff sin conflictos ni candidatos, o decisión humana por registro |

---

## 5. Matriz final de pendientes

> **Estado de r2 (histórico).** A1, A2, A3 y A5 pasaron a **demostrado** (prueba ejecutada) en r4. La matriz vigente, con 31 renglones, está en §14 del plan íntegro v36 (privado). Esta tabla se conserva como registro de r2.

Estados: **demostrado** · **pendiente** · **bloquea** · **requiere revisión humana** · **mantener bloqueado**. Fecha de la evidencia: 2026-11-21. Entorno: contenedor de sesión, `main@86c0be5` (= SHA desplegado de `semse-API` según Railway), sin datos de producción.

| ID prov. | Pendiente | Estado | Evidencia y fecha | Fuente / versión / entorno | Dependencia y responsable | Siguiente acción verificable | Criterio de cierre |
|---|---|---|---|---|---|---|---|
| P2-G1 | Puerta de ejecución: conjunto 0–13 y alcance de Plan 2 aprobados | mantener bloqueado | Sin registro de aprobación en las fuentes accesibles | prompt del propietario 2026-11-21 | Propietario / Plan 0 | Registrar la aprobación con versiones | Aprobación localizable |
| P2-R1 | Fuentes de autoridad (v34, Planes 0, 1, 3, 4, 6, 11, 13) | bloquea | No accesibles; enlace de ChatGPT con sesión y Cloudflare | — | Propietario | Adjuntar archivos o compartir por Drive o repo | Archivos con fecha y hash; IDs mapeados |
| P2-A1 | SHA-256 `821f55d1…b357` | pendiente | Histórica; no reproducida | — | Plan 1 / propietario | `verify-preservation-package` con `expectedSha256` | PASS con `hashMatches: true` y comando y versión registrados |
| P2-A2 | Dos exportaciones distintas por hash | pendiente | Histórica | — | Plan 1 | `mustRemainDistinct` | Sin `EXPORTS_NOT_DISTINCT` |
| P2-A3 | Cotejo de 20 IDs JSON↔CSV; 24 s explicados | pendiente | Histórica; tolerancia probada con fixture | verificador 1.0.0, Node 22.23.5 | Plan 1 | `toleranceSeconds: 24`, `expect.comparedIds: 20` | `compared = 20`, `mismatched = []` y fuente de la explicación de 24 s citada |
| P2-A4 | 120 s: total de interfaz frente a 15 `payable` | requiere revisión humana | Hipótesis de código: `floor` por fila y redondeo a 0,01 h | `trackerUi.tsx` `537eaaa1`; `repository.ts` `8237b66e` | Propietario: captura de la vista | `alternativeDurations` + `uiTotalSeconds` | Regla reproduce el total exacto **y** captura confirmada; si no, sigue sin causa |
| P2-A5 | Fila `synthetic` preservada y excluida | pendiente | Verificador la cuenta y no la suma (sintético) | verificador | Plan 1 | `syntheticMarker`, `expect.syntheticRecords: 1` | `syntheticPreserved = 1`, `laborRecords = 15` |
| P2-A6 | Discrepancia de Railway de Plan 1 | requiere revisión humana | Contenido no accesible; solo inventario y SHA hoy | Railway prod, 2026-11-21 | Plan 1 | Facilitar la nota de la discrepancia | Causa documentada con evidencia o mantenida abierta por Plan 1 |
| P2-B1 | Excepciones 0 frente a 2 | bloquea | Sin acceso al Site | — | Propietario del Site | Exportar y capturar ambas vistas; `--count` | Diferencia explicada por filtro o alcance con conteo reproducible |
| P2-B2 | Vista previa v6 | bloquea | Sin acceso | — | Propietario del Site | Exportación v6 de solo lectura | Versión, fecha y conteos registrados |
| P2-B3 | Clasificación v4↔v6 | mantener bloqueado | Herramienta con 5 clases, probada | `diff-site-collections.mjs` | Propietario del Site + regla de v34 | Ejecutar con `--bodies-out` en almacenamiento controlado | `NO_COLLISIONS` o decisión humana por conflicto o candidato |
| P2-B4 | Publicar o usar el kit v4→v6 | mantener bloqueado | Depende de B1–B3 | — | Propietario | Ninguna | B3 cerrado + aprobación explícita |
| P2-C1 | Extracción organizacional de TimeEntry | bloquea | C-01…C-07 HOLDS (r1 y r2) | `static-evidence_2026-11-21.json`, `86c0be5` | Plan 3 + Plan 4 | Puntos 1–6 de §3.C | Punto 7 demostrado |
| P2-C2 | No sustituir con ruta personal, agregado admin ni `limit` grande | demostrado (regla) | C-01, C-03, C-04, C-06 | idem | — | Re-ejecutar `static-evidence` en cada revisión | Vigente mientras C1 siga abierto |
| P2-D1 | Referencia concreta de Evidence en el respaldo | requiere revisión humana | Estado previo: ninguna; no re-verificado | — | Plan 1 / propietario | Buscar claves en la copia de trabajo, sin binarios | Sí/no registrado con el hash del archivo |
| P2-D2 | Relación `TimeEntry`–`TimeEvidence`–`Evidence`, ownership, DTO, checksum, retención | bloquea | D-01…D-05 HOLDS | `schema.prisma` `147d5ad1` | Plan 6 (+ Plan 4) | Decisión y modelo de Plan 6 | Esquema y pruebas de doble autorización con negativos |
| P2-D3 | Abrir binarios de Evidence | mantener bloqueado | Nada abierto | — | Plan 6 + propietario | Ninguna | D2 cerrado + autorización |
| P2-E1 | Recuperación aislada (O11-10) | mantener bloqueado | Candidato Drive 2026-11-05 autodeclarado; requisitos §3.E incompletos | Drive (carpeta privada); runbook `c64d01c5` | Plan 11 | Designar operador, ventana, destino cifrado y autorización | Inventario, tamaños y hashes sin faltantes ni inesperados, con registro del operador |
| P2-E2 | Custodia del dump con PII en Drive | requiere revisión humana | PRIVATE; cifrado no demostrado | metadatos Drive | Plan 11 / propietario | Decidir cifrado, retención o eliminación | Decisión registrada y aplicada por el responsable |

---

## 6. Solicitud única al propietario

Para pasar del trabajo independiente a la ejecución del Plan 2 hace falta **una sola acción del propietario**: registrar la aprobación del alcance aplicable (P2-G1) y, en la misma entrega, poner a disposición de la sesión, sin sesión de terceros, **`SEMSE_Plan_2_Preservacion_Datos_Linaje.md` v34, los Planes 0, 1, 3, 4, 6, 11 y 13, y las copias de trabajo del respaldo de Plan 1** (respaldo JSON, dos exportaciones, CSV y nota de la discrepancia de Railway), además de las exportaciones v4/v6 y las capturas de Excepciones si existen. Puede hacerse como adjunto, carpeta de Drive con lectura o rama del repositorio.

**Consecuencia de no hacerlo:** el v35 íntegro no puede producirse y A1–A6 y B1–B3 permanecen sin reproducción. No hace falta acceso a producción ni a Evidence.

---

## 7. Entregables y reproducción

| Archivo | SHA-256 (2026-11-21, **r2, histórico**: no corresponde al HEAD actual) |
|---|---|
| `scripts/plan2/verify-preservation-package.mjs` | `6aac72325adb0d28e8bec6f52ce89050c98edc65040bf7e43aca291be52e60d3` |
| `scripts/plan2/diff-site-collections.mjs` | `dbb43aaf591a5cf3b0a69d1f5fbee3ffa7d706c26731ee50083ff5b7071ba204` |
| `scripts/plan2/static-evidence.mjs` | `128172f90f983ff61aa9eae4b54bf4985b6d051cfd9711f9902fe0584fcfe9ec` |
| `tests/unit/plan2-preservation-tools.test.mjs` | `ba2a56501a3b3f0747d94d2a0aa4013c00b66b4da6952c289d362f170efd0e90` |
| `docs/program/plan-2/static-evidence_2026-11-21.json` | `c732fdc1ea7bfc83e72200206bf975ed0caecf523d0bc4384fed120df7d58e35` |

**Hashes vigentes (r8, 2026-11-22; solo cambian el verificador y las pruebas respecto de r6):**

| Archivo | SHA-256 |
|---|---|
| `scripts/plan2/verify-preservation-package.mjs` | `6e0f8b823c5cb440b0d7f6d52d13a7aba4007787278cc229c8ffc8568afb6ac1` |
| `scripts/plan2/diff-site-collections.mjs` | `3d303009605ca3ee9fbd3afa9d3354c53132c8e46946c17ec8d06036eb63699f` |
| `scripts/plan2/static-evidence.mjs` | `bf7fc6507db14100c1a9f718759da986c17f098f816a43716803df6a21caf0a2` |
| `tests/unit/plan2-preservation-tools.test.mjs` | `7c7d0f4fd021d10f890ae2196c168745656290d32588caa4360ea55caab15689` |
| `docs/program/plan-2/static-evidence_2026-11-21.json` | `9858b2e16164d6cfe5b12b3ef8ab5fc09d58341867ae36a789b4d52be2d095db` |
| este documento | se calcula fuera del documento (un archivo no puede contener su propio hash) |

Desde `project-manager-app/`:

```bash
node --test tests/unit/plan2-preservation-tools.test.mjs
node scripts/plan2/static-evidence.mjs --out /fuera/del/repo/static-evidence.json
node scripts/plan2/verify-preservation-package.mjs --manifest /copias/manifest.json --out /reportes/plan2-A.json
node scripts/plan2/diff-site-collections.mjs --a /copias/site-v4.json --b /copias/site-v6.json \
  --out /reportes/plan2-B.json --bodies-out /reportes-privados/colisiones.json --count "Excepciones:<campo>=<valor>"
```

Manifiesto de ejemplo (ajustar los nombres de campo a la estructura real, que esta sesión no conoce):

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

---

## 8. Conclusiones

> **Estado de r2 (histórico).** Para el estado vigente, ver los avisos r4–r6 al inicio de este documento y §15 del plan íntegro v36.

1. **Preparación documental:** el paquete r2 está listo para revisión. El **archivo íntegro v35 no existe** porque v34 no fue accesible. El plan no está revisado ni aprobado por el propietario.
2. **Trabajo ejecutado:**
   - inspección de procedencia;
   - C y D revalidados estáticamente, con paridad del SHA desplegado según Railway;
   - tres herramientas de solo lectura con 10 pruebas sintéticas PASS;
   - clasificación v4/v6 con candidatos sin emparejar;
   - hipótesis verificable para los 120 s;
   - inventario del candidato de recuperación;
   - matriz y dependencias, con Plan 13 incluido.

   Nada de esto está fusionado, desplegado ni activado (#1174 sigue en borrador).
3. **Gates operativos:** ninguno cerrado.
   - P2-G1, B3, B4, D3 y E1: mantener bloqueado.
   - P2-R1, B1, B2, C1 y D2: bloquean.
   - A1, A2, A3 y A5: pendientes.
   - A4, A6, D1 y E2: requieren revisión humana.
   - C2: demostrado como regla.
4. **Decisiones o permisos humanos pendientes:**
   - aprobación del alcance (P2-G1) y acceso a v34 y a los planes;
   - artefactos de Plan 1;
   - contrato de Plan 3 y permisos de Plan 4;
   - modelo de Plan 6;
   - prueba O11-10 y custodia del dump en Drive (Plan 11);
   - exportaciones y capturas del Site.
5. **Fuentes y entornos no consultados:** los de §1.2.
6. **Acciones no ejecutadas:**
   - ninguna importación, migración, combinación, edición ni borrado de datos;
   - ningún cambio de esquema, permisos, roles, flags, secretos ni configuración;
   - ninguna publicación del Site, despliegue, merge ni activación;
   - ningún pago ni decisión sobre horas;
   - ningún binario de Evidence abierto;
   - ningún restore ni copia de producción, y ningún Railway Restore;
   - no se sorteó el desafío de Cloudflare ni ningún control de acceso.
