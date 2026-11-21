---
id: "labor.weekly-reconciliation"
title: "Conciliación semanal del Time Tracker"
domain: "labor"
sdd_version: "2.0"
version: "0.13"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/labor-engine/labor-engine.controller.ts
  - apps/api/src/modules/labor-engine/labor-engine.service.ts
  - apps/api/src/modules/labor-engine/labor-engine.repository.ts
  - apps/api/src/modules/labor-engine/labor-policy.service.ts
  - apps/api/src/modules/labor-engine/labor-policy.calc.ts
  - apps/api/src/modules/labor-engine/labor-chat.service.ts
  - apps/api/src/modules/field-ops/field-ops.repository.ts
  - apps/api/src/modules/field-ops/field-ops.service.ts
  - apps/api/src/modules/daily-reports/daily-reports.service.ts
  - apps/api/src/modules/ops/ops.controller.ts
  - apps/api/src/modules/ops/ops.repository.ts
  - apps/api/src/modules/domain-events/domain-events.controller.ts
  - apps/api/src/modules/domain-events/domain-events.repository.ts
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/auth.repository.ts
  - apps/api/src/common/rbac.guard.ts
  - apps/api/src/common/auth.guard.ts
  - apps/api/src/infrastructure/audit/audit.service.ts
  - apps/api/src/infrastructure/persistence/actor-context.service.ts
  - apps/worker/src/main.mjs
  - packages/db/prisma/schema.prisma
  - packages/auth/src/rbac.ts
  - docs/runbooks/WORKER_SERVICE_IDENTITY_MEMBERSHIP.md
  - docs/specs/core/labor-policy.spec.md
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-11-21"
---

# Conciliación semanal · borrador para revisión (v0.13 DRAFT)

> **DRAFT / NO IMPLEMENTAR.** Esta SDD no autoriza código, migraciones, grants, membresías, flags, pruebas funcionales, CI, despliegue ni activación. B4-11/B4-12 siguen abiertos. Plan 3 sigue abierto.

## 0. Control de versión, linaje y fuentes de esta revisión

| Versión | Ubicación | Estado verificable en este corte (2026-11-21) |
|---|---|---|
| v0.6 | Espejo Library rev. 22; copia en Drive Plan 3 `SEMSE_Conciliacion_SDD_DRAFT_2026-11-19.md` (ID `1UteeI6LS8EQzWw5MPFYasF79327GQLG2`, SHA-256 `b73dd8713bd04230a1ede3d59efb9b151fb60012b8f9f66a135f4d72695efdb8`) | Leída íntegra. Es la base textual de esta v0.8. |
| v0.7 | Rama local `docs/plan3-conciliacion-v47`, HEAD `50289be4187c9d334f0ad064c7440de6ffba3ecd` (según Plan 3 §32) | **No disponible:** la rama no existe en `origin` (`git fetch`/`ls-remote` sin ref) y el SHA no está en este checkout. No se reconstruyó; las diferencias v0.6→v0.7 que no aparezcan aquí deben volver a incorporarse desde esa copia si su autor la conserva. |
| v0.8 | misma ruta, commits `176cacfb…` y `515e7042…` de la rama `claude/plan3-conciliacion-gates-32rob6` | Primera vez que la SDD existe en el repositorio canónico accesible. Espejo en Drive: `SEMSE_Conciliacion_SDD_v0.8_DRAFT_2026-11-21.md` (SHA-256 `56c032be…0b97`). |
| v0.9 | misma ruta, commit `f199e615…` | Registra la **aprobación de producto de C3-17 (2026-11-21)** en §10.17 y su trazabilidad. Espejo Drive `SEMSE_Conciliacion_SDD_v0.9_DRAFT_2026-11-21.md` (SHA-256 `83312e52…e6`). |
| v0.10 | misma ruta, commit `00cc6ebd…` | Añadió §10.17.6 (evidencia de código para los detalles P-C317) y un paquete de opciones para el dueño. No decidió ningún detalle. Espejo Drive SHA-256 `abc10832…6eae`. |
| v0.11 | misma ruta, commit `59c745fe…` | Registró los detalles P-C317-01, 02, 06 y 07 confirmados por el dueño el 21-11 (§10.17.7). Espejo Drive SHA-256 `ec3af0a4…2458`. |
| v0.12 | misma ruta, commit `80118039…` | Registró las **seis reglas operativas de C3-17** aprobadas por el dueño el 21-11 (§10.17.8, R-C317-13…18). Espejo Drive SHA-256 `6badeae5…8e41`. |
| **v0.13** | misma ruta y rama, base `main@86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f` | Esta revisión: registra dos **precisiones derivadas** de C3-17 (§10.17.9, R-C317-19 y R-C317-20) y cierra el residual P-C317-01c. Sigue `DRAFT` y **no** está en `main`. |

Según `docs/SOURCE_OF_TRUTH.md`, la SDD canónica es la del repositorio (`docs/specs/` + `docs/SPEC_INDEX.md`). Library y Drive son espejos; si contradicen al repositorio prevalece el repositorio. Library **no fue accesible** desde esta sesión: las versiones Library citadas (Plan 3 v70, Plan 9 v27, Plan 4 v38, Plan 6 v24, SDD v22) son referencias heredadas no revalidadas aquí.

**Base de código de esta revisión:** inspección estática de `main@86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f` (= `origin/main` revalidado con `git fetch` el 2026-11-21). Cada hallazgo nuevo lleva el blob del archivo. No se consultó producción, Railway ni base de datos. Las secciones §1–§10.9 heredadas de v0.6 conservan su SHA original (`4cbf109…`); Plan 2 v36r2 §2.23 informa que el diff de las rutas de dominio relevantes entre `7029da63…` y `86c0be5` está vacío, y esta revisión re-inspeccionó directamente los archivos citados en §10.10.

**Metadatos SEMSE.** PrivacyCritical: sí (notas personales, horas, ubicación). AuditLog: requerido para mutación confirmada, decisión de acceso y lectura sensible, con política pendiente de owners. SSE: sin requisito inicial. FSM: corrección `PENDING → APPROVED | REJECTED | STALE` propuesta (no aprobada). PaymentGovernance: sin impacto financiero automático; la conciliación no ejecuta nómina, escrow, payouts ni pagos.

---


## Cuerpo heredado de v0.6 (sin cambios de texto; hallazgos referidos a `main@4cbf109…`)

Esta revisión está cotejada contra el código de `main@4cbf10925170fe92066174c1f4f08a2b6deece8e`, Plan 3 Library v66, Plan 4 Library v38 y este borrador de SDD v0.5. El checkout de trabajo está en `docs/plan3-conciliacion-v47` sobre `50289be4187c9d334f0ad064c7440de6ffba3ecd`; allí este archivo está indexado como DRAFT, pero no existe en el `main` consultado ni figura en su `docs/SPEC_INDEX.md`. El índice local de la rama no prueba indexación en `main`. Hallazgos de código en esta revisión corresponden únicamente al SHA `4cbf10925170fe92066174c1f4f08a2b6deece8e`; no se verificó estado de producción. PrivacyCritical: sí, notas personales limitadas al objeto autorizado. AuditLog: requisito sujeto a registrar decisión y resultado durable. SSE: sin requisito inicial. FSM: propuesta pendiente hasta decisión o conflicto terminal. PaymentGovernance: sin impacto financiero automático.

## Modalidad del trabajo y mando en obra

Aplicar el acuerdo vigente de ese trabajo y período. Una misma persona puede llevar registros propios y trabajar para una organización. La modalidad y el acceso se resuelven por trabajo.

| Caso de aceptación | Resultado esperado |
|---|---|
| Obra con turno asignado de 08:00 a 18:00 y entrada real a las 10:00 | Mostrar turno, marcas y pausas reales por separado. Conservar la entrada a las 10:00. Si el trabajador declara que olvidó marcar, registrar la nota y su propuesta con motivo para revisión. |
| Independiente por hora | Las marcas respaldan el tiempo cobrado según el acuerdo con el cliente. Comparar con un turno sólo cuando el acuerdo incluya ese horario. |
| Independiente por entrega | El tiempo registrado sirve para calcular el costo propio. Mantener el importe acordado por la entrega cuando cambie la duración registrada. |
| Foto privada del independiente o foto ya compartida | El independiente gestiona sus fotos privadas. Para reemplazar una foto compartida, vincular la nueva versión y conservar el motivo y la versión revisada por el cliente. |
| Foto o corrección de una jornada en obra del patrón | El trabajador señala el error y el supervisor verifica y recomienda. El responsable designado por el patrón o administrador decide dentro de la obra y con separación de funciones. Al retirar o reemplazar una referencia, preservar el original restringido y registrar solicitante, autorizador, motivo, fecha y versiones. |
| Supervisor con delegación para reemplazar una referencia | Verificar obra, acción, vigencia y ausencia de conflicto en el momento de decidir. Una reapertura posterior exige delegación específica para reabrir. |
| Obra sin responsable designado | El trabajador puede conservar su registro y presentar una solicitud bajo los permisos aplicables. La decisión permanece pendiente hasta identificar y verificar a la persona autorizada. |

La designación de Gulf Breeze continúa pendiente. Para operar el piloto se requiere además perfil horario fechado por trabajador, política de custodia y verificación de permisos efectivos. Estos casos quedan especificados para la futura fase de pruebas.

## Contratos y aceptación por decisión

| Decisión | Actor, recurso y contrato exigido | Caso positivo y negativo para CI |
|---|---|---|
| C3-01 | Capturista autenticado con autoridad o delegación expresa para la org y el caso. Persistir por separado declarante, procedencia y capturista. | Captura autorizada con fuente externa sin cuenta conserva las tres atribuciones. Denegar al miembro sin capability. |
| C3-09 | Supervisor puede reabrir en su org con delegación vigente que incluya explícitamente case.reopen para la reapertura y motivo. El revisor final requiere autoridad independiente y ausencia de conflicto. | Registrar una sola reapertura. Denegar con delegación de lectura, caducada, revocada, org ajena o conflicto propio. |
| Lector | Trabajador ve lo propio. Equipo requiere autoridad org o grant acotado. Cliente sólo recibe agregado compartido. | Paginar timestamps iguales y modificar una fila durante el recorrido. Esperar mismo conjunto al corte o invalidación explícita. Revocar grant entre páginas y denegar. |
| BO-08 | Cada writer incrementa revisión. Aprobar con revisión capturada y auditoría transaccional. | Dos escritores parten de igual revisión: uno gana. Fallo de auditoría revierte todo. Reintento devuelve resultado previo sin duplicar. |
| Custodia | D6-01 propone EvidenceService y modelo Evidence; tenant, proyecto y entidad padre deben autorizar el objeto. uploadedById acredita carga, no autoridad universal para borrar. | Retirar referencia impide lectura futura y conserva traza. Reemplazo crea nueva referencia versionada; cambio de tenant denegado. D6-04 y D6-09 requieren política autorizada. |
| Horario | Asociar trabajador/org/sitio a versión efectiva del perfil y regla aplicable en la fecha. Guardar zona IANA, inicio de semana, turno, pausa confirmada, jurisdicción, elegibilidad y autor de validación. | Jornada nocturna o cambio de zona conserva instantes y segundos. Sin asignación o elegibilidad verificable devolver pendiente. |
| Baseline | Nunca imputar diferencia agregada a una jornada. | Excluir del confirmado propuestas pendientes; mantener separado valor original, propuesto y reconocido. |

**Autoridad observada.** LaborPolicyService.requireManage valida Membership ACTIVE por usuario y org dentro del tenant y evalúa org:labor:manage. BO-08 impide auto-revisión. Este permiso cubre el contrato de labor policy. Para captura, lectura de equipo, decisión de conciliación y reapertura falta acreditar cada acción específica. El controlador Field Ops usa field-ops:read/write y sus listados de tracker se limitan por creador.

## Inventario de escrituras en el SHA base

Rutas bajo apps/api/src/modules. Las ubicaciones se refieren al archivo del módulo indicado.

| Controlador y actor | Función de persistencia | Operación |
|---|---|---|
| labor-engine, creador, entries/manual y timer/start | labor-engine.repository.ts createTimeEntry / startRealtimeEntry, líneas 88–169 y 217 | INSERT manual o en vivo, incluida rama de compatibilidad |
| labor-engine, creador, timer/:id/pause,resume,notes,stop | pauseTimeEntryInternal, resumeTimeEntry, updateTimeEntryNotes, stopTimeEntryInternal, líneas 252–306 | UPDATE de reloj, nota o cierre |
| labor-engine, operador con ops:dashboard:write, admin/timer/:id/pause,stop | adminPauseTimeEntry y adminStopTimeEntry delegan a los mismos internos | UPDATE dentro del tenant |
| field-ops, operador autorizado field-ops:write sobre sesión propia, tracker/start,manual,pause,resume,stop | field-ops.repository.ts createTrackerSession:323 y updateTrackerSession:366 | INSERT o UPDATE, incluyendo segundos acumulados y minutos al cierre |
| labor-policy, revisor org autorizado, corrections/:correctionId/approve | labor-policy.service.ts:317 | UPDATE condicionado por id/tenant/org dentro de transacción; falta revisión original. Auditoría posterior a la transacción. |
| Migración histórica bajo packages/db/prisma/migrations/20260718000000_consolidate_tracker_session | migration.sql:13 | INSERT histórico; considerar filas existentes en el backfill. |

**Perfil y custodia.** LaborPolicyService.policyView expone versión, org, sitio y horario; la asignación efectiva y la elegibilidad individual requieren validación. Fuente federal consultada el 17-11-2026: US DOL, https://www.dol.gov/agencies/whd/flsa/faq (empleados cubiertos y no exentos, umbral semanal). Validación del caso y jurisdicción estatal pendiente de responsable designado. EvidenceService y EvidenceRepository viven en apps/api/src/modules/evidence. El Plan 6 conserva las decisiones de servicio para este uso, plazo, retiro y reemplazo pendientes de aprobación.

**Reconstrucción.** En los días 2, 3, 4 y 5 de noviembre los originales son 21.95, 14.08, 8.45 y 9.97 h; propuestas pendientes de 10 h cada una. El 2 y el 3 se declaró olvido de detener el reloj; el 4 se declararon ambos extremos y el 5 sólo salida. Pausas, identidad y duración neta pendientes. El respaldo no contiene asignaciones ni reportes. Las cuatro filas vinculadas a Job quedan fuera del subtotal pagable para evitar duplicación. Fuentes y huellas en el expediente de reconstrucción del Plan 3. La diferencia de 120 s permanece abierta.

### 9.9 Jornada diaria, umbral semanal y horas extra

La conciliación debe separar tres conceptos que no se deben colapsar en una sola etiqueta:

1. **Umbral diario operativo:** 8 horas por jornada como límite/alerta de control, visible al dueño/admin y al supervisor. Medianoche local es el inicio predeterminado del día de conteo; la organización puede configurar otra hora y perfiles por horario/turno, sujeto a permisos. El umbral identifica cuándo revisar y controlar la jornada; por sí solo no determina el tratamiento legal ni modifica las horas registradas.
2. **Horas extra por política diaria:** identificar siempre el exceso diario de 8 horas para control del dueño/admin y supervisor. El dueño acordó que una prima después de 8 horas sólo se aplique si la organización la activa mediante configuración. La regla debe llevar vigencia, población cubierta y responsable aprobador; la categoría diaria de control no se presenta por sí sola como conclusión legal ni pago autorizado.
3. **Horas extra por regla legal semanal:** el dueño pidió identificar las horas que excedan 40 o el umbral legal vigente aplicable. Para trabajadores cubiertos y no exentos bajo FLSA, el estándar federal general requiere tiempo extra después de 40 horas trabajadas en una workweek fija de 168 horas, a no menos de 1.5 veces la tarifa regular. Esa workweek puede empezar cualquier día/hora, pero debe ser fija y recurrente; las horas no se promedian entre semanas. La FLSA no exige por regla general prima por superar 8 horas en un día ni limita la jornada diaria para personas de 16 años o más; existen excepciones específicas.

El periodo semanal elegido para conciliar en §9.1 no necesariamente es la workweek usada para una regla legal. El perfil de horas extra debe guardar su propio inicio fijo de 168 horas y zona/base temporal aprobados; sólo se reutiliza el periodo de conciliación si se verifica que coincide exactamente con esa regla.

La documentación del DOL también aclara que recibir un 1099 o ser llamado contratista no decide por sí solo la clasificación bajo FLSA. Por eso SEMSE no debe inferir elegibilidad legal desde un campo `1099`, ni aplicar automáticamente el cálculo legal hasta tener una clasificación revisada y la regla vigente para esa persona o grupo. Esta sección define comportamiento de producto, no determina la situación laboral de ningún trabajador.

**Comportamiento de producto recomendado**

- Mostrar por separado: horas registradas; horas consideradas para la regla seleccionada; umbral diario de 8h; acumulado de la workweek; horas potencialmente extra por regla diaria; horas potencialmente extra por regla semanal; y estado de revisión.
- Para cada perfil de jornada asignado, acumular las horas elegibles en orden cronológico e identificar cuándo se alcanza la octava hora y qué segmento posterior cae en exceso diario. El valor inicial es medianoche local; dueño/admin o supervisor autorizado puede cambiarlo. Un horario que cruza medianoche debe usar el perfil asignado: por ejemplo, el turno 18:00–06:00 puede usar inicio 18:00 para mantener sus 12 horas en una sola jornada de conteo; el turno 01:00–08:00 puede usar medianoche u otra hora configurada. Si falta el perfil, su zona o información necesaria sobre pausas, marcar el cruce pendiente de configuración/revisión y no inferirlo.
- Calcular el cruce del umbral semanal en orden cronológico a partir de segmentos de tiempo elegibles. Si una entrada cruza las 40 horas, identificar qué porción queda antes y después del punto de cruce sin alterar el TimeEntry original. Guardar la regla y versión usadas.
- Mantener `umbral diario`, `umbral semanal`, `jornada esperada`, `horas efectivamente trabajadas` y `horas pagables` como conceptos separados. No usar el umbral 40 del respaldo del Site como regla activa hasta comprobar su origen/configuración.
- Si descansos, entradas incompletas o su tratamiento como tiempo trabajado no están confirmados, presentar la clasificación como **potencial/pendiente de revisión** y mostrar qué dato falta. No descontar ni imputar descansos en silencio.
- Permitir que dueño/admin o supervisor delegado revise alertas, solicite aclaración y documente autorización operativa. Un control previo o falta de autorización no borra tiempo que ya se trabajó ni cambia el original.
- Si coexisten una prima diaria de empresa y la regla semanal legal, mostrar ambas clasificaciones separadas. No sumar, compensar ni calcular el pago combinado hasta que una política aprobada especifique la interacción y los límites aplicables.
- Versionar perfil, jurisdicción, base normativa/política, clasificación validada, workweek fija, zona, umbrales, vigencia y aprobador. Un cambio genera una nueva versión y no recalcula decisiones históricas sin dejar evento y motivo.

#### Ejemplo de conteo sin doble suma

Ejemplo ilustrativo: perfil hipotético con umbral diario operativo de 8 horas y umbral semanal de 40 horas; todas las horas de la tabla ya fueron validadas como horas elegibles. Esto no decide si una persona concreta está cubierta por FLSA ni si existe una prima diaria.

| Semana hipotética | Exceso diario >8h | Exceso semanal >40h | Regla de presentación |
|---|---:|---:|---|
| 4 días × 10h = 40h | 8h | 0h | Mostrar 8h en categoría diaria; no mostrar exceso semanal. |
| 5 días × 9h = 45h | 5h | 5h | Mostrar horas diarias y semanales por separado, con 1h de intersección; no sumar ambas cifras como 10h distintas. |

La conciliación conserva 40h o 45h, respectivamente, como total de tiempo canónico. Las categorías de exceso son vistas derivadas para revisión; cualquier cálculo de compensación requiere la política aplicable y no se resuelve con una suma de etiquetas.

**Fuentes oficiales consultadas el 16 de noviembre de 2026:** [DOL — Overtime Pay](https://www.dol.gov/agencies/whd/overtime/); [DOL — Fact Sheet 23, requisitos de horas extra](https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay); [DOL — Fact Sheet 13, relación laboral bajo FLSA](https://www.dol.gov/agencies/whd/fact-sheets/13-flsa-employment-relationship/). La aplicabilidad concreta y excepciones requieren validación de la política laboral vigente antes de usar estos perfiles para decisiones de pago.

**Decisión del dueño registrada:** el exceso diario de 8 horas siempre se muestra para supervisión; una prima sólo aplica si la organización la activa mediante configuración. El conteo diario inicia a medianoche local por defecto, con posibilidad de ajustar la hora y usar perfiles distintos por horario/turno. El control operativo diario, la prima de empresa y la regla legal semanal siguen siendo conceptos separados. La política de interacción de pago, los permisos y la configuración real deben verificarse antes de especificar o activar cálculos de compensación.


### 9.11 Propuesta inteligente para interpretar notas y ajustar horas

**Alcance autorizado por el dueño:** incluir las cinco capacidades como diseño del Plan 3. Esta autorización cubre la definición funcional; no aprueba código, migraciones, uso de un modelo concreto, cambios automáticos en TimeEntry, reglas de nómina ni activación en producción. El modo previsto es asistencia supervisada: el sistema prepara una propuesta y una persona autorizada decide.

#### A. Interpretación de la nota como afirmaciones, no como verdad

En el primer alcance, el intérprete lee sólo `TimeEntry.notes` del registro seleccionado y autorizado. Puede analizar afirmaciones explícitas de hora de entrada/salida, pausa, olvido de detener el temporizador o corrección solicitada. No hace OCR ni extracción de contenido de reportes, fotos o documentos Evidence; esos materiales sirven como fuentes vinculadas para revisión humana. Toda futura extracción de documentos requiere una spec separada alineada con Plan 6 D6-07. Cada afirmación propuesta conserva su fragmento de origen y se etiqueta como explícita, inferida, ambigua o contradictoria. La nota original se conserva sin alteración; el texto generado nunca la reemplaza.

El sistema no debe inventar el día, AM/PM, zona horaria, pausa, persona o Job que la nota no identifique. Si faltan datos que cambian el cálculo, pregunta por ellos o deja la propuesta incompleta. Una nota breve como “salí a las 6” no demuestra si se refiere a la mañana o tarde, a qué fecha, ni la hora de entrada. Una frase explícita de temporizador olvidado puede levantar una alerta de revisión, pero no basta por sí sola para borrar tiempo.

#### Flujo de interpretación y cálculo

La futura spec debe separar las responsabilidades en una cadena reproducible:

1. **Captura segura:** cargar la nota original y sólo el contexto autorizado del TimeEntry/Job/turno pertinente.
2. **Extracción:** el intérprete produce afirmaciones estructuradas con fragmento fuente, tipo, valor candidato y ambigüedad. No devuelve una decisión final ni ejecuta herramientas.
3. **Validación determinista:** reglas verifican campos requeridos, secuencia temporal, periodo/zona horaria, cruces de turno, pausas, límites y contradicciones con el registro canónico. Si una regla depende de configuración ausente, la propuesta se bloquea o pide aclaración.
4. **Cálculo determinista:** sólo valores normalizados y validados pasan al cálculo canónico de horas para obtener la duración y diferencia reproducibles. Reutilizar `computeLaborTime` de BO-08 cuando cubra el cálculo por entrada; no duplicar la fórmula. Su umbral diario no sustituye la clasificación legal semanal de §9.9. El modelo no es autoridad para sumar, restar ni aplicar políticas.
5. **Propuesta explicada:** mostrar cálculo, entradas, fórmula/regla y qué afirmación lo sustenta; enviar a revisión humana. La aprobación de la propuesta no sustituye la escritura confirmada por el servicio canónico.

Las categorías **clara**, **incompleta**, **ambigua** y **contradictoria** deben derivarse de reglas observables de validación, no de una puntuación opaca del modelo. Si dos interpretaciones razonables producen resultados distintos, el sistema no elige una en silencio: solicita aclaración y conserva la propuesta como no resuelta.

#### B. Explicación de certeza y datos faltantes

Cada propuesta debe mostrar: valores originales; valores sugeridos; diferencia calculada; afirmaciones y fragmentos que la sustentan; datos faltantes; contradicciones; supuestos que se evitaron; motivo por el que requiere revisión; y si la comparación puede calcularse. Usar categorías explicables como **clara**, **incompleta**, **ambigua** o **contradictoria**. No presentar un porcentaje de confianza como garantía ni ocultar incertidumbre detrás de una puntuación. La persona revisora puede abrir la nota completa si tiene permiso.

#### C. Bandeja de revisión humana

Cada propuesta entra en una bandeja con estado independiente del TimeEntry: `pendiente`, `aclaración solicitada`, `editada`, `aceptada para corrección`, `rechazada`, `expirada/desactualizada`. La persona autorizada puede aceptar, editar, rechazar o pedir aclaración y debe aportar motivo cuando la política lo requiera. La vista compara original y propuesta lado a lado y muestra otras entradas afectadas para evitar doble conteo. Sólo usuarios con autorización backend para esa organización, trabajador y recurso pueden revisar.

Una propuesta aceptada significa que el revisor aprueba enviarla a la ruta canónica de corrección; no significa que TimeEntry ya cambió. La UI espera confirmación de esa ruta, vuelve a leer el registro canónico y registra el resultado. Si el registro cambió desde que se revisó, bloquea la aceptación y solicita revisión sobre la versión nueva. Si no existe un flujo canónico aprobado, la propuesta permanece aceptada para seguimiento, pero no se materializa.

#### D. Corrección trazable sin duplicar horas

El original, la nota, la salida del intérprete y cada versión de propuesta son inmutables y enlazados por IDs/versión. El cálculo confirmado cuenta una sola versión canónica vigente de TimeEntry. Nunca suma original más propuesta; nunca descuenta automáticamente por una nota; nunca convierte la salida del modelo en horas confirmadas, extra, reconocidas o pagables. Rechazos, ediciones, aclaraciones y errores de la ruta canónica también quedan en historial con actor, hora, motivo y correlación.

Las notas se tratan como entrada no confiable: no pueden instruir al intérprete a ignorar controles, compartir datos ni ejecutar acciones. Minimizar la copia de datos sensibles en salidas, logs y exportaciones; respetar retención y permisos de la fuente. El intérprete recibe sólo el contexto mínimo necesario y no puede consultar otras organizaciones.

#### E. Aprendizaje limitado a decisiones aprobadas

En una etapa posterior, el sistema puede resumir patrones útiles de decisiones aceptadas. Decisión aprobada para el primer alcance: sugerirlos sólo para el mismo trabajador. Patrones genéricos de la organización que se apliquen a otros trabajadores requieren opt-in/configuración explícita del dueño y excluir notas, identificadores y ejemplos sensibles. Sólo decisiones humanas finalizadas y no revocadas pueden alimentar patrones; una propuesta del modelo, un caso pendiente o una decisión rechazada no es señal aprobada. Cada patrón muestra alcance, versión, fecha y procedencia autorizada; la organización puede desactivarlo o retirarlo. Un cambio de versión no reescribe decisiones pasadas.

No hay aprendizaje automático autónomo en el primer alcance. No se mezclan datos entre organizaciones, no se actualiza el modelo global con notas privadas y no se generalizan patrones entre trabajadores; cualquier sugerencia compartida requiere el control organizacional explícito aprobado en C3-15. Las sugerencias basadas en patrones siguen requiriendo revisión humana; retirar una decisión debe invalidar o recalcular los patrones derivados según política documentada.

#### Casos de aceptación para la futura spec

| Entrada | Resultado requerido |
|---|---|
| Nota “olvidé detener el temporizador” asociada a 21.95h o 14.08h | Preservar tiempo original; clasificar como señal explícita para revisión; no proponer cero horas automáticamente ni contar una corrección no aprobada. |
| Nota “Salí a las 8” con duración de 12.67h | Identificar la afirmación de salida como ambigua si no puede resolverse AM/PM/fecha; pedir aclaración; no inventar hora de entrada ni descanso. |
| Jornada de 8.45h con nota “Entramos a las 8 y salimos a las 6” | Mostrar posible conflicto entre duración y nota y que faltan AM/PM, fecha/contexto o descanso; no fijar por sí sola un total definitivo. |
| Cuatro propuestas de 10h pendientes para 2–5 de noviembre, descansos sin confirmar | Mantenerlas fuera del total confirmado hasta revisión y actualización canónica; mostrar estado pendiente y descansos faltantes. |
| Nota vaga “salí a las 6” | Mostrar qué dato falta y permitir aclaración; no inferir duración, día ni turno. |
| Entrada de prueba técnica de 0h | No convertirla en jornada trabajada por texto generado; conservar la señal y permitir excluir sólo mediante categoría/decisión autorizada y auditable. |
| Propuesta aceptada seguida de cambio canónico concurrente | Rechazar actualización obsoleta; no duplicar evento ni aplicar horas sobre una versión distinta. |
| TimeEntry cambia después de crear la propuesta y antes de aprobarla | Devolver conflicto de versión; no mutar TimeEntry; marcar la propuesta como desactualizada y exigir nueva revisión contra los valores actuales, con evento auditable. |
| Usuario de otra organización solicita ver la nota o propuesta | Denegar sin revelar si existe; no incluir el contenido en respuestas, patrones ni logs visibles entre tenants. |
| Una decisión aprobada luego se revoca | Registrar revocación; retirar o recalcular patrones dependientes y mantener el historial anterior. |
| Propuesta para otro trabajador usando patrón individual | No recuperar ni mostrar el patrón; sólo usar patrones genéricos organizacionales si la configuración explícita aprobada en C3-15 está activa. |


### 10.2 Contrato de concurrencia requerido para BO-08

El esquema confirma `TimeEntry.updatedAt` con `@updatedAt`, pero no un contador entero de revisión. El barrido dirigido de `prisma.timeEntry.` y `client.timeEntry.` ubicó escritores en `labor-engine.repository.ts`, `field-ops.repository.ts` y `labor-policy.service.ts`; Geofence y Daily Reports aparecen como lectores en los archivos inspeccionados. Labor Engine fija explícitamente `updatedAt` al pausar, reanudar, editar nota y cerrar; Field Ops deja que Prisma aplique `@updatedAt`. Las consultas dirigidas no encontraron `timeEntry.upsert` ni DML `UPDATE "TimeEntry" SET`, pero no prueban que se hayan encontrado todos los writers, scripts y workers. El informe F1B advierte que el timestamp no equivale a `sourceRevision` monótono ni a historial inmutable.

Los modelos `AuditLog` y `DomainOutboxEvent` tampoco muestran una revisión por TimeEntry: AuditLog registra `occurredAt` sin contador de entidad; el significado de `DomainOutboxEvent.version` no está conectado en el esquema con una secuencia del agregado. Por tanto, un ID/fecha de auditoría o la versión del sobre/evento no sustituyen `originalRevision` sin un contrato canónico adicional.

`LaborTimeCorrection` guarda los valores originales de inicio, fin y descanso, pero no `updatedAt`, duración ni estado. BO-08 lee TimeEntry y crea la corrección en operaciones separadas; al revisar, su transacción reclama la corrección y actualiza TimeEntry sin comparar el snapshot. Luego llama `AuditService.append`, fuera de la transacción.

`AuditService` ya expone `prepareActorContext` y `appendInTransaction(entry, tx)`. La futura spec puede mantener el owner actual y coordinar atomicidad sin inventar otro sistema: preparar el actor antes de abrir la transacción; dentro de ella, aplicar CAS y actualizar la corrección; insertar el evento de resultado con `appendInTransaction`. Si CAS no coincide, persistir el estado/resultado desactualizado y su evento dentro de la transacción, confirmar ese resultado y devolver conflicto al caller después del commit. No lanzar una excepción dentro del callback si eso revierte el registro del conflicto.

El estado sugerido para ese resultado terminal es `STALE`, distinto de `REJECTED` (decisión humana) y `CANCELED` (cancelación solicitada). Transiciones de la futura spec: `PENDING → APPROVED` sólo si CAS aplica; `PENDING → REJECTED` por decisión humana; `PENDING → STALE` si la revisión no coincide. `STALE` no puede aprobarse ni volver a `PENDING`; se crea otra solicitud con snapshot nuevo. El historial del trabajador debe presentar “Registro cambió; vuelve a revisar y solicita otra corrección” en español e inglés. No mostrar claves internas ni exponer detalles de otra organización.

La futura spec debe capturar la versión exacta que originó la propuesta y decidir su representación. **Recomendación técnica para validar:** como no se encontró un token canónico reutilizable, añadir una revisión entera explícita (por ejemplo, `revision` con valor inicial definido), guardarla como `originalRevision` en la corrección y aumentarla atómicamente en cada mutación canónica de TimeEntry. La aprobación compara ID/tenant/org/estado y `revision = originalRevision`, aplica la corrección e incrementa revisión en una sola transacción; cero filas afectadas significa conflicto. Todos los writers —Labor Engine, Field Ops, BO-08 y cualquier worker/script restante— deben incrementar el mismo contador. Su introducción exige inventario completo, SDD y migración aprobada; no añadir campo ni migrar antes de ese gate. `updatedAt` por sí solo no se considera token monotónico. Si se propone como alternativa, debe acompañarse de comparación atómica de campos y demostración de que la precisión y todos los caminos de escritura impiden colisiones/falsos éxitos.

Al aprobar, dentro de la operación transaccional del owner canónico, aplicar la corrección sólo si el token y snapshot siguen coincidiendo para el mismo ID, tenant y organización. La escritura debe afectar exactamente un registro. Si la edición gana la carrera, TimeEntry permanece intacto por parte de la aprobación, no se registra `labor_correction.approved` y la corrección queda en un estado de conflicto/desactualizada persistido junto con su evento de auditoría. El nombre/estado de conflicto debe armonizarse con los estados existentes (`PENDING | APPROVED | REJECTED | CANCELED`) en la futura spec. La persona debe crear una nueva solicitud ligada al snapshot vigente.

Si la aprobación gana, una edición posterior es un cambio posterior normal y auditable. Un reintento de la aprobación antigua no puede aplicar la propuesta ni duplicar eventos. La spec debe conservar la relación atómica entre resultado horario y AuditLog usando `appendInTransaction`; el estado horario y el evento no deben contradecirse. El Event Catalog debe declarar un evento terminal específico, recomendado `labor_correction.stale`, sin reutilizar `rejected` o `canceled`.

La spec/CI debe cubrir: cambio intermedio de inicio, fin, descanso y estado; discrepancia de revisión; mutaciones concurrentes desde la misma revisión; reintento de una propuesta desactualizada; cada writer incrementando revisión; transición `PENDING → STALE` con evento transaccional; nueva solicitud contra snapshot vigente; y carrera controlada edición/aprobación. Debe probar que no se pierden incrementos, la edición ganadora se conserva, la aprobación perdedora devuelve conflicto sin efecto horario ni evento `approved`, la solicitud stale no vuelve a la cola y el trabajador ve el mensaje localizado.


### 10.6 Contrato lógico mínimo del lector organizacional

Esta sección convierte el bloqueo de lectura en requisitos revisables para una futura SDD. No crea endpoint, permiso, modelo ni consulta y no autoriza lectura de datos de producción.

**Alcance y autorización**

- El servidor deriva actor, tenant y organización desde la sesión y memberships/delegaciones activas. Un `orgId` enviado puede seleccionar contexto sólo después de validar acceso backend; nunca concede acceso por sí solo.
- El alcance inicial es la organización piloto y el periodo semanal solicitado. Filtros por trabajador o Job sólo se permiten si el origen de la declaración tiene ese desglose y el actor está autorizado sobre esos recursos. La falta de desglose permanece agregada.
- La respuesta no incluye notas ni evidencia binaria por defecto. La nota sólo puede cargarse para interpretación asistida mediante una operación separada con permiso explícito y recurso seleccionado.

**Periodo, cobertura y lectura consistente**

- La petición fija inicio y fin del periodo, zona horaria, filtros autorizados y tamaño de página; la organización aporta su inicio semanal configurado. El servidor devuelve los límites normalizados y la configuración usada.
- Las páginas deben pertenecer a una sola lectura lógica reproducible. El contrato SDD elegirá un snapshot consistente, token de corte/versionado u otra estrategia que evite pérdida o duplicación cuando una entrada se cree, cambie o deje de ser accesible durante la paginación. `updatedAt` actual no basta como revisión monotónica por sí solo.
- El orden es estable y determinista, incluyendo un desempate por ID; el cursor opaco queda ligado al actor/organización, periodo, zona, filtros, orden y snapshot. Rechazar cursores alterados, vencidos o reutilizados en otro alcance sin revelar información ajena.
- La respuesta distingue cobertura completa, parcial y bloqueada, e informa conteos de elegibles, incompletos, abiertos, excluidos y pendientes con sus motivos. Ninguna fila se descarta silenciosamente. Entradas fuera de estado comparable se mantienen visibles como excepción, no se suman al total confirmado.
- Por cada fila se devuelven sólo los campos mínimos para calcular y explicar la comparación: ID canónico, referencia del trabajador/Job permitida, estado, inicio/fin, pausa/duración canónica, versión o snapshot consultado. La nota y campos sensibles quedan fuera del listado general.

**Resumen y garantías de aceptación**

- Total y conteos del resumen cubren el conjunto completo de la misma lectura lógica, no sólo la página actual. Cada respuesta permite continuar hasta una marca inequívoca de fin y reporta la versión/corte del conjunto consultado.
- Las pruebas de contrato deben demostrar: más filas que el límite de página; timestamps repetidos y orden estable; sin IDs duplicados ni perdidos entre páginas; creación/edición/cierre concurrente según política de snapshot; filtros cambiados entre páginas; cursor para otra organización; membresía revocada; IDs cross-tenant; registros abiertos o incompletos; y ausencia de notas privadas en resultados no autorizados.
- La matriz de roles de Plan 4 decide quién puede consultar a una persona/equipo. Sin permiso de equipo verificado, el lector sólo devuelve alcance individual permitido; no expande el acceso al dueño o supervisor por conveniencia de agregación.

**Gate de apertura:** antes de desarrollar o usar el lector, SDD debe mapear estos requisitos a owner, endpoint, autorización, consulta, aislamiento, paginación/snapshot y pruebas. Sólo una ruta aprobada y probada permite comparar horas del piloto; hasta entonces el total original del equipo se muestra como no disponible, no como cero.

### 10.7 Contrato de evidencia para Conciliación

La regla de producto queda definida: Evidence es opcional, no decide si una jornada ocurrió y no se duplica dentro de Conciliación. La política y el owner efectivo continúan pendientes; no se asume que el modelo de datos por sí solo autoriza lectura o retención.

| Estado lógico de la referencia | Presentación y efecto |
|---|---|
| No adjunta | Indicar que no se entregó evidencia; no cambia el total original, no confirma ni rechaza horas. |
| Disponible y autorizada | Mostrar metadatos mínimos y abrir mediante el servicio owner después de revalidar organización y recurso. No persistir enlaces firmados en la conciliación. |
| Retirada o expirada | Conservar el hecho de que existió y la decisión histórica que la examinó; marcarla no disponible según la política de retención, sin borrar ni copiar el binario. |
| Inaccesible o no verificada | No exponer el archivo ni tratarlo como evidencia examinada; explicar que el acceso/estado no se pudo confirmar y dejar la decisión como corresponda a revisión humana. |

Reglas para la futura spec:

- Guardar sólo la referencia canónica y el metadato mínimo permitido; autorizar por actor, tenant, organización y proyecto/Job/TimeEntry según el owner real. No inferir vínculo por nombre, fecha, trabajador o similitud.
- Revalidar autorización al momento de abrir/descargar; no confiar en el estado que mostró una pantalla ni en un `fileUrl` guardado.
- Respetar el ciclo de vida de Evidence. Una revocación, expiración o retiro no elimina el historial de que se tomó una decisión, pero puede hacer que la referencia ya no sea consultable conforme a la política vigente.
- Un checksum puede apoyar una comprobación de igualdad de bytes; no demuestra autoría, exactitud horaria ni autenticidad del contenido.
- Si no se confirma el servicio owner, los permisos de objeto y la retención, limitar el piloto a registrar que la fuente fue declarada, sin copiar ni abrir el archivo. La falta de foto o documento nunca resuelve automáticamente la discrepancia.

**Pendiente concreto C3-08:** Plan 2 v28 confirma que el respaldo revisado no contiene IDs de Evidence y que la policy de retención no se deduce de `schema.prisma`. Se localizó el Plan 6 actual, con fecha 15 de noviembre y estado de borrador no aprobado: define los principios de custodia, pero deja abiertas D6-01 (servicio/modelo), D6-04 (retención/borrado) y D6-09 (quién puede ver, retirar o reemplazar). Plan 2 además advierte que la descarga de binarios está declarada pública en el código y que el modo efectivo de Railway no fue verificado. El comportamiento lógico queda definido; el acceso/almacenamiento de Evidence y cualquier OCR/extracción documental siguen bloqueados hasta verificar contrato, permisos y política aprobada.



### 10.8 Auditoría, lectura sensible e identidad de servicio

**Base de evidencia:** inspección estática de `main@4cbf10925170fe92066174c1f4f08a2b6deece8e`. Este inventario describe implementación observada en ese SHA; no demuestra grants asignados a personas, configuración activa en producción ni completitud del historial del caso.

| Ruta/mecanismo observado | Guard, alcance y respuesta | Límite para conciliación |
|---|---|---|
| `GET /v1/labor/entries` — `labor-engine.controller.ts`, `labor-engine.service.ts`, `labor-engine.repository.ts` | Requiere `field-ops:read`; resuelve el actor de sesión y pasa `tenantId` y `createdBy = actor.userId`. Acepta rango, Job, free project, purpose, semana y limit (predeterminado 50); el repositorio ordena por `startedAt DESC` y admite offset interno. | El controlador no ofrece cursor/offset ni desempate estable, y la llamada es para la propia persona. No permite leer el equipo ni recorrer un histórico exhaustivo garantizado. |
| `GET /v1/labor/admin/overview` — mismos controller/service/repository | Requiere `ops:dashboard:read`; entrega timers activos no personales, resumen agregado del equipo y alertas/umbrales de la semana actual. Sus consultas reciben sólo `tenantId`. | Resumen operativo de tenant, no listado exhaustivo de TimeEntry ni scope por organización/caso. La capability del guard no demuestra un grant efectivo a un actor concreto. |
| `GET /v1/crews/:crewId/daily-reports` y `GET /v1/crews/:crewId/daily-reports/:reportDate` — `daily-reports.controller.ts`, `daily-reports.service.ts` | Usa `AuthenticatedAccess` y revalida membresía activa en cada llamada; permite supervisor vigente de esa cuadrilla o rol con `org:crews:manage`. Lee un reporte/snapshot de una cuadrilla concreta. Al generar, consulta TimeEntry por tenant, `crew.orgId`, trabajadores activos de la cuadrilla, fecha y estado no eliminado; ordena por `startedAt ASC`. | Es la lectura más cercana con scope org/cuadrilla, pero es una captura diaria limitada al roster activo y la fecha; no tiene paginación/corte para historial completo, y el snapshot declara que puede faltar tiempo no sincronizado. No es lector canónico de conciliación ni cubre miembros/histórico fuera de ese alcance. |
| `GET /v1/ops/audit` — `apps/api/src/modules/ops/ops.controller.ts`, `ops.repository.ts`, `ops.service.ts` | Requiere `ops:audit:read`; el contexto autenticado aporta tenant, organización y usuario. El repositorio prepara contexto y consulta `AuditLog` por `tenantId`, ordena sólo por `occurredAt DESC` y usa límite por defecto 100. La respuesta expone acción, recurso, identificador, fecha, request ID y actor presentado. | No filtra filas por organización, recurso/caso ni actor; no tiene desempate estable ni cursor. Es inventario operativo acotado por tenant, no lector exhaustivo ni prueba de aislamiento organizacional. Si `actorUserId` es nulo, el servicio lo presenta como la cadena `system`, que no es identidad durable. `ensureActorContext` puede crear/actualizar filas de contexto durante la lectura; no tratar esta ruta como lectura sin efecto lateral. |
| `GET /v1/domain-events` — `domain-events.controller.ts`, `domain-events.service.ts`, `domain-events.repository.ts` | Requiere `domain-events:read`; usa actor de solicitud autenticada. El límite se acota a 1–200 (predeterminado 50). El repositorio filtra `AuditLog` por tenant, acción `domain.event.emit`, entidad `DomainEvent`, y ordena por fecha descendente; permite filtros de tipo/correlación. La ruta por correlación devuelve una traza limitada. | Sólo enumera emisiones de eventos de dominio capturadas como auditoría; no reconstruye todos los cambios/decisiones del caso ni las lecturas sensibles. No aplica alcance organizacional por fila. No sustituye un lector canónico del caso. |
| `POST /v1/domain-events/:eventId/process` | Requiere `domain-events:consume` y rol `EVENT_CONSUMER`; el flujo interno pasa `actor.userId` como `serviceActorId` y un `workerId`. El rol declara una capability de consumo. | Prueba un patrón de consumidor técnico en código, no un permiso de conciliación, una identidad de workload tipada en AuditLog, ni la existencia de un grant efectivo/activo. |
| `AuditService` y modelo `AuditLog` — `audit.service.ts`, `schema.prisma`; `ActorContextService` — `actor-context.service.ts` | `AuditService` acepta `tenantId`, `orgId` y `actorUserId`; ofrece `appendInTransaction`. El modelo persistido tiene `tenantId`, `actorUserId` nullable, recurso, acción, before/after, metadatos de solicitud y fecha. `ensureActorContext` puede hacer upsert de contexto al listar. | El esquema inspeccionado no persiste `orgId` ni un tipo/principal de actor. La carga de auditoría no prueba por sí sola autoridad por fila, identidad de workload, decisión ALLOW/DENY o acceso sensible. La API de transacción existente no acredita que cada mutación relevante la use atómicamente. |

Las capabilities declaradas en decoradores/RBAC son requisitos de guard. Su presencia en código no demuestra qué usuario tiene actualmente membresía, rol y grant efectivos. Para un acceso autorizado, la aceptación futura deberá probar el contexto autenticado y membresía activa en la organización/recurso; no basta con configurar el nombre de la capability.

El worker usa autenticación Bearer en el código inspeccionado. El runbook `docs/runbooks/WORKER_SERVICE_IDENTITY_MEMBERSHIP.md` describe `usr_worker_system` y membresía `EVENT_CONSUMER` como propuesta **no ejecutada**. No se consultó producción ni se verificó una asignación activa. El requisito lógico conserva campos distintos para: ejecutor (`USER`, `SERVICE` o `ANONYMOUS` con identificador verificable cuando exista), usuario iniciador, declarante externo, fuente/procedencia y destinatario afectado. Un `userId` de servicio asociado al evento no convierte `actorUserId` del log en principal durable tipado. Si el workload no puede verificarse, registrar la identidad como no verificada y bloquear una decisión que dependa de atribución confiable; nunca sustituirla por `system`.

#### Requisitos lógicos y límites

- **Decisión de acceso (Plan 4):** para ALLOW y DENY registrar actor autenticado o ausencia, acción/capability, recurso, tenant y scope organizacional solicitado/resuelto, autoridad/política versionada, resultado, motivo normalizado y correlación. Minimizar PII y no persistir notas o contenido Evidence en el log bruto. Una denegación no debe devolver datos ni convertirse en autorización por un fallo al registrar la decisión.
- **Cambio confirmado del caso (Plan 3):** evento de dominio identifica mutación, revisión anterior/nueva, actor ejecutor, usuario iniciador si aplica, decisión relacionada y correlación. La mutación y su auditoría de resultado deben ser atómicas según BO-08; esta revisión no acredita que todos los writers actuales lo cumplan.
- **Lectura sensible:** tratar como evento separado de auditoría, con actor, acción, recurso, scope, decisión, motivo/propósito permitido y correlación; no guardar el contenido leído. Si la política aprobada exige registro durable previo/posterior a la lectura y falla el registro, fallar cerrado. La política, lector bruto autorizado, retención y mecanismo persistente siguen sujetos a los owners; no se elige tabla, endpoint o capability nuevos aquí.
- **ResourceScope:** cualquier error, scope ausente o discrepancia entre tenant, organización, membresía, recurso y delegación deniega sin revelar existencia ajena. El alcance propio no se amplía automáticamente a todo el equipo; autorización por fila y por campo se revalida en cada página y en cada apertura de nota/referencia.
- **Lectores:** el historial saneado del caso, el log bruto de auditoría y el inventario de eventos son superficies distintas. El lector del caso futuro sólo expone eventos permitidos al actor; el acceso al log bruto necesita autoridad separada y aprobada. Las rutas genéricas arriba descritas no cumplen el contrato del lector organizacional.

#### Trazabilidad de aceptación y pruebas futuras

| Decisión/requisito | Contrato | Caso de aceptación | Prueba prevista |
|---|---|---|---|
| P4: autorización por principal, fila y campo | Evaluar tenant + org + recurso + actor + capability/grant efectivo en cada operación; distinguir permiso declarado de asignación activa. | Usuario accede a su propia jornada permitida; usuario con delegación vigente ve sólo filas/campos delegados; revocación surte efecto; organización distinta y tenant distinto no revelan existencia. | Pruebas autenticadas positivas y negativas para propio, autorizado, revocado, otra organización y otro tenant; variar org/recurso entre páginas. |
| P3: lectura del caso con corte estable | Fijar periodo/scope y corte; ordenar con ID como desempate; cursor ligado al actor, tenant, org, filtros, periodo y snapshot. | Cambios durante el recorrido producen el mismo corte o invalidación explícita; cursor alterado/vencido o scope cambiado se rechaza. | Prueba multi-página concurrente, timestamps iguales, creación/edición/revocación entre páginas y ausencia de duplicados/pérdidas. |
| Identidad de servicio | Verificar identidad del workload y vincular executor a cada operación, separado del iniciador/declarante/fuente/afectado. | Worker autenticado válido queda atribuido; token ausente, identidad desconocida o rol sin asignación efectiva no obtiene acceso; etiqueta `system` sola se rechaza como identidad. | Pruebas autenticadas con principal de servicio válido/inválido y correlación hasta el evento/auditoría. |
| P4: decisión ALLOW/DENY | Persistir decisión mínima con autoridad versionada y resultado sin datos sensibles. | ALLOW sólo con authority efectiva; DENY no deja pasar aunque el log falle. | Comprobar fila de auditoría redactada y ausencia de efecto/datos ante denegación; probar fallo del logger según política aprobada. |
| P3/P4: lectura sensible y mutación | Separar evento de lectura del evento de cambio confirmado; correlacionar decisión, actor y mutación. | Apertura sensible se rechaza si el registro durable obligatorio falla; corrección aprobada y evento confirmado son atómicos; un conflicto no crea evento de éxito. | Inyectar fallo de auditoría; confirmar rollback/cierre seguro y correlación acceso→cambio; reintentar sin duplicar. |
| Lectores de auditoría | No equiparar listados de tenant con historial de caso/aislamiento de organización. | Operador con acceso al inventario de eventos no obtiene por ello notas, Evidence ni casos ajenos. | Verificar guard, capability efectiva, filtros, límites, orden, campos devueltos y aislamiento del lector aprobado. |

**Conclusión de lector:** no hay lector canónico organizacional de TimeEntry/caso demostrado en este SHA. Sí existe una ruta de reportes de cuadrilla con lectura org/cuadrilla, pero sólo produce instantáneas diarias acotadas a miembros activos; `/v1/labor/entries` es personal y `/v1/labor/admin/overview` es resumen tenant. Ninguno acredita cobertura exhaustiva y paginada del conjunto conciliable.

### 10.9 Decisión técnica del lector, identidad y eventos de auditoría

Esta sección termina el contrato lógico que puede fijarse con la evidencia de `main@4cbf10925170fe92066174c1f4f08a2b6deece8e`. No escoge tablas, rutas, capacidades, grants, proveedor de identidad, límite numérico de página ni retención. Las asignaciones y políticas efectivas siguen siendo verificables sólo por sus owners en un entorno aprobado.

#### Decisión de fuente de lectura

- Daily Reports queda clasificado como **snapshot auxiliar de cuadrilla/día**. Su consulta por organización, fecha y roster activo y su advertencia de TimeEntry no sincronizados lo hacen útil como contexto, pero no como conjunto canónico exhaustivo de conciliación.
- La conciliación requiere un **contrato de lectura canónica de TimeEntry**, independiente de la salida de Daily Reports. La autoridad para leer filas de equipo/org y campos concretos debe provenir del owner de autorización/Plan 4; no se infiere de membresía, acceso a reportes, rol con nombre conocido ni capability declarada.
- `GET /v1/labor/entries` permanece lector personal según el código cotejado. `GET /v1/labor/admin/overview`, `GET /v1/ops/audit` y `GET /v1/domain-events` no satisfacen el contrato por ser agregados o inventarios limitados por tenant. Ninguna de estas rutas se propone como endpoint nuevo ni se consultó en producción.

#### Contrato lógico obligatorio del lector canónico

| Dimensión | Contrato que debe satisfacer cualquier implementación aprobada |
|---|---|
| Principal y contexto | Derivar actor autenticado, tenant, organización activa, recurso y campos solicitados desde contexto verificado del servidor. El `orgId`, trabajador, Job o IDs del cursor enviados por el cliente son selectores, nunca autoridad. Sin principal/contexto verificable, denegar. |
| Lectura propia | Permitir únicamente filas del actor que correspondan a su identidad canónica y tenant activos, y sólo los campos que su contrato de trabajador permita. |
| Lectura delegada/org | Permitir filas sólo tras comprobar la autoridad efectiva aplicable al recurso, organización, actor, acción y campos. La membresía activa puede ser una condición, pero no sustituye el grant/delegación específica. Revalidar autoridad en cada página. |
| Revocación | Una revocación o expiración antes de una página posterior detiene la lectura, aunque un cursor previo fuera válido. No completar el recorrido usando una autorización cacheada o congelada en el cursor. |
| Otra organización/tenant | No devolver filas ni metadatos. Aplicar la semántica ResourceScope ya aprobada: recurso ausente o tenant ajeno sigue el patrón de no revelar existencia; organización ajena dentro del mismo tenant usa la respuesta definida para el scope participante. No crear una nueva regla de 403/404 en esta SDD; el mapeo exacto queda sujeto al owner de ResourceScope. |
| Corte consistente | Todas las páginas representan un único corte lógico. La implementación aprobada debe usar snapshot/versionado consistente o invalidar el cursor y exigir reiniciar cuando no pueda preservar ese corte. Una fila nueva, editada, cerrada, borrada lógicamente o cuyo scope cambie no puede causar pérdida o duplicación silenciosa. `updatedAt` por sí solo no es revisión monotónica. |
| Orden y cursor | Orden total determinista por clave temporal canónica más ID estable como desempate. Cursor opaco e íntegro, ligado a principal, tenant, organización, scope de recursos, política/versión de autorización, periodo, zona horaria, filtros, orden y corte. Cambio de cualquier componente invalida el cursor sin revelar filas ajenas. No se fija aquí el mecanismo criptográfico. |
| Límite de página | El servidor valida y acota el tamaño con un máximo configurado y aprobado por el owner; se rechazan valores inválidos. La consulta debe poder terminar en una marca inequívoca de fin. El valor numérico y la política de límite se deciden con el owner técnico antes de implementar. |
| Consistencia entre páginas | Si cambia la autoridad, política, periodo, filtro o corte, responder con un error tipado de cursor/scope o reinicio que no incluya datos no autorizados. No mezclar una página nueva con el corte anterior. |
| ResourceScope | Validar tenant, organización, relación del TimeEntry con trabajador/Job y actor antes de serializar campos. Un error interno, scope incompleto o fallo del resolver deniega; nunca degradar a tenant-wide. Aplicar permiso por fila y por campo. |
| Datos devueltos | Lista mínima permitida por la decisión de conciliación: ID canónico, referencias autorizadas a trabajador/Job, estado, instantes originales, pausa/duración canónica, revisión/corte y marcadores de integridad/completitud. Excluir notas privadas, binarios Evidence, compensación y campos ajenos al propósito salvo autorización independiente aprobada. |

El contrato no obliga a Daily Reports a ser parte del lector. Si un owner desea reutilizarlo, sólo podrá hacerlo como snapshot auxiliar claramente rotulado, con fecha/roster y limitación de cobertura expuestos; nunca como afirmación de exhaustividad. La selección de la ruta canónica, mecanismo de corte, límite numérico, semántica exacta de error y capabilities requiere decisión/aprobación técnica posterior.

#### Identidad atribuible a procesos de fondo

En el SHA inspeccionado, workers usan un usuario técnico configurado y autenticación Bearer contra la API; el procesamiento de domain events comprueba el rol/capability de consumidor en esa ruta. El runbook `WORKER_SERVICE_IDENTITY_MEMBERSHIP.md` sigue propuesto/no ejecutado y la lectura de código no demuestra membresías/grants efectivos ni la identidad real que operó una tarea. `actorUserId = null` presentado como `system` no es identidad durable.

Cada operación futura debe conservar campos semánticos separados, aunque el owner del esquema determine su representación persistida:

| Campo lógico | Quién/qué representa | Regla |
|---|---|---|
| Ejecutor | Usuario o workload que ejecutó efectivamente la operación | Para workload exige identidad verificable ligada a la operación; nombre libre, `workerId` o etiqueta `system` no bastan. |
| Iniciador | Usuario que solicitó que se ejecute una acción asíncrona | Puede estar ausente en tarea autónoma; no se sustituye por el ejecutor. |
| Declarante | Persona/entidad que comunicó las horas externas | Puede ser una compañía o persona sin cuenta; no se convierte en capturista. |
| Fuente/procedencia | Documento, reporte, integración o declaración de la que provienen datos | Describe procedencia, no autenticación ni autoridad. |
| Destinatario afectado | Persona/cuenta a quien corresponde el registro o que recibe resultado | No se considera actor por ser sujeto del dato. |

El patrón actual permite documentar autenticación técnica; no permite cerrar identidad durable para conciliación. El owner de identidad debe identificar un principal canónico para cada tipo de worker/tarea, mecanismo de atestación, enlace verificable a operación/correlación y comportamiento cuando falte o venza. Hasta entonces, las operaciones cuya auditoría dependa de atribución de servicio permanecen bloqueadas; no se crea identidad ni grant aquí.

#### Tres clases de evento y respuesta ante fallo

1. **Decisión ALLOW/DENY — Plan 4.** Registrar resultado de autorización separado del cambio de dominio: actor verificado o ausencia/categoría de principal, acción/capability solicitada, recurso, tenant y scope solicitado/resuelto, referencia y versión de política/autoridad evaluada, resultado, motivo normalizado y correlación. No copiar notas, binarios Evidence, tokens ni payload sensible. Un DENY nunca se convierte en ALLOW por fallo de registro, timeout o error del sistema de auditoría.
2. **Mutación confirmada — Plan 3.** Registrar sólo después de conocer el resultado transaccional: actor ejecutor, iniciador cuando exista, recurso, scope, tipo de cambio, referencia de revisión anterior/nueva, decisión relacionada y correlación. Si la mutación y la auditoría son requisitos atómicos, ambas se confirman o revierten juntas mediante el contrato canónico aprobado. No emitir un evento de éxito si la mutación no se confirmó.
3. **Lectura sensible.** Registrar actor, acción de lectura, recurso/scope, resultado de autorización, propósito permitido si el producto lo define y correlación, sin guardar el contenido leído. Es distinto del evento ALLOW/DENY de policy y de una mutación. Si la política aprobada exige registro durable para permitir esta lectura, la lectura falla cerrada cuando no puede confirmarse ese registro. Si no existe esa regla aprobada, no se declara todavía que toda lectura sensible esté obligada a fail-closed.

La minimización aplica a todos los eventos. El log bruto sólo se expondrá mediante lector separado con autoridad explícita del owner de auditoría/seguridad, filtrado por tenant/org/recurso y auditado por lectura; los listados `/v1/ops/audit` y `/v1/domain-events` no cumplen ni heredan esta autoridad. Nombres de campos físicos, tabla/proveedor, catálogo de motivos, retención, capability de lector bruto y política general fail-open/fail-closed quedan sin decidir hasta aprobación de los owners. Para no romper consistencia, el mecanismo existente `AuditService.appendInTransaction` es candidato de reutilización observado; no prueba que cada writer lo use ni autoriza una migración.

#### Trazabilidad decisión → requisito → contrato → aceptación → prueba

| Decisión/owner | Requisito | Contrato | Aceptación observable | Caso de prueba previsto (no ejecutado) |
|---|---|---|---|---|
| P4 autorización + ResourceScope | Autorizar actor, tenant, organización, fila y campo con fuente efectiva | Alcance de la tabla anterior; revalidación por página | Propio permitido; autorizado sólo dentro de scope; revocado bloqueado; otra org/tenant sin datos | HTTP autenticado positivo/negativo para own, authorized, revoked, cross-org y cross-tenant; validar status/body según contrato ResourceScope aprobado |
| Owner de lectura TimeEntry | Cobertura completa y reproducible sin inferir permiso | Snapshot/corte, orden total, cursor ligado a scope, límites aprobados, campos mínimos | Más de una página, timestamps iguales, cambios concurrentes sin duplicación/pérdida o cursor invalidado | Carrera create/edit/close/delete lógico durante paging; cursor alterado, cambiado de actor/org/filtro y expirado |
| Owner de identidad | Atribuir workers y tareas | Principal de servicio verificable separado de iniciador/declarante/fuente/destinatario | Workload verificado queda atribuido; principal ausente/desconocido falla según política | Procesar tarea con principal vigente, inválido/expirado y sin membresía/grant; comprobar correlación durable sin `system` |
| Owners Plan 4 + auditoría | Separar decisión de acceso, lectura sensible y cambio confirmado | Esquemas lógicos de eventos y minimización precedentes | ALLOW/DENY no registran contenido; DENY nunca expone; mutación no se separa de su auditoría; lectura sensible cumple fail-close sólo si policy lo exige | ALLOW/DENY, fallo de auditoría, lectura sensible con fallo, mutación y auditoría en transacción, correlación de acceso→cambio y ausencia de duplicados en retry |
| Owner de auditoría/seguridad | Limitar lectura del log bruto | Lector explícito por tenant/org/recurso y evento de lectura | Auditor sin autoridad no lee log bruto; un lector aprobado sólo ve su scope y campos permitidos | Pruebas autenticadas de allow/deny del lector bruto, aislamiento y auditoría de la propia lectura |

**Bloqueos de owner pendientes:** autoridad/capability efectiva de lectura organizacional; ruta y mecanismo de corte más máximo de página; semántica final ResourceScope para mismo tenant/otra organización en este recurso; principal de workload y su atestación; owner y lectores del log bruto; si toda lectura sensible exige registro durable; política de fallo, retención y catálogo de motivo. Ninguno se resuelve eligiendo una tabla, endpoint, permiso o valor de configuración en esta revisión.

**Estado actualizado:** el contrato lógico y los casos de aceptación quedan descritos en SDD v0.6, todavía `DRAFT`; no hay implementación ni pruebas de comportamiento. B4-11/B4-12 siguen abiertos. La spec está indexada sólo en esta rama documental y no figura en el índice del `main` inspeccionado. No se ejecutan tests/CI funcionales mientras el gate DRAFT lo prohíbe. Plan 3 y Plan 9 deben registrar esta misma revisión y seguir abiertos.

**Gate de CI observado:** `.github/workflows/ci.yml` en el mismo SHA corre `spec:validate:strict --base-ref`, `spec:audit-plan-coverage`, `spec:index:check` y pruebas unitarias de los validadores en `quality-gates`; `unit-coverage` y E2E son jobs separados, y E2E depende de `quality-gates`. Este flujo no se ejecutó para esta revisión. Se ejecutaron sólo el validador estricto documental y la regeneración del índice en el checkout local; no se ejecutaron tests, CI, migraciones ni pruebas de comportamiento.

## Salida

Resolver B4-01/B4-02 y revisión independiente, decisiones D6, asignación horaria y baseline. Revisar SDD y aprobar por el proceso del repositorio antes de implementación. Plan 10 exige CI ligada al SHA del cambio, con pruebas HTTP autenticadas, carreras reales en base aislada y fallos de auditoría. Estado de estos casos: pendientes.


---

## 10.10 Revalidación estática en `main@86c0be5` — 21 de noviembre de 2026

Blobs inspeccionados (`git hash-object`) en `86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f`:

| Archivo | Blob |
|---|---|
| `apps/api/src/modules/labor-engine/labor-engine.controller.ts` | `41d967a10b9d9b97f95d883329549464000e3d5f` |
| `apps/api/src/modules/labor-engine/labor-engine.service.ts` | `59e4639aaec31566a0f9c56bb8cccd46ddf235a2` |
| `apps/api/src/modules/labor-engine/labor-engine.repository.ts` | `8237b66e07eaa8698b168099d00f0ca1a738845f` (coincide con Plan 3 §32.1) |
| `apps/api/src/modules/labor-engine/labor-policy.service.ts` | `31063cfa6e8930500fca624e69637c7ab3eb97c7` |
| `apps/api/src/modules/labor-engine/labor-chat.service.ts` | `ba22aca4eba8265e476f8c3705f062df1d0e447b` |
| `apps/api/src/modules/field-ops/field-ops.repository.ts` | `9f34e1861ecbd116bba7b34430f6f67565a91915` |
| `apps/api/src/modules/field-ops/field-ops.service.ts` | `b6212946764cdf29247d20f2453f977672d1a949` |
| `apps/api/src/modules/daily-reports/daily-reports.service.ts` | `4fbdda93a63b1df10878b751fafd18df727aec5a` |
| `apps/api/src/infrastructure/audit/audit.service.ts` | `2b71cfb3a5d532db8cbbc0acc4d0da76d8fdf5de` |
| `apps/api/src/modules/auth/auth.controller.ts` | `88e13e588f6f0d26ba5b91965c116661d604b3c9` |
| `apps/api/src/modules/auth/auth.service.ts` | `68aec7c15a0092e458e272870b1fbd7b2b38d1d0` |
| `apps/api/src/modules/auth/auth.repository.ts` | `754978eaba71cd9fea6b490e75bda9381d1d0799` |
| `apps/api/src/common/rbac.guard.ts` | `6ab6384ce1adffb3599e45d137d6511e83c4ebfb` |
| `apps/worker/src/main.mjs` | `e4dd0f6ea87b21af701e66cfb958e8ee49288ebd` |
| `packages/db/prisma/schema.prisma` | `147d5ad154ee515205643f62359c5d5922ee93c7` (coincide con Plan 3 §32.1) |
| `docs/runbooks/WORKER_SERVICE_IDENTITY_MEMBERSHIP.md` | `75d4840de734c8c2b0bfa8f0b21ef8c8f916d8cf` (coincide; sigue «propuesto, no ejecutado») |
| `docs/foundation/EVENT_CATALOG.md` | `3d206645043896779db5e7e9beb01eba8bb22739` |
| `.github/workflows/ci.yml` (raíz exterior) | `eaa25210ca098915be7931bdb807d070f89b555b` |

**Corrección a Plan 3 §32.1 (fila CI).** Plan 3 v70 afirmaba que no se localizaron workflows. En este checkout los workflows sí existen en la **raíz exterior** del repositorio (`.github/workflows/`, 19 archivos), no bajo `project-manager-app/`. `ci.yml` se dispara en `push` a `main`, `pull_request` y `workflow_dispatch`; su job `quality-gates` ejecuta `pnpm spec:validate:strict --base-ref`, `spec:audit-plan-coverage`, `spec:index:check` y las pruebas unitarias de los validadores; `unit-coverage` y E2E son jobs separados (E2E `needs: quality-gates`). Ningún workflow se dispara con `push` a ramas distintas de `main`. Esto describe configuración en el repositorio; no prueba qué checks son obligatorios por branch protection ni que se hayan ejecutado para esta revisión.

## 10.11 Inventario completo de escritores de TimeEntry

Método reproducible (desde `project-manager-app/`): `grep -rnE "timeEntry\.(create|createMany|update|updateMany|upsert|delete|deleteMany)"` sobre `apps packages scripts` excluyendo `dist/` y pruebas; búsqueda de SQL `"TimeEntry"` en `.ts/.mjs/.js/.sql`; revisión de relaciones `onDelete` del modelo y de borrados de modelos padre. Resultado: **9 llamadas directas en 3 archivos**, ningún `upsert`, `delete`, `createMany` ni SQL DML en código de aplicación; sí hay escritores **indirectos** por relaciones de clave foránea y en migraciones/scripts.

### 10.11.1 Escritores directos (código de aplicación)

| # | Archivo:línea (blob arriba) | Función | Ruta HTTP y guard | Actor / scope del `WHERE` | Operación | Auditoría observada | CAS / revisión |
|---|---|---|---|---|---|---|---|
| W1 | `labor-engine.repository.ts:151` | `createTimeEntry` (sin `clientEventId`) | `POST /v1/labor/timer/start`, `POST /v1/labor/entries/manual` — `field-ops:write` | `createdBy = actor.userId`, `tenantId`/`orgId` de sesión | INSERT | Ninguna en Labor Engine | No aplica; sin revisión inicial |
| W2 | `labor-engine.repository.ts:159` | `createTimeEntry` (con `clientEventId`) | ídem | ídem; unicidad `@@unique([tenantId, createdBy, clientEventId])` | INSERT idempotente: ante violación de unicidad devuelve la fila existente | Ninguna | Idempotencia de **creación** demostrada en código; no cubre updates |
| W3 | `labor-engine.repository.ts:257` | `pauseTimeEntryInternal` | `POST/PATCH /v1/labor/timer/:id/pause` — `field-ops:write`; y `admin/timer/:id/pause` — `ops:dashboard:write` | propia: lectura previa `id+tenantId+createdBy`; admin: lectura previa `id+tenantId` **sin `orgId`**; el `update` filtra sólo `id` | UPDATE `status, pausedAt, accumulatedSeconds, updatedAt` | Ninguna | Leer-luego-escribir sin precondición: ventana de *lost update* |
| W4 | `labor-engine.repository.ts:272` | `resumeTimeEntry` | `timer/:id/resume` — `field-ops:write` | lectura `id+tenantId+createdBy`; `update` por `id` | UPDATE `status, resumedAt, pausedAt, updatedAt` | Ninguna | Sin precondición |
| W5 | `labor-engine.repository.ts:281` | `updateTimeEntryNotes` | `timer/:id/notes` — `field-ops:write` | ídem | UPDATE `notes, updatedAt` | Ninguna | Sin precondición |
| W6 | `labor-engine.repository.ts:306` | `stopTimeEntryInternal` | `timer/:id/stop` — `field-ops:write`; `admin/timer/:id/stop` — `ops:dashboard:write` | propia o admin (tenant-wide, **sin `orgId`**) | UPDATE `status, endedAt, accumulatedSeconds, durationMinutes, notes, updatedAt` | Ninguna | Sin precondición |
| W7 | `field-ops.repository.ts:337` | `createTrackerSession` | rutas tracker de Field Ops (legado) — `field-ops:write` | `createdBy` del actor | INSERT | `AuditService.append` **después** de escribir (`field-ops.service.ts:262`, `:468`) | No |
| W8 | `field-ops.repository.ts:395` | `updateTrackerSession` | pause/resume/stop/notes del tracker legado | el servicio valida `tenantId+createdBy` antes; el repositorio lee y actualiza **sólo por `id`** | UPDATE estado/tiempos/notas | `append` posterior en pause/resume/stop (`:309`, `:352`, `:397`); **sin auditoría** en `updateTrackerSessionNotes` (`:413`) | No |
| W9 | `labor-policy.service.ts:317` | `review` (BO-08, `APPROVE`) | rutas BO-08 — `requireManage` (`org:labor:manage`, Membership `ACTIVE`, sin autorrevisión) | `id+tenantId+orgId` dentro de `$transaction` | UPDATE `startedAt, endedAt, breakMinutes, durationMinutes, editedBy, editReason` | `AuditService.append` **fuera** de la transacción | No compara snapshot original; detalle en §10.2 |

### 10.11.2 Escritores indirectos y no productivos

| # | Mecanismo | Efecto sobre TimeEntry | Clasificación |
|---|---|---|---|
| I1 | `TimeEntry.tenant` `onDelete: Cascade` | Borrar un `Tenant` borra sus TimeEntry (y `TimeEvidence` en cascada) | Escritor indirecto. No se encontró borrado de Tenant en `apps/`; sí en scripts de smoke (I5). |
| I2 | `TimeEntry.job` `onDelete: SetNull` | Borrar un `Job` pone `jobId = NULL` **sin** pasar por Labor Engine; Prisma actualiza `updatedAt` sólo en escrituras vía cliente, no en acciones referenciales de la BD | Escritor indirecto que **no** incrementaría una futura revisión. No se encontró `job.delete` en `apps/`. |
| I3 | `TimeEntry.freeProject` `onDelete: SetNull` | Igual que I2 para `freeProjectId` | `DELETE /v1/labor/free-projects/:id` existe; el servicio indica archivo y conservación de horas — confirmar con owner que nunca hace borrado físico. |
| I4 | Migraciones `20260718000000_consolidate_tracker_session` (INSERT histórico), `20260722010000_time_entry_client_idempotency`, `20260731140000_add_labor_engine_geolocation` (ALTER) | Backfill/DDL ya versionados | Históricos; cualquier futura columna `revision` exige backfill de filas existentes. |
| I5 | `scripts/*-smoke.mjs` (`buildops-rerun-bridge-smoke`, `intake-to-buildops-smoke`, `buildops-client-approval-smoke`, `monetizable-flow-smoke`, `api-autonomy-local-llm-smoke`) con `job.deleteMany`/`tenant.deleteMany` | Borran en cascada TimeEntry del tenant de prueba | No productivos; no deben ejecutarse contra producción. |
| I6 | `apps/api/test/*` | Fixtures | No productivos. |

Lectores (no escriben): `daily-reports.service.ts` (1), `geofence.service.ts` (1), `field-ops.repository.ts` (5), `labor-engine.repository.ts` (14), `labor-policy.service.ts` (1). `labor-chat.service.ts` (Cronos) sólo lee datos propios vía `LaborEngineService` (`listEntries` con `createdBy = userId`, `limit: 15`) y no escribe TimeEntry.

### 10.11.3 Contrato requerido (no implementado)

1. **Revisión monotónica única.** Todo writer W1–W9 incrementa una única revisión en el mismo `UPDATE`, condicionando el `WHERE` a `id + tenantId + orgId + revision = esperada`. `count = 0` ⇒ conflicto tipado; nunca reintento ciego. Los escritores indirectos I2/I3 deben eliminarse (sustituir borrado físico por archivo) o reemplazarse por una ruta canónica que también incremente la revisión; si el owner mantiene `SetNull`, la garantía CAS **no** cubre `jobId/freeProjectId` y debe declararse.
2. **Scope.** Las rutas admin W3/W6 resuelven hoy por `tenantId` sin `orgId`. Antes de usarlas en conciliación, el owner de Plan 4 debe decidir si el scope correcto es organización y aprobar la semántica ResourceScope; esta SDD no la cambia.
3. **Auditoría en la misma transacción.** Cada mutación confirmada inserta su evento con `appendInTransaction` (o mecanismo que el owner apruebe) dentro de la misma transacción; un fallo de auditoría revierte la mutación. Hoy **ningún** writer de TimeEntry usa `appendInTransaction` (único llamador en la API: `professional-skills/skills.service.ts:64`).
4. **Idempotencia.** Creación: reutilizar `clientEventId`. Mutaciones y aprobación BO-08: clave idempotente por operación ligada a `(tenant, org, recurso, revisión esperada, actor)`; un reintento devuelve el resultado ya persistido sin duplicar evento.
5. **`STALE`.** Estado terminal propio de `LaborTimeCorrection`, distinto de `REJECTED` y `CANCELED` (§10.2). Evento recomendado `labor_correction.stale`; **no existe** en `EVENT_CATALOG.md` (sólo `requested/approved/rejected`, líneas 542–544). Añadirlo requiere el proceso del catálogo; no se inventa aquí.

## 10.12 Identidad de workers y tareas programadas

**Hechos de código (`apps/worker/src/main.mjs`, `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts`):**

- El worker lee de variables de entorno `SEMSE_USER_ID`, `SEMSE_TENANT_ID`, `SEMSE_ORG_ID`, `SEMSE_ROLES` y `SEMSE_WORKER_ID` (por defecto `worker-local-<pid>`).
- Obtiene sesión con `POST /v1/auth/token` (`@Public`, throttle 5/min), autorizado sólo por el header de *bootstrap token*. El cuerpo declara `userId/tenantId/orgId/roles`; `issueSession` persiste una `AuthSession` con esos valores sin comprobar en ese momento que el usuario exista o tenga membresía. La auditoría `auth.session.issued` es *fire-and-forget* (`void this.auditService.append(...)`).
- En cada request, `authenticateRequest` → `findActiveSessionAuthorization` exige `User.status = active` y calcula `intersectSessionRoles(membresías ACTIVE en la org, roles de sesión, roles del token)`; sin intersección ⇒ 401. **La autorización efectiva queda acotada por membresías reales**, pero el principal es una fila `User` elegida por configuración.
- Runbook `WORKER_SERVICE_IDENTITY_MEMBERSHIP.md`: propone `usr_worker_system` en `org_admin_001` con `OPS_ADMIN, WORKER, EVENT_CONSUMER`; estado «propuesto, no ejecutado». No se consultó si esas membresías existen.
- `AuditLog` no tiene tipo de principal (`actorUserId` opcional, `onDelete: SetNull`); `DomainOutboxEvent` sí tiene `actorType/actorId`, pero no hay contrato que los vincule con la sesión del worker. `OpsService` presenta `actorUserId = null` como `"system"` (sólo presentación).

**Clasificación:**

| Concepto | Estado |
|---|---|
| Autenticación técnica del worker | Existe (bootstrap → sesión durable → JWT). |
| Identidad durable de workload | **No existe** como tipo: el worker opera como un `User` humano-equivalente; no hay atestación de que la llamada provenga del workload (cualquier portador del bootstrap token puede emitir sesión para cualquier `userId` activo con membresías — riesgo a clasificar por Plan 4/seguridad, sin afirmar incidente). |
| Grant efectivo | Determinado en runtime por membresías `ACTIVE`; no verificado (no se consultó producción). |
| `workerId` | Etiqueta libre de entorno; no es identidad. |

**Contrato necesario (owner: identidad/runtime + Plan 4):** principal de servicio tipado y persistido (p. ej. `actorType = SERVICE`, `actorId` estable) distinto de usuario; emisión de credencial ligada a ese principal y no a un `userId` arbitrario; grant mínimo por capability y organización; atribución ejecutor→operación→`correlationId` en auditoría/outbox; comportamiento ante principal ausente/expirado/sin grant = denegar y registrar «identidad no verificada». Hasta entonces, cualquier operación de conciliación cuya auditoría dependa de atribución de servicio queda **bloqueada**. No se crean identidades, membresías ni grants.

## 10.13 Auditoría: hechos y contrato de tres clases

**Hechos (`audit.service.ts` blob `2b71cfb3…`, `schema.prisma`):**

- `AuditEntry` recibe `orgId`, pero `auditData()` **no lo persiste** (el modelo `AuditLog` no tiene columna `orgId`); `orgId` sólo se usa para `ensureActorContext`.
- El `id` que envían los llamadores se ignora; se genera `aud_<uuid>`.
- `append()` abre su propia escritura (fuera de cualquier transacción de dominio); `appendInTransaction(entry, tx)` usa la transacción del llamador. Único uso de `appendInTransaction` en `apps/api/src`: `professional-skills/skills.service.ts:64`.
- `AuditLog.tenant` `onDelete: Cascade`: borrar un tenant borra su auditoría. `AuditLog.actor` `onDelete: SetNull`: borrar un usuario borra la atribución.
- Lectores: `GET /v1/ops/audit` (tenant, `occurredAt DESC`, límite 100, puede crear contexto de actor al leer) y `GET /v1/domain-events` (tenant, eventos `domain.event.emit`). Ninguno filtra por organización ni por caso.
- No se localizó registro durable de decisiones ALLOW/DENY: `RbacGuard` lanza `ForbiddenException` sin escribir auditoría.

**Contrato mínimo (lógico; persistencia, tabla, retención, proveedor y capabilities por decidir):**

| Clase | Owner | Campos mínimos | Minimización | Fallo |
|---|---|---|---|---|
| A. Decisión ALLOW/DENY | Plan 4 | principal (tipo+id o ausente), acción/capability, tipo+id de recurso, tenant, org solicitada y resuelta, versión de política/autoridad, resultado, motivo normalizado (catálogo pendiente), `correlationId`, instante | sin notas, Evidence, tokens ni payloads | DENY nunca se convierte en ALLOW por fallo del registro; si la política exige registro de ALLOW y falla, denegar |
| B. Mutación confirmada | Plan 3 / Labor | principal ejecutor, iniciador (si aplica), recurso, tenant, org, tipo de cambio, revisión anterior→nueva, `decisionCorrelationId` (enlace con A), `correlationId`, idempotency key | before/after sólo de campos horarios necesarios | atómica con la mutación; sin evento de éxito si no hay commit; conflicto `STALE` persiste su propio evento |
| C. Lectura sensible | Plan 4 + auditoría | principal, acción de lectura, recurso/scope, resultado de autorización, propósito (si producto lo define), `correlationId` | nunca el contenido leído | fail-closed **sólo** si la política aprobada lo exige |

Correlación: A.`correlationId` = B.`decisionCorrelationId` = C.`correlationId` cuando la misma petición decide, lee y muta. Lectores autorizados del log bruto, retención y catálogo de motivos: **requiere decisión** del owner de auditoría/seguridad. No se afirma atomicidad universal por la existencia de `appendInTransaction`.

## 10.14 Perfil horario y reglas aplicables

**Hechos:**

- `LaborSchedulePolicy` (BO-08) versionada por `tenantId + orgId + scopeKey (ORG | worksiteId)`: `weekdays`, `scheduledStartMinute/EndMinute` («minutos desde medianoche local»), `expectedBreakMinutes`, `overtimeAfterMinutesPerDay`, `status ACTIVE|SUPERSEDED`, `createdByUserId`. **No tiene** zona horaria IANA, inicio de semana, asignación por trabajador/turno, jurisdicción, elegibilidad de horas extra ni validador.
- `schema.prisma` no contiene ningún campo `timezone`/`timeZone`/`weekStart`.
- `createManualEntry` construye `new Date("YYYY-MM-DDTHH:mm:00")` sin zona: la hora se interpreta en la zona del **proceso de la API** (no verificada en producción).
- Semana: `labor-engine.service.ts` calcula lunes 00:00 en hora local del proceso; `labor-engine.repository.ts` usa lunes **UTC** para `weekKey`. Dos definiciones distintas en el mismo módulo.
- El respaldo del Site trae `settings` con `breakMinutes`, `breakPaid`, `threshold`, `weekStart`; son configuración local del Site, **no** fuente activa.

**Fuente autorizada:** no existe hoy una fuente canónica que asigne a cada trabajador organización, turno, jurisdicción, zona, inicio de semana, pausas y elegibilidad. **No se elige perfil por defecto ni se calcula overtime** cuando falte asignación o validación: el resultado es «pendiente de configuración».

**Entradas versionadas mínimas para reproducir un cálculo** (cada una con id, versión, vigencia, autor y aprobador): perfil horario; asignación trabajador↔perfil↔org↔Job/sitio; zona IANA; inicio de workweek fijo de 168 h (distinto del periodo de conciliación salvo verificación); política de pausas confirmadas; regla diaria operativa (8 h, control); política de prima diaria de empresa (sólo si la org la activa); regla legal semanal (fuente oficial, fecha de consulta, jurisdicción, responsable de validación, clasificación revisada de la persona); versión del algoritmo (`computeLaborTime` u otro); revisión de cada TimeEntry leída.

**Separación producto/legal:** la regla federal FLSA citada en §9.9 se consultó el 16–17 nov 2026 y es contexto, no determinación; la jurisdicción estatal (Florida para Gulf Breeze/Pensacola) **no** fue validada. Cualquier afirmación legal exige responsable designado. Los datos del piloto (12 h propuestas, 80 h «de lunes a lunes» propuestas, 10 h + 1 h de descanso habituales, modalidades de pausa) son declaraciones de contexto, **no** asistencia confirmada ni regla de equipo.

## 10.15 Evidence (coordinación con Plan 6)

- `TimeEvidence` (`schema.prisma`) cuelga de `TimeEntry` con `fileUrl` libre; **sin** FK a `Evidence`, sin `tenantId/orgId`, sin checksum ni versión; ningún código usa `prisma.timeEvidence` (coincide con Plan 2 v36r2 §2.24).
- Plan 6 en Drive (`SEMSE_Plan_6_Evidence_Custodia.md`, versión documental 27, 20 nov; la referencia heredada era Library v24): P6-02 Opción A (captura textual con procedencia) para el primer slice; objetos Evidence, permisos de objeto, checksum, archivos, cámara y OCR en fases posteriores; implementación «no lista».
- D6-01 (servicio/modelo), D6-04 (retención/borrado) y D6-09 (lectura/retiro/reemplazo): **siguen abiertos**; no hay decisión nueva verificable.
- Plan 6 v27 (tabla D6-04) asigna la **retención de las declaraciones textuales** del caso al contrato general de Plan 3/5: requiere decisión de owner (Plan 3/5 + privacidad/legal); no se fija aquí plazo ni mecanismo.
- Para el primer slice: conciliación registra sólo la **declaración textual de la fuente** (emisor, declarante, procedencia, periodo, alcance) sin referencia a objetos Evidence; OCR/extracción fuera. No se abrió, descargó ni copió ningún binario.

## 10.16 Baseline histórico — revalidación 21 de noviembre de 2026

Insumos (texto, no binarios de Evidence) desde la carpeta Drive Plan 2, verificados por SHA-256:

| Archivo | SHA-256 | Resultado |
|---|---|---|
| `semse-20-registros-original-respaldo.csv` | `bf6754ad13dd38ade86adc02bb5b26a9c255445c1b068ef4258d0b0692e585d4` | coincide con el expediente de 120 s |
| `semse-conciliacion-respaldo-2026-11-15-REFERENCIA.json` | `821f55d183fbade159ee20a268aec9d90bf8714ce4bbd13292077689b1ecb357` | coincide |
| `SEMSE_Reconstruccion_Filtros_Respaldo.csv` (derivado Plan 3) | `3b75339380d8263ebfdce63c4d11253b5a00d8041180a0010e92eb15f49d1eba` | coincide con Plan 2 v36r2 §2.20 |

Verificador `plan3_baseline_verify.py` (sólo agregados; SHA-256 `39982644dde9925716420e0c67c730ef11a260cfd4ddf0af828b31cfbd2e1336`), `python3 -I`:

| Control | Resultado |
|---|---|
| IDs JSON = IDs CSV | 20 = 20, únicos, 0 sólo-en-uno |
| `duracion_h` por ID JSON vs CSV | 0 discrepancias |
| Respaldo completo | 619,140 s (171.983333 h); suma redondeada por fila 171.99 h; diferencia 24 s por redondeo |
| 15 `payable` no sintéticas | 617,520 s (171.533333 h); 171.54 h redondeadas |
| 4 `job_linked` | 1,620 s (0.45 h); un solo proyecto; el respaldo no tiene columna de trabajador ⇒ atribución por persona **no derivable** |
| 1 sintética | 0 s |
| `payable` − 171.50 h | **+120 s**, sin causa demostrada |
| Duraciones `payable` múltiplos de 60 s | sí (Σ `seg mod 60` = 0) |
| Marcas vs duración (`payable`) | 11/15 filas difieren; Δ = +436.489 s con milisegundos (+432 s truncando por fila). Coincide con Plan 2 v36r2 §2.30 (+436 s). Origen de `duracion_h` pendiente de revisión |
| Propuestas | 4 × 10 h, estado «propuesta pendiente», ligadas a originales de 21.95 / 14.08 / 8.45 / 9.97 h (2–5 nov) |
| Notas de timer olvidado | 2 entradas |

No se localizó HTML v4 **publicado** con hash/linaje ni exportación/captura original con periodo, filtros y datos. `SEMSE_Conciliacion_Horas_v4.html` en Drive Plan 2 es la copia local (`2de8406d…` según Plan 2); no se afirma que sea la publicada. **Los 120 s quedan como discrepancia sin causa demostrada y excluidos del total confirmado.** Propuestas nunca se suman a originales.

## 10.17 C3-17 — Ajuste por vencimiento al tiempo de la compañía pagadora (decisión de producto **aprobada** 2026-11-21)

### 10.17.1 Registro de la decisión

| Campo | Valor |
|---|---|
| ID | **C3-17** (mismo ID que Plan 3 §9 y Plan 4 v37; no se crea un ID nuevo) |
| Texto aprobado (literal) | «Si una conciliación de horas sigue sin resolverse después de 24 horas, SEMSE ajustará el tiempo conciliado al tiempo que estableció la compañía que paga ese trabajo.» |
| Aprobador | Dueño del producto |
| Fecha | 2026-11-21 (fecha del proyecto; no se registró una hora exacta) |
| Trazabilidad | Instrucción expresa del dueño en la sesión de trabajo del 21-11-2026 que encarga esta revisión v0.9; registro espejo `SEMSE_Plan3_Registro_Aprobacion_C3-17_2026-11-21.md` en la carpeta Drive del Plan 3 |
| Estado anterior | Plan 3 §9 C3-17: «incorporado al borrador el 19 de noviembre de 2026», sin aprobación. SDD v0.8 §10.17 lo trató como «diseño pendiente» sin citar el ID; v0.9 corrige esa omisión |
| Tipo | **Decisión de producto aprobada.** Define el resultado de la conciliación |
| Lo que **no** hace | No concede permisos, grants ni membresías. No demuestra autoridad legal o contractual de la compañía pagadora. No autoriza modificar una entrada original de `TimeEntry`. No autoriza implementación, migración, prueba funcional, CI, despliegue ni activación. No ejecuta factura, nómina, escrow, payout ni pago |

### 10.17.2 Requisitos derivados de la decisión (firmes)

- **R-C317-01.** Cuando se cumplan las condiciones de vencimiento (§10.17.3), el **resultado** de la conciliación del alcance afectado pasa a ser el tiempo establecido por la compañía que paga ese trabajo.
- **R-C317-02.** `TimeEntry` no se modifica: las marcas, pausas y duración originales permanecen. El ajuste es un resultado versionado del caso de conciliación, no una corrección horaria. Cualquier corrección de `TimeEntry` sigue su propio flujo canónico (C3-05, BO-08).
- **R-C317-03.** El ajuste conserva, enlazados e inmutables: (a) la declaración original (las horas de `TimeEntry` comparadas, con su revisión o corte, y la declaración del trabajador o del registro); (b) la declaración/propuesta de la compañía pagadora, con emisor, declarante, procedencia, versión, periodo y alcance; (c) la diferencia; (d) la resolución aplicada (`ajuste por vencimiento C3-17`, versión de la regla); (e) el ejecutor (principal de servicio verificable, separado del iniciador, del declarante y del destinatario afectado); (f) el evento de auditoría clase B correlacionado.
- **R-C317-04.** Sin el principal ejecutor verificable (§10.12) o sin auditoría atómica (§10.13 clase B), el ajuste **no se aplica**: el caso permanece pendiente con motivo «ajuste C3-17 bloqueado» y no se registra un resultado sustituto.
- **R-C317-05.** El ajuste es idempotente: un reintento sobre el mismo caso, versión y vencimiento devuelve el resultado ya persistido sin duplicar evento.
- **R-C317-06.** Concurrencia con resolución humana: una sola transición gana, según la revisión del caso (CAS). Si gana la resolución humana, el vencimiento no aplica. Si gana el vencimiento, una resolución posterior sólo es posible como **reapertura** autorizada (C3-09), que conserva el ajuste en el historial.
- **R-C317-07.** El ajuste sólo se aplica a un alcance comparable. Con una declaración agregada (C3-07), el resultado queda agregado; no se reparte por trabajador, día o Job.
- **R-C317-08.** La IA no aplica, propone como decidido ni adelanta el ajuste; sólo puede explicar el estado del plazo a partir de datos registrados.

### 10.17.3 Detalles operativos pendientes de confirmación (no inventados)

Ninguna fuente vigente aprobada los fija. Plan 3 §9.13 (borrador del 19-nov) y Plan 4 v37 (línea «C3-17 … tras 24 horas desde un aviso registrado») proponen **como candidato** contar desde una notificación registrada; la aprobación del 21-nov no lo confirma.

| ID | Detalle | Candidato en fuentes (no confirmado) | Owner |
|---|---|---|---|
| P-C317-01 | Evento que inicia el plazo de 24 h | «notificación registrada del Time Tracker al usuario» (§9.13) | Dueño del producto — **Confirmado 21-11: creación de la notificación (R-C317-10); P-01b abierto** — **[v0.12] precisado por la regla 1 (R-C317-13)** |
| P-C317-02 | Zona horaria/reloj que rige; si 24 h son transcurridas por instante (UTC) o civiles | ninguno | Dueño del producto + Labor — **Confirmado 21-11: 24 h transcurridas entre instantes (R-C317-11)** |
| P-C317-03 | Cómo se notifica, a quién (trabajador, compañía pagadora, responsable de la obra) y cómo se acredita la recepción | «notificación registrada» sin canal definido | Producto + notificaciones — **Aprobado 21-11 (regla 2, R-C317-14), §10.17.8** |
| P-C317-04 | Qué estados cuentan como «sin resolverse» (en revisión, aclaración solicitada, devuelto, disputa); si una disputa suspende el plazo | ninguno | Dueño del producto — **Aprobado 21-11 (regla 3, R-C317-15), §10.17.8** |
| P-C317-05 | Qué es exactamente «el tiempo que estableció la compañía que paga»: versión vigente del parte; qué ocurre si el parte se sustituye dentro del plazo (¿reinicia?) | §9.13: «la SDD debe definir cómo se renueva el plazo si las fuentes cambian» | Dueño del producto — **Aprobado 21-11 (regla 4, R-C317-16), §10.17.8** |
| P-C317-06 | Alcance del efecto de «tiempo conciliado»: ¿sólo base de facturación entre compañías (texto de C3-17 del 19-nov) o también el resultado mostrado al trabajador y a su organización? (Nómina y pagos quedan excluidos en cualquier caso) | C3-17 v19-nov: «base de facturación» | Dueño del producto — **Confirmado 21-11: sólo base de facturación (R-C317-12)** |
| P-C317-07 | Cómo se identifica a la compañía que paga un trabajo (fuente canónica Job → organización pagadora) | ninguno verificado en código | Producto + Plan 4 — **Confirmado 21-11: emisor declarado; si no, `Job.clientOrgId` (R-C317-09)** |
| P-C317-08 | Dirección: la lectura literal aplica tanto si el parte del pagador es menor como si es mayor que `TimeEntry`; confirmar | literal del texto aprobado | Dueño del producto — **Aprobado 21-11 (regla 5, R-C317-17: sube o baja), §10.17.8** |
| P-C317-09 | Reapertura tras el ajuste con evidencia nueva: quién y con qué motivo | §9.13 punto 4 y C3-09 (diseño) | Dueño del producto + Plan 4 — **Aprobado 21-11 (regla 6, R-C317-18), §10.17.8** |

Mientras un detalle esté pendiente, la implementación no puede fijarlo con un valor por defecto.

### 10.17.4 Gates técnicos que siguen aplicando

El ajuste automático **no se implementa** hasta que la SDD esté aprobada y se cierren, con evidencia: G04 (identidad del ejecutor de servicio), G06–G07 (auditoría A/B atómica), G10 y G12 (CAS e idempotencia), G13 (estados terminales del caso), G01/G03 (lectura y ResourceScope del alcance comparable), un mecanismo de ejecución programada con identidad (worker; hoy bloqueado por §10.12) y la autorización de Plan 4 para el actor de servicio sobre el caso.

### 10.17.5 Trazabilidad específica

| Decisión | Requisito | Contrato | Aceptación observable | Prueba prevista | Estado / evidencia |
|---|---|---|---|---|---|
| C3-17 aprobada 21-11 | R-C317-01 | resultado versionado del caso = tiempo del pagador | tras el vencimiento el caso muestra «ajustado por vencimiento C3-17» con ambos valores y la diferencia | T-V01 | Decisión **aprobada**; prueba NO EJECUTADA |
| C3-17 | R-C317-02 | sin writer de TimeEntry en conciliación | `TimeEntry` idéntico (revisión y campos) antes y después | T-V02 | NO EJECUTADA |
| C3-17 | R-C317-03 | snapshot inmutable a–f | el historial reconstruye original, propuesta, resolución, ejecutor y evento | T-V03 | NO EJECUTADA |
| C3-17 | R-C317-04 | fail-closed por identidad/auditoría | sin ejecutor válido o con fallo de auditoría: sin ajuste y con motivo | T-V04, T-V05 | Bloqueado por G04/G07 |
| C3-17 | R-C317-05 | clave idempotente | reintento sin duplicar | T-V06 | Bloqueado por G12 |
| C3-17 | R-C317-06 | CAS del caso | carrera en el borde de 24 h: un solo ganador | T-V07 | Bloqueado por G10 |
| C3-17 | R-C317-07 | alcance comparable | parte ambiguo o alcance incompatible: no se ajusta | T-V08 | NO EJECUTADA |
| C3-17 | Detalles P-C317-01…09 y residual P-C317-01c resueltos (§10.17.7–§10.17.9) | — | — | T-V09…T-V22 | **Requiere decisión** |

### 10.17.6 Evidencia de código para decidir P-C317-01…09 (v0.10; sólo hechos, sin elegir valores)

Inspección estática de `main@86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f` (`schema.prisma` blob `147d5ad154ee515205643f62359c5d5922ee93c7`; `notifications.repository.ts`; `daily-reports.service.ts`). No define ninguno de los detalles: describe con qué piezas reales contaría cada opción.

| Detalle | Hecho en código | Consecuencia para la decisión |
|---|---|---|
| P-C317-01 inicio | `Notification` es por `userId` + `tenantId`, sin `orgId`. `sentAt` se fija **al crear la fila** (`notifications.repository.ts`, `sentAt: new Date()`), no al entregarla. `readAt` se fija cuando el usuario la lee. `OutboundDelivery` (WhatsApp/SMS) tiene estados `QUEUED/SENT/DELIVERED/READ/FAILED`. | «Notificación registrada» puede significar creación (`sentAt`), entrega acreditada (sólo canales externos) o lectura (`readAt`). Si se cuenta desde la lectura, el plazo depende de que la parte la abra. Una compañía pagadora sin cuenta (C3-01) no puede recibir `Notification`. |
| P-C317-02 zona/reloj | Ni `Org` ni `Worksite` ni `LaborSchedulePolicy` tienen zona horaria. Labor Engine usa la zona del proceso (servicio) y UTC (repositorio). Daily Reports recibe un `tzOffsetMinutes` fijo enviado por el cliente (no IANA). | Hoy no hay una zona canónica por organización u obra. Un plazo medido como 24 h transcurridas entre instantes no necesita zona para calcularse, sólo para mostrarse. Un plazo «civil» requiere una zona canónica, que hoy no existe (G19/G20). |
| P-C317-03 notificación | Canales `IN_APP/EMAIL/PUSH/SMS/WHATSAPP`. Acreditación de entrega sólo para salidas externas (`OutboundDelivery.status`). | Acreditar la recepción exige un canal con estado de entrega o una confirmación explícita. El in-app sólo acredita creación o lectura. |
| P-C317-04 «sin resolverse» | No existe modelo de caso de conciliación ni estados en el esquema (B4-05). | Los estados que detienen o no el plazo se definen por primera vez en la SDD; no hay comportamiento previo que preservar. |
| P-C317-05 versión del parte | No existe modelo de declaración externa. | El ajuste debe referenciar una versión concreta (R-C317-03). La decisión es si cambiar la versión reinicia el plazo o no. |
| P-C317-06 efecto | `Contract` → `PaymentEscrow` existe; conciliación no escribe ahí (C3-05, fuera de alcance). | El efecto se limita al resultado del caso, sea cual sea la opción; ninguna opción toca escrow ni pagos. |
| P-C317-07 pagador | `Job.clientOrgId` (obligatorio, `Org`), `Contract.clientOrgId` (opcional), `BusinessEngagement` (trabajador↔org empleadora). No hay entidad «compañía pagadora externa sin cuenta». `TimeEntry.jobId` puede ser nulo. | `Job.clientOrgId` es un candidato, no una prueba: el cliente del Job puede no ser quien paga las horas del trabajador (p. ej. un contratista intermedio), y una entrada sin Job no tiene pagador derivable. |
| P-C317-08 dirección | — | Decisión de producto pura. |
| P-C317-09 reapertura | C3-09 (diseño) y BO-08 sin delegación implementada. | Depende de Plan 4. |

El paquete de opciones para el dueño está en `SEMSE_Plan3_Paquete_Decisiones_C3-17_2026-11-21.md` (Drive Plan 3). Las recomendaciones técnicas de ese paquete no son decisiones y no se reflejan como requisitos hasta que el dueño las confirme.

### 10.17.7 Detalles de C3-17 confirmados por el dueño (2026-11-21, v0.11)

El dueño respondió en la sesión de trabajo del 21-11-2026 a las preguntas del paquete `SEMSE_Plan3_Paquete_Decisiones_C3-17_2026-11-21.md`. Las respuestas quedan como **decisiones de producto confirmadas**. No cambian permisos ni el estado `DRAFT` y no autorizan implementación.

| ID | Respuesta del dueño | Requisito resultante |
|---|---|---|
| P-C317-07 | «Ambas con prioridad»: el emisor declarado del parte si existe; si no, el cliente del Job (`Job.clientOrgId`) | **R-C317-09.** La compañía pagadora de un alcance es (1) el emisor registrado en la declaración vigente, vinculado al Job o alcance por un capturista autorizado; (2) si no hay emisor declarado, `Job.clientOrgId` del Job vinculado. Si no hay ni emisor ni Job, no hay pagadora identificable y el ajuste **no aplica**. El resultado registra cuál de las dos fuentes se usó. **[v0.12] acotado al mismo Job y alcance verificable (§10.17.8)** |
| P-C317-01 | «Creación de la notificación» | **R-C317-10.** El plazo empieza en el instante en que SEMSE crea la notificación de la diferencia a las partes con cuenta (hoy `Notification`, creada con `sentAt`). No requiere lectura ni entrega. Sin notificación creada, el plazo no empieza y no hay ajuste. **[v0.12] precisado por R-C317-13: cuenta la constancia de notificación al usuario** |
| P-C317-02 | «24 h transcurridas» | **R-C317-11.** El vencimiento es inicio + 24 h exactas medidas entre instantes (UTC), sin depender de la zona horaria ni del cambio de horario. La zona horaria sólo se usa para mostrar la hora de vencimiento; mientras no exista una zona canónica (G19/G20), la interfaz debe indicar en qué zona muestra la hora. |
| P-C317-06 | «Sólo base de facturación» | **R-C317-12.** El ajuste fija la **base de facturación** del alcance comparable entre compañías. El trabajador sigue viendo su `TimeEntry` y, por separado, el ajuste y la diferencia. No modifica `TimeEntry`, nómina, escrow ni pagos. |

**Subdetalle nuevo que esta respuesta deja abierto — P-C317-01b:** si SEMSE crea notificaciones para varias partes en instantes distintos, qué instante cuenta (la primera, la del trabajador afectado o la última). No se elige aquí.

**[v0.12]** P-C317-01b, 03, 04, 05, 08 y 09 quedaron resueltos por las seis reglas de §10.17.8; sólo queda P-C317-01c.

**Detalles que seguían pendientes en v0.11:** P-C317-03 (canal, destinatarios y acreditación), P-C317-04 (estados «sin resolverse» y si una disputa suspende el plazo), P-C317-05 (si un parte sustituido reinicia el plazo), P-C317-08 (dirección del ajuste), P-C317-09 (reapertura) y P-C317-01b.

| Decisión | Requisito | Contrato | Aceptación observable | Prueba prevista | Estado |
|---|---|---|---|---|---|
| P-C317-07 confirmado | R-C317-09 | resolución de pagadora con prioridad y fuente registrada | parte con emisor → emisor; sin emisor → `Job.clientOrgId`; sin ambos → sin ajuste | T-V10 | Confirmado; NO EJECUTADA |
| P-C317-01 confirmado | R-C317-10 | inicio = creación de la notificación | sin notificación no hay inicio ni ajuste | T-V11 | Confirmado; NO EJECUTADA (P-01b abierto) |
| P-C317-02 confirmado | R-C317-11 | 24 h entre instantes | vence exactamente a inicio + 86 400 s, también al cruzar un cambio de horario | T-V09 | Confirmado; NO EJECUTADA |
| P-C317-06 confirmado | R-C317-12 | efecto limitado a la base de facturación | `TimeEntry` intacto; el trabajador ve original, ajuste y diferencia por separado | T-V02, T-V12 | Confirmado; NO EJECUTADA |

### 10.17.8 Seis reglas operativas de C3-17 aprobadas por el dueño (2026-11-21, v0.12)

**Fuente:** instrucción expresa del dueño del producto en la sesión de trabajo del 21-11-2026 («Registra estas seis decisiones aprobadas como regla de producto…»). Son **reglas de producto aprobadas**. No conceden permisos, no autorizan código, migraciones, cambios de datos, despliegues ni pagos, y no cambian el estado `DRAFT`.

**Ámbito (precondición común):** las reglas aplican **únicamente** cuando las horas comparadas corresponden al **mismo Job** y al **mismo alcance verificable**. Fuera de ese caso no hay plazo ni ajuste. Esto acota R-C317-09: una pagadora identificada por cualquiera de sus dos fuentes debe referirse al mismo Job.

| # | Regla aprobada (síntesis fiel) | Requisito | Reemplaza o precisa |
|---|---|---|---|
| 1 | El plazo de 24 h empieza cuando el Time Tracker **registra que notificó al usuario** la discrepancia. Sin constancia de la notificación, el plazo no empieza y la diferencia sigue pendiente | **R-C317-13** | Precisa R-C317-10 (v0.11: «creación de la notificación a las partes con cuenta»). El instante que cuenta es la constancia de la notificación al usuario; con eso queda resuelto P-C317-01b |
| 2 | La notificación identifica Job, periodo y alcance comparados, horas de `TimeEntry`, horas del parte y diferencia. Se conserva un registro verificable con destinatario, fecha y hora, canal, resultado disponible del envío y vencimiento calculado. No hace falta que se lea | **R-C317-14** | Resuelve P-C317-03 |
| 3 | «Sin resolver» = al vencer no hay una decisión registrada por una persona autorizada. Si el parte es ambiguo, el alcance no coincide o falta una notificación válida, **no** hay ajuste automático y la discrepancia sigue pendiente | **R-C317-15** | Resuelve P-C317-04 |
| 4 | Si el parte cambia materialmente (horas o alcance), se conserva la versión anterior, se registra la nueva y se notifica la diferencia actualizada; desde esa notificación corre un nuevo plazo de 24 h para la versión nueva. Un cambio que no altere horas ni alcance no reinicia el plazo | **R-C317-16** | Resuelve P-C317-05 |
| 5 | Al vencer sin resolución válida, las horas del parte **vigente** se usan como base de facturación del alcance comparable, **hacia arriba o hacia abajo**. No sobrescribe ni corrige `TimeEntry`; no aprueba nómina, factura ni pago | **R-C317-17** | Resuelve P-C317-08; reconfirma R-C317-12 y R-C317-02 |
| 6 | Tras el vencimiento, una persona autorizada, incluido un supervisor con delegación explícita, puede reabrir con motivo y referencia al ajuste anterior. Se crea una nueva etapa; el historial conserva el ajuste previo y la evidencia nueva. La base de facturación cambia sólo según el resultado de esa revisión autorizada | **R-C317-18** | Resuelve P-C317-09; aplica C3-09 |

**[v0.13: convertida en regla aprobada R-C317-20, §10.17.9]** **Lectura literal registrada, no una regla nueva:** la regla 3 sólo detiene el plazo con una *decisión registrada por persona autorizada*. Una devolución o una disputa (Plan 3 §6: «conservan el asunto pendiente») no son decisiones, así que, según el texto aprobado, no suspenden el plazo. Si el dueño quiere otro tratamiento, debe indicarlo.

**[v0.13: resuelto por R-C317-19, §10.17.9]** **Detalle residual — P-C317-01c:** cuando un mismo alcance comparable afecta a varios usuarios (p. ej. un parte agregado de cuadrilla, C3-07), qué constancia de notificación inicia el plazo. Hasta decidirlo, ese caso no tiene inicio de plazo definido y no recibe ajuste automático, lo que es coherente con R-C317-15.

#### Contrato lógico derivado (sin elegir tablas, endpoints ni capabilities)

- **Constancia de notificación (R-C317-13/14):** registro inmutable con `caseId`, versión del parte, Job, periodo, alcance, horas de `TimeEntry` (con su revisión o corte), horas del parte, diferencia, destinatario, instante, canal, resultado disponible del envío y vencimiento calculado (= instante + 86 400 s, R-C317-11). El modelo `Notification` actual no basta por sí solo: no tiene `orgId` ni Job, su `payload` es JSON libre y no hay inmutabilidad garantizada (§10.17.6). La representación persistente queda sujeta a la SDD aprobada y a la migración que se planifique.
- **Decisión autorizada (R-C317-15):** sólo cuenta una decisión registrada por un principal con autoridad efectiva sobre el caso y la organización (C3-04, Plan 4). Una decisión sin autoridad verificable no detiene el plazo ni lo convierte en ajuste: queda registrada como intento denegado (clase A).
- **Versionado del parte (R-C317-16):** un cambio es material si cambia la cantidad de horas o el alcance; en ese caso se crea una nueva versión, se cierra el plazo de la versión anterior sin ajuste y se abre un nuevo plazo tras la nueva constancia. Un cambio no material (p. ej. una corrección de texto) se versiona sin reiniciar el plazo.
- **Ajuste (R-C317-17):** resultado del caso «base de facturación por vencimiento C3-17» = horas del parte vigente; se guardan la dirección (sube o baja) y la diferencia frente a `TimeEntry`. Se aplican también R-C317-03 a 05.
- **Reapertura (R-C317-18):** nueva etapa enlazada al ajuste anterior, con motivo, actor y delegación verificada (`case.reopen` u otra capability que apruebe Plan 4). El ajuste anterior queda como histórico. La base cambia sólo con la resolución de esa etapa.

#### Gates técnicos y de autorización que siguen pendientes

| Gate | Por qué bloquea estas reglas | Owner |
|---|---|---|
| G04 identidad de servicio | El ajuste y el cálculo del vencimiento los ejecuta SEMSE; hace falta un ejecutor verificable | Identidad/runtime |
| B4-05 / persistencia del caso | No existe modelo de caso, declaración versionada, constancia ni etapa | Labor + Prisma workflow (migración planificada) |
| C3-04 / Plan 4 autoridad de decisión | Para saber si hubo «decisión de persona autorizada» hace falta autoridad efectiva verificable | Plan 4 |
| C3-09 / delegación `case.reopen` | La reapertura por supervisor exige una delegación backend que no existe | Plan 4 |
| G06–G07 auditoría A/B | La constancia, el ajuste y la reapertura requieren auditoría atómica y correlacionada | Plan 4 + auditoría |
| G10, G12, G13 CAS, idempotencia, estados | Carrera entre decisión y vencimiento, reintentos y estados terminales | Labor |
| Ejecución programada | Vencimiento puntual con identidad; hoy el worker no tiene principal de servicio | Runtime + Labor |
| P-C317-01c | Alcances con varios usuarios | Dueño del producto **[v0.13] Resuelto: R-C317-19** |
| G35 CI / pruebas | T-V01…T-V18 sin ejecutar | CI (Plan 10) |

#### Trazabilidad

| Regla aprobada | Requisito | Contrato | Aceptación observable | Prueba prevista | Estado |
|---|---|---|---|---|---|
| Ámbito: mismo Job y alcance verificable | precondición de R-C317-13…18 | comparación sólo en alcance verificable | Job distinto o alcance no verificable → sin plazo ni ajuste | T-V08 | Aprobada; NO EJECUTADA |
| 1 Inicio | R-C317-13 | constancia de notificación al usuario | sin constancia no hay plazo; con constancia, el inicio = su instante | T-V11 (actualizada), T-V13 | Aprobada; NO EJECUTADA |
| 2 Constancia | R-C317-14 | registro inmutable con todos los campos | todos los campos presentes; se puede vencer sin lectura | T-V14 | Aprobada; NO EJECUTADA |
| 3 Sin resolver | R-C317-15 | sólo una decisión autorizada detiene el plazo | parte ambiguo, alcance distinto o notificación inválida → sin ajuste; decisión sin autoridad → no detiene | T-V15 | Aprobada; NO EJECUTADA (bloqueada por Plan 4) |
| 4 Cambio del parte | R-C317-16 | versionado y nuevo plazo | cambio material → versión nueva, nueva constancia, nuevo plazo; cambio no material → plazo intacto | T-V16 | Aprobada; NO EJECUTADA |
| 5 Efecto y dirección | R-C317-17 | base = parte vigente, sube o baja | ajuste en ambas direcciones; `TimeEntry` intacto; sin nómina, factura ni pago | T-V12, T-V17 | Aprobada; NO EJECUTADA |
| 6 Reapertura | R-C317-18 | nueva etapa con delegación | supervisor sin delegación → denegado; con delegación → nueva etapa e historial íntegro | T-V18 | Aprobada; NO EJECUTADA (bloqueada por C3-09/Plan 4) |

### 10.17.9 Precisiones derivadas de C3-17 (2026-11-21, v0.13)

**Fuente:** instrucción expresa del dueño del producto en la sesión de trabajo del 21-11-2026. Son **reglas de producto derivadas** de las decisiones ya aprobadas (C3-07, C3-17 y las reglas 1 a 6 de §10.17.8). No conceden permisos ni autorizan código, migraciones, cambios de datos, despliegues ni pagos.

| # | Tema | Precisión aprobada | Requisito |
|---|---|---|---|
| A | Partes agregados y desglose | Un parte agregado sin desglose **no se atribuye ni se reparte** entre trabajadores. Cuando existe desglose comparable, **cada trabajador recibe su propia notificación** y su plazo de 24 h corre desde esa notificación | R-C317-19 |
| B | Disputa, devolución y vencimiento | Una disputa o devolución **no suspende ni reinicia** el plazo; sólo una decisión registrada por una persona autorizada resuelve la diferencia. Al vencer se aplica la regla aprobada a la base de facturación, salvo que el parte sea ambiguo o el alcance no sea comparable; en esos casos no se ajusta y queda pendiente. `TimeEntry` queda intacto y se conserva el historial | R-C317-20 |

- **R-C317-19** resuelve el residual **P-C317-01c** y es coherente con C3-07 (no repartir agregados). Con desglose comparable, cada trabajador es un alcance comparable propio: su constancia, su vencimiento y su resultado se registran por separado, y en un mismo parte unos trabajadores pueden quedar resueltos por decisión y otros ajustados por vencimiento.
- **R-C317-20** convierte en regla aprobada la lectura literal registrada en v0.12 (§10.17.8, «Lectura literal registrada»): una disputa o devolución no es una decisión. Reafirma R-C317-15, R-C317-17 y R-C317-02.

**Consecuencia registrada (no es una regla nueva):** con R-C317-13 el plazo empieza con la constancia de notificación **al usuario**. Un parte agregado sin desglose no genera notificación por trabajador, así que no tiene plazo ni ajuste automático y su diferencia permanece **pendiente de decisión humana**. Si se quisiera ajustar la base de facturación a nivel agregado, haría falta una regla explícita del dueño; no se presume.

#### Contrato lógico derivado

- Un **alcance comparable por trabajador** sólo existe si el parte trae un desglose de horas por trabajador para el mismo Job, periodo y alcance verificable. No hay prorrateo, inferencia ni asignación por similitud.
- Constancia, vencimiento, decisión o ajuste y auditoría quedan **por trabajador y por versión del parte**. Un cambio material en el desglose de un trabajador abre un nuevo plazo sólo para ese trabajador (R-C317-16).
- Los estados «devuelto» y «en disputa» conservan el asunto pendiente y **no** alteran el vencimiento calculado.

#### Trazabilidad

| Precisión | Requisito | Contrato | Aceptación observable | Prueba prevista | Estado |
|---|---|---|---|---|---|
| A — agregado sin desglose | R-C317-19 | sin atribución ni reparto | parte agregado → ninguna fila por trabajador, sin plazo, diferencia pendiente | T-V19 | Aprobada; NO EJECUTADA |
| A — desglose comparable | R-C317-19 | una constancia y un plazo por trabajador | N trabajadores → N constancias y N vencimientos independientes; resultados mixtos posibles | T-V20 | Aprobada; NO EJECUTADA |
| B — disputa o devolución | R-C317-20 | no altera el vencimiento | registrar disputa o devolución antes del vencimiento → el vencimiento no cambia y se aplica la regla | T-V21 | Aprobada; NO EJECUTADA |
| B — parte ambiguo o alcance no comparable al vencer | R-C317-20 | sin ajuste | vence → sin ajuste, pendiente, `TimeEntry` intacto, historial completo | T-V22 | Aprobada; NO EJECUTADA |

**Gates:** los mismos de §10.17.8 (identidad de servicio, persistencia del caso y de la constancia por trabajador, autoridad de decisión, delegación de reapertura, auditoría, CAS e idempotencia, ejecución programada, CI). Ninguno cambia con estas precisiones.

## 10.18 Matriz de pruebas previstas (ninguna ejecutada)

| ID | Caso | Tipo | Positivo / negativo esperado | Estado |
|---|---|---|---|---|
| T-R01 | Lector propio | HTTP autenticado | ve sólo filas propias y campos permitidos | NO EJECUTADA |
| T-R02 | Lector autorizado (grant/delegación vigente) | HTTP | sólo filas/campos del scope delegado | NO EJECUTADA |
| T-R03 | Revocación entre páginas | HTTP multi-página | página siguiente denegada; sin datos | NO EJECUTADA |
| T-R04 | Otra organización mismo tenant | HTTP | semántica ResourceScope (403 recurso visible / sin filas) | NO EJECUTADA |
| T-R05 | Otro tenant | HTTP | 404/sin revelar existencia | NO EJECUTADA |
| T-R06 | Timestamps repetidos | contrato | orden total por clave temporal + ID; sin duplicados ni pérdidas | NO EJECUTADA |
| T-R07 | Paginación concurrente (create/edit/close/delete lógico) | integración BD aislada | mismo corte o invalidación explícita | NO EJECUTADA |
| T-R08 | Cursor manipulado / de otro actor / otra org / filtros cambiados / vencido | HTTP | error tipado sin datos ajenos | NO EJECUTADA |
| T-W01 | Worker válido con grant | integración | operación atribuida a principal de servicio | NO EJECUTADA (bloqueada §10.12) |
| T-W02 | Worker ausente / token inválido / expirado | HTTP | 401, registro de identidad no verificada | NO EJECUTADA |
| T-W03 | Worker sin grant / sin membresía | HTTP | denegado; `system` nunca aceptado como identidad | NO EJECUTADA |
| T-A01 | ALLOW registrado | integración | fila clase A redactada | NO EJECUTADA |
| T-A02 | DENY + fallo del logger | integración | sigue denegado; sin datos | NO EJECUTADA |
| T-A03 | Lectura sensible con fallo de registro | integración | fail-closed sólo si la política lo exige | NO EJECUTADA |
| T-A04 | Fallo de auditoría en mutación | integración | rollback completo | NO EJECUTADA |
| T-A05 | Correlación acceso→cambio | integración | A.correlationId = B.decisionCorrelationId | NO EJECUTADA |
| T-C01 | Dos writers misma revisión | carrera controlada | uno gana; el otro conflicto; revisión +1 exacta | NO EJECUTADA |
| T-C02 | Edición entre solicitud y aprobación BO-08 | carrera | aprobación → `STALE`, sin cambio horario ni evento `approved` | NO EJECUTADA |
| T-C03 | `STALE` no vuelve a `PENDING` ni se aprueba | unidad/integración | rechazo de transición | NO EJECUTADA |
| T-C04 | Cada writer W1–W9 incrementa revisión | integración | todos | NO EJECUTADA |
| T-C05 | Escritores indirectos I2/I3 | integración | conflicto declarado o ruta canónica | NO EJECUTADA |
| T-I01 | Reintento de creación con `clientEventId` | integración | misma fila | NO EJECUTADA (existe código; no se ejecutó en esta revisión) |
| T-I02 | Reintento de aprobación/mutación | integración | mismo resultado, sin evento duplicado | NO EJECUTADA |
| T-P01 | Sin perfil/asignación/zona | unidad | «pendiente de configuración», sin overtime | NO EJECUTADA |
| T-P02 | Turno que cruza medianoche / cambio DST | unidad | instantes y segundos conservados | NO EJECUTADA |
| T-B01 | Baseline: propuestas excluidas, 120 s excluidos | unidad sobre fixture sintético | total confirmado sin propuestas ni 120 s | NO EJECUTADA |
| T-V01 | C3-17: vencido sin resolución, alcance comparable | integración (reloj controlado) | resultado = tiempo del pagador; ambos valores y diferencia visibles | NO EJECUTADA |
| T-V02 | C3-17: TimeEntry intacto tras el ajuste | integración | revisión y campos sin cambios | NO EJECUTADA |
| T-V03 | C3-17: historial completo (original, propuesta, resolución, ejecutor, evento) | integración | reconstrucción íntegra | NO EJECUTADA |
| T-V04 | C3-17: ejecutor de servicio ausente/inválido/sin grant | integración | sin ajuste; motivo registrado | NO EJECUTADA (bloqueada por G04) |
| T-V05 | C3-17: fallo de auditoría | integración | rollback; sin ajuste | NO EJECUTADA |
| T-V06 | C3-17: reintento del vencimiento | integración | un solo resultado y evento | NO EJECUTADA |
| T-V07 | C3-17: resolución humana y vencimiento simultáneos | carrera controlada | un solo ganador por CAS | NO EJECUTADA |
| T-V08 | C3-17: parte ambiguo, alcance incompatible o sin inicio de plazo acreditado | integración | no se ajusta; queda pendiente | NO EJECUTADA |
| T-V09 | C3-17: vencimiento = inicio + 86 400 s entre instantes, también al cruzar un cambio de horario (R-C317-11) | unidad (reloj controlado) | vence exactamente en ese instante; la zona sólo afecta a la presentación | NO EJECUTADA |
| T-V10 | C3-17: resolución de la pagadora (emisor declarado → `Job.clientOrgId` → ninguna) (R-C317-09) | unidad/integración | fuente registrada; sin pagadora no hay ajuste | NO EJECUTADA |
| T-V11 | C3-17: inicio en la constancia de notificación al usuario; sin constancia no hay plazo (R-C317-10 precisado por R-C317-13) | integración | instante de inicio = instante de la constancia | NO EJECUTADA |
| T-V12 | C3-17: efecto limitado a la base de facturación (R-C317-12) | integración | `TimeEntry` intacto; vista del trabajador con original, ajuste y diferencia | NO EJECUTADA |
| T-V13 | C3-17 regla 1: discrepancia sin constancia de notificación | integración | sin plazo; la diferencia sigue pendiente | NO EJECUTADA |
| T-V14 | C3-17 regla 2: contenido y registro de la constancia (Job, periodo, alcance, horas, diferencia, destinatario, instante, canal, resultado, vencimiento) | integración | registro completo e inmutable; vence sin lectura | NO EJECUTADA |
| T-V15 | C3-17 regla 3: decisión autorizada vs. sin autoridad, parte ambiguo, alcance distinto, notificación inválida | integración autenticada | sólo la decisión autorizada detiene el plazo; en los demás casos no hay ajuste | NO EJECUTADA (bloqueada por Plan 4) |
| T-V16 | C3-17 regla 4: cambio material (horas o alcance) vs. no material del parte | integración | material → nueva versión, nueva constancia y nuevo plazo; no material → plazo intacto | NO EJECUTADA |
| T-V17 | C3-17 regla 5: ajuste hacia arriba y hacia abajo | integración | base = parte vigente en ambos casos; `TimeEntry` intacto; sin factura ni pago | NO EJECUTADA |
| T-V18 | C3-17 regla 6: reapertura por persona autorizada, por supervisor con delegación y por supervisor sin ella | integración autenticada | nueva etapa e historial íntegro; sin delegación → denegado | NO EJECUTADA (bloqueada por C3-09/Plan 4) |
| T-V19 | C3-17 precisión A: parte agregado sin desglose | integración | sin atribución, sin reparto, sin plazo; diferencia pendiente | NO EJECUTADA |
| T-V20 | C3-17 precisión A: desglose comparable con varios trabajadores | integración | una constancia y un vencimiento por trabajador; resultados independientes | NO EJECUTADA |
| T-V21 | C3-17 precisión B: disputa o devolución antes del vencimiento | integración | el vencimiento no cambia; al vencer se aplica la regla | NO EJECUTADA |
| T-V22 | C3-17 precisión B: parte ambiguo o alcance no comparable al vencer | integración | sin ajuste; pendiente; `TimeEntry` intacto | NO EJECUTADA |
| T-V01 | Validadores documentales | documental | 0 errores/avisos | **EJECUTADA** (ver reporte del corte) |

## 10.19 Trazabilidad decisión → requisito → contrato → aceptación → prueba → resultado

| Decisión (fuente) | Requisito | Contrato | Aceptación | Prueba | Resultado / evidencia |
|---|---|---|---|---|---|
| C3-05 TimeEntry no se escribe desde conciliación (owner, 16-nov) | Sólo ruta canónica | §10.11.3 | conciliación no tiene writer | T-C04 | Diseño; inventario §10.11 completo para el SHA |
| C3-02/C3-07 lote org/semana; agregados sin reparto | lector canónico org | §10.9, §10.6 | cobertura completa/parcial/bloqueada | T-R01…R08 | Bloqueado: sin lector (§10.10) |
| C3-13 original y propuesta separados | nunca sumar | §9.11 D, §10.16 | propuestas fuera del confirmado | T-B01 | Verificado sobre respaldo (agregados) |
| BO-08 CAS + `STALE` (Plan 3 §10.2) | revisión monotónica | §10.11.3 | carrera determinista | T-C01…C05 | Bloqueado: sin revisión en esquema |
| Identidad separada (Plan 3/4) | principal de servicio | §10.12 | `system` rechazado | T-W01…W03 | Bloqueado: no existe tipo de principal |
| Auditoría 3 clases (Plan 4 B4-11/B4-12) | A/B/C correlacionables | §10.13 | DENY nunca expone | T-A01…A05 | Requiere decisión; `orgId` no persistido |
| D6-01/04/09 (Plan 6) | custodia y acceso | §10.15 | sólo declaración textual en slice 1 | — | Bloqueado en Plan 6 |
| Retención de declaraciones (Plan 6 v27 → Plan 3/5) | política de retención/borrado | §10.15 | no persistir sin política | — | Requiere decisión |
| Perfil horario (C3-10/C3-12) | entradas versionadas | §10.14 | pendiente sin perfil | T-P01/P02 | Bloqueado: sin TZ/asignación |
| **C3-17 aprobada por el dueño 2026-11-21** (ajuste por vencimiento al tiempo del pagador) | R-C317-01…08 | §10.17 | ver §10.17.5 | T-V01…T-V09 | Decisión de producto **aprobada**; detalles P-C317-01…09 **requieren decisión**; implementación bloqueada por G04/G07/G10/G12; pruebas NO EJECUTADAS |
| Responsable del piloto: Yoni Castellanos (declarado por usuario 18-nov) | verificar designación y autoridad | §8 / Plan 4 | ninguna decisión sin autoridad verificada | T-R02 | Requiere evidencia; no se atribuyen permisos |

## Estado de salida de v0.13

`DRAFT`. C3-17 queda aprobada como decisión de producto; eso no cambia el estado de la SDD ni cierra gates técnicos. No hay implementación, migración, prueba funcional ni CI de esta revisión. Validadores documentales ejecutados localmente (ver `docs/reportes/2026-11-21_plan3-conciliacion-gates.md`). B4-11/B4-12 abiertos. **PLAN 3 AÚN ABIERTO.**
