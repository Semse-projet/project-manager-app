# Plan 7 — Auditoría con las skills de SEMSE (paridad spec ↔ código)

**Fecha:** 25 de noviembre de 2026 (America/Chicago)
**Complementa:** `P7_Auditoria_Expediente_Drive_2026-11-25.md` (Drive `1pBtAgoZ4kCuqGbtDMt9rU7bh7CuTrgi1`). No lo sustituye.
**SHA evaluado:** `bc127c909fd195e469297d66366d267260a1ee44` (`origin/main`, 25-11-2026).
**Tipo:** READ_ONLY + PROPOSE. No se modificó código, permisos, datos ni producción, y no se cambió ningún archivo existente de Drive.

## 1. Skills usadas y por qué

Enrutador consultivo (`pnpm skill:route`, ruta `route-c9f48c6f…`, confianza 0,43): **principal** `semse-parity-audit`; **apoyo** `testing-worker-tracker` y `semse-labor-engine-boundary`. El enrutador no concede autorización; `semseproject` y `semse-audit-remediation` siguen teniendo precedencia.

| Skill | Qué aporta a esta auditoría |
|---|---|
| `semse-parity-audit` | Matriz de lo especificado en Plan 7 frente al código en un SHA. Una fila sólo cuenta como `yes` si tiene `ruta:línea` **y** un test; un flag apagado cuenta como `partial`. Puntuación con `parity.py` y clasificación en existe / falta / mejorar. |
| `testing-worker-tracker` | Distingue las dos formas de cálculo del Tracker (KPI frente a agregados) y la cola local pendiente, que afectan a la regla «mismos datos, sin recálculo» del dashboard. |
| `semse-labor-engine-boundary` | Comprueba que Plan 7 no dependa, sin saberlo, de la superficie heredada `field-ops`/`time-tracker`, y separa el Tracker web de la app móvil nativa. |

## 2. Paridad Plan 7 (spec) ↔ código — `semse-parity-audit`

Convención de la skill: `original` = requisito de Plan 7 y `clone` = SEMSE. **Diseño ≠ código ≠ tests ≠ CI ≠ despliegue ≠ activación.** Plan 7 está en diseño, así que una puntuación baja es lo esperado: mide cuánto del diseño ya existe en el código, no la calidad del plan.

#### Parity: 27.3 / 100

features 27.3  (25 counted, must-haves 1 of 15 done)

Not shippable yet: 14 must-have features are not done.

#### By area, weakest first
- cierre                         0.0  (3 features)
- conciliacion                   0.0  (1 features)
- time-entry                    16.7  (3 features)
- dashboard                     22.2  (7 features)
- navegacion                    27.3  (4 features)
- registros                     50.0  (1 features)
- proyectos                     50.0  (1 features)
- reportes                      50.0  (1 features)
- asistente                     50.0  (1 features)
- i18n                          50.0  (1 features)
- timer                         80.0  (2 features)

#### Missing, in build order
- [must] cierre: Cierre de jornada como acceso principal, no  (No existe)
- [must] cierre: Cierre de jornada · vistas Día / Días anteriores / detalle, no  (No existe; propuesta §80; contrato de integración no aprobado)
- [must] conciliacion: Conciliación semanal (Time Entry › Conciliación), no  (SDD labor.weekly-reconciliation v0.20 DRAFT; sin código)
- [must] dashboard: Dashboard · Estado operativo (incompletos/revisión/avisos de conciliación), no  (No existe; correcciones PENDING propias sí existen fuera del Tracker (/worker/corrections); conciliación sin contrato)
- [must] dashboard: Dashboard · Jornada actual (estado del reloj, proyecto, tiempo y controles en la portada), no  (El estado y los controles existen sólo en el panel Timer (page.tsx:1249); ResumenTab no los muestra)
- [must] navegacion: Resumen es la página inicial del módulo, no  (page.tsx:334 inicia en "timer")
- [must] time-entry: Time Entry como acceso principal, no  (No existe en TRACKER_TABS ni como ruta)
- [must] time-entry: Time Entry · 10 subsecciones internas, no  (Ninguna existe en el Tracker; Resumen operativo, Conciliación y Evidencias bloqueadas por SDD y Planes 3/4/6)
- [must] dashboard: Dashboard · Resumen general (hoy/semana/mes/proyectos/facturable/personal/costo/tendencia), partial  (sections/ResumenTab.tsx:176-195 (KpiCard Horas hoy/Esta semana/Este mes/Proyectos libres/Facturable/Personal/Costo; Tendencia del mes); sin test; enlaces a detalle inexistentes)
- [must] dashboard: Dashboard · indicadores con la misma fuente que su detalle (sin recálculo), partial  (ResumenTab.tsx:88-129: KPI = resumen + pendingSummaryEntries; agregados = entries + pendingLocalEntries (skill testing-worker-tracker); el destino de cada indicador no está decidido (A-01))
- [must] navegacion: Carrusel principal con 8 accesos en orden N7-08, partial  (page.tsx:307-316 (TrackerTab y TRACKER_TABS) tiene 6 (timer…asistente); faltan Time Entry y Cierre de jornada; sin test de las pestañas)
- [must] navegacion: Navegación móvil: los accesos alcanzables sin «Más» y con anterior/siguiente, partial  (page.tsx:1170-1177 fila flex con wrap; no hay «Más»; no hay botones anterior/siguiente (§5.2); sin test)
- [must] registros: Registros: lista de entradas y alta manual, partial  (page.tsx:1244 RegistrosTab (fetchLaborEntries, createManualEntry con cola offline); sin test de UI; tests/unit/tracker-csv-safety.test.mjs cubre sólo exportación CSV)
- [must] time-entry: Time Entry · corrección trazable de una entrada (BO-08), partial  (Existe fuera del Tracker: /worker/corrections, /client/labor-policy; API labor-policy.controller.ts:35-125; test apps/api/test/labor-policy.test.ts; no integrada en Time Entry)
- [should] cierre: Cierre de jornada · estados del día y «Jornada cerrada» registrada, no  (No existe modelo ni endpoint (schema.prisma sin cierre diario))
- [should] dashboard: Dashboard · Accesos a las ocho secciones, no  (No existe en ResumenTab)
- [should] dashboard: Dashboard · Acciones rápidas, no  (No existe en ResumenTab)
- [should] navegacion: Cada acceso tiene ruta o URL estable (D7-06), no  (page.tsx:334 useState<TrackerTab>; la pestaña no vive en la URL)
- [should] dashboard: Dashboard · Actividad reciente: último registro con acceso a su detalle, partial  (ResumenTab.tsx:214 «Últimos registros» (lista); sin enlace a detalle; sin test)
- [should] i18n: ES/EN en los accesos y secciones, partial  (TRACKER_TABS con etiquetas fijas en español (page.tsx:309-316); tests/unit/operational-panels-i18n.test.ts no cubre el Tracker)
- [should] proyectos: Proyectos: proyectos libres y horas por proyecto, partial  (page.tsx:1245 ProyectosTab (fetchFreeProjects, fetchLaborEntries); jobs vienen de la superficie heredada /api/semse/time-tracker/jobs (page.tsx:407); sin test)
- [should] reportes: Reportes: resumen semanal y mensual, partial  (page.tsx:1246 ReportesTab (fetchWeeklySummary, fetchMonthlySummary); sin test de UI)
- [should] timer: Timer: check-in de proximidad (modo BO-09 / perfil), partial  (page.tsx (fetchLocationPreference + resolveProximityMode, #1169); test e2e tests/e2e-semse/worker-tracker-proximity.spec.ts:16,58; BO-09 detrás de flag → partial)
- [could] asistente: Asistente, partial  (page.tsx:1247 AsistenteTab (chat de labor-api); sin test)

#### Left out on purpose (not scored)
- Sites locales de referencia como fuente de datos: Fuera de alcance: son referencia visual local, no integración (r15)


### 2.1 Matriz completa

| Requisito de Plan 7 | Área | Prioridad | SEMSE | Evidencia (ruta:línea y test, o qué falta) |
|---|---|---|---|---|
| Timer: iniciar/pausar/reanudar/detener y persistir tras recarga | timer | must | **yes** | apps/web/app/(app)/worker/tracker/page.tsx:1249 (panel Timer); BFF api/semse/labor/timer/*; API labor-engine.controller.ts timer/*; test e2e tests/e2e-semse/worker-tracker.spec.js:17 y tests/unit/tracker-local-store.test.ts:34-108 |
| Timer: check-in de proximidad (modo BO-09 / perfil) | timer | should | **partial** | page.tsx (fetchLocationPreference + resolveProximityMode, #1169); test e2e tests/e2e-semse/worker-tracker-proximity.spec.ts:16,58; BO-09 detrás de flag → partial |
| Carrusel principal con 8 accesos en orden N7-08 | navegacion | must | **partial** | page.tsx:307-316 (TrackerTab y TRACKER_TABS) tiene 6 (timer…asistente); faltan Time Entry y Cierre de jornada; sin test de las pestañas |
| Navegación móvil: los accesos alcanzables sin «Más» y con anterior/siguiente | navegacion | must | **partial** | page.tsx:1170-1177 fila flex con wrap; no hay «Más»; no hay botones anterior/siguiente (§5.2); sin test |
| Cada acceso tiene ruta o URL estable (D7-06) | navegacion | should | **no** | page.tsx:334 useState<TrackerTab>; la pestaña no vive en la URL |
| Resumen es la página inicial del módulo | navegacion | must | **no** | page.tsx:334 inicia en "timer" |
| Registros: lista de entradas y alta manual | registros | must | **partial** | page.tsx:1244 RegistrosTab (fetchLaborEntries, createManualEntry con cola offline); sin test de UI; tests/unit/tracker-csv-safety.test.mjs cubre sólo exportación CSV |
| Proyectos: proyectos libres y horas por proyecto | proyectos | should | **partial** | page.tsx:1245 ProyectosTab (fetchFreeProjects, fetchLaborEntries); jobs vienen de la superficie heredada /api/semse/time-tracker/jobs (page.tsx:407); sin test |
| Reportes: resumen semanal y mensual | reportes | should | **partial** | page.tsx:1246 ReportesTab (fetchWeeklySummary, fetchMonthlySummary); sin test de UI |
| Asistente | asistente | could | **partial** | page.tsx:1247 AsistenteTab (chat de labor-api); sin test |
| Dashboard · Jornada actual (estado del reloj, proyecto, tiempo y controles en la portada) | dashboard | must | **no** | El estado y los controles existen sólo en el panel Timer (page.tsx:1249); ResumenTab no los muestra |
| Dashboard · Acciones rápidas | dashboard | should | **no** | No existe en ResumenTab |
| Dashboard · Resumen general (hoy/semana/mes/proyectos/facturable/personal/costo/tendencia) | dashboard | must | **partial** | sections/ResumenTab.tsx:176-195 (KpiCard Horas hoy/Esta semana/Este mes/Proyectos libres/Facturable/Personal/Costo; Tendencia del mes); sin test; enlaces a detalle inexistentes |
| Dashboard · Estado operativo (incompletos/revisión/avisos de conciliación) | dashboard | must | **no** | No existe; correcciones PENDING propias sí existen fuera del Tracker (/worker/corrections); conciliación sin contrato |
| Dashboard · Actividad reciente: último registro con acceso a su detalle | dashboard | should | **partial** | ResumenTab.tsx:214 «Últimos registros» (lista); sin enlace a detalle; sin test |
| Dashboard · Accesos a las ocho secciones | dashboard | should | **no** | No existe en ResumenTab |
| Dashboard · indicadores con la misma fuente que su detalle (sin recálculo) | dashboard | must | **partial** | ResumenTab.tsx:88-129: KPI = resumen + pendingSummaryEntries; agregados = entries + pendingLocalEntries (skill testing-worker-tracker); el destino de cada indicador no está decidido (A-01) |
| Time Entry como acceso principal | time-entry | must | **no** | No existe en TRACKER_TABS ni como ruta |
| Time Entry · 10 subsecciones internas | time-entry | must | **no** | Ninguna existe en el Tracker; Resumen operativo, Conciliación y Evidencias bloqueadas por SDD y Planes 3/4/6 |
| Time Entry · corrección trazable de una entrada (BO-08) | time-entry | must | **partial** | Existe fuera del Tracker: /worker/corrections, /client/labor-policy; API labor-policy.controller.ts:35-125; test apps/api/test/labor-policy.test.ts; no integrada en Time Entry |
| Cierre de jornada como acceso principal | cierre | must | **no** | No existe |
| Cierre de jornada · vistas Día / Días anteriores / detalle | cierre | must | **no** | No existe; propuesta §80; contrato de integración no aprobado |
| Cierre de jornada · estados del día y «Jornada cerrada» registrada | cierre | should | **no** | No existe modelo ni endpoint (schema.prisma sin cierre diario) |
| Conciliación semanal (Time Entry › Conciliación) | conciliacion | must | **no** | SDD labor.weekly-reconciliation v0.20 DRAFT; sin código |
| ES/EN en los accesos y secciones | i18n | should | **partial** | TRACKER_TABS con etiquetas fijas en español (page.tsx:309-316); tests/unit/operational-panels-i18n.test.ts no cubre el Tracker |
| Sites locales de referencia como fuente de datos | referencia | could | **skip** | Fuera de alcance: son referencia visual local, no integración (r15) |

### 2.2 Veredicto

**`GAPS_BLOCKING`**: puntuación 27,3/100, con 1 de 15 must-haves cumplido (Timer, con test e2e). Es una cifra honesta del estado del código frente al diseño, no una crítica al plan.

### 2.3 Brechas clasificadas (existe / falta / mejorar)

| Clase | Elemento | Tamaño | Dominio | Skill que lo tomaría |
|---|---|---|---|---|
| **Existe** | Timer con persistencia y check-in (e2e) | — | Labor | `testing-worker-tracker` |
| **Existe** | Registros, Proyectos, Reportes, Asistente como pestañas | — | Labor | — |
| **Existe** | Resumen con KPI y gráficos (hoy, semana, mes, proyectos, facturable, personal, costo, tendencia, últimos registros) | — | Labor | — |
| **Existe** | Corrección BO-08 (fuera del Tracker), con test de API | — | Labor / Core | `semse-rbac-permissions` |
| **Falta** | Accesos 7 y 8 (Time Entry, Cierre de jornada) | M | Labor + UI | `semse-spec-kit-flow` (SDD previa) |
| **Falta** | Diez subsecciones de Time Entry | L | Labor + Plan 3 | `semse-spec-kit-flow` |
| **Falta** | Bloques del dashboard: jornada actual, acciones rápidas, estado operativo, accesos | M | UI | `semse-spec-kit-flow` |
| **Falta** | Cierre de jornada (vistas, estados, registro de cierre) | L | Labor | `semse-spec-kit-flow`, `semse-prisma-workflow` (modelo nuevo) |
| **Falta** | Conciliación semanal | L | Plan 3 | SDD `labor.weekly-reconciliation` |
| **Mejorar** | Pestaña inicial: hoy Timer, decidido Resumen | S | UI | — |
| **Mejorar** | Pestaña en la URL (D7-06) y anterior/siguiente (§5.2) | S | UI | — |
| **Mejorar** | Etiquetas ES/EN del Tracker, hoy fijas en español | S | UI / i18n | — |
| **Mejorar** | Tests de UI para Resumen, Registros, Proyectos y Reportes; hoy sólo Timer tiene e2e | M | QA | `semse-functional-test`, `testing-worker-tracker` |
| **Mejorar** | Enlace de cada indicador a su detalle (depende de A-01) | S | UI | — |

### 2.4 Criterios de aprobación de la skill

- [x] SHA evaluado anotado.
- [x] Ningún `yes` sin `ruta:línea` y test: sólo Timer, con `tests/e2e-semse/worker-tracker.spec.js:17`.
- [x] Capacidad con flag apagado marcada `partial` (BO-09).
- [x] Brechas clasificadas, con dominio responsable.
- [x] `parity.py` corre sin errores de formato sobre la matriz entregada.
- [ ] Recorrido de comportamiento en navegador (paso 4): no realizado. Requiere el stack local y cuentas de demo; ver `testing-worker-tracker`.
- [ ] Comparación de layout con `imgdiff.py`: no aplica. No hay pantalla de SEMSE con el diseño nuevo contra la que comparar.

## 3. Hallazgos de `testing-worker-tracker`

| ID | Hallazgo | Evidencia | Qué implica para Plan 7 |
|---|---|---|---|
| TW-01 | **Hay dos cálculos distintos en el Resumen actual.** «Horas hoy», «Esta semana» y «Este mes» son resumen + `pendingSummaryEntries` (KPI). «Facturable», «Personal», «Costo» y «Últimos registros» son entradas + `pendingLocalEntries` (agregado). | `ResumenTab.tsx:88-129, 176-191` | La regla «mismos datos, sin recálculo» (N7-18, N7-22) debe indicar **qué cálculo** usa cada indicador, y el detalle al que enlaza debe usar el mismo. Si no, el dashboard y Reportes o Time Entry pueden mostrar cifras distintas por diseño. |
| TW-02 | **«Personal (mes)» son horas de propósito `personal`** («cálculo propio»), no el personal ni los trabajadores. | `ResumenTab.tsx:190` | §86.1 del maestro r10/r11 lo envía a «Time Entry › Trabajadores» (personal de la organización). El addendum r11 lo trata como datos de otras personas. **Son interpretaciones distintas del mismo rótulo.** Hace falta que el propietario confirme qué significa «personal del mes» (nueva pregunta Q7-17). |
| TW-03 | **El backend sólo resume entradas `completed`.** Un timer en curso o en pausa no está en el resumen y llega por la cola local. | `labor-engine.repository.ts:386, 462, 516` (`status: "completed"`); skill `testing-worker-tracker` | «Jornada actual · tiempo acumulado» en la portada debe salir del timer activo o del estado local, no del resumen. |
| TW-04 | **Sólo el Timer tiene prueba automatizada.** `apps/web` no tiene runner de tests y el resto se verifica en navegador. | `tests/e2e-semse/worker-tracker*.spec.*`; tests unitarios de la cola local y del CSV | P7-T09 (trazabilidad SDD/CI) necesitará specs e2e nuevas para el dashboard y los accesos 7 y 8. Hoy no existen. |

## 4. Hallazgos de `semse-labor-engine-boundary`

| ID | Hallazgo | Evidencia | Qué implica para Plan 7 |
|---|---|---|---|
| LB-01 | **El Tracker todavía lee la lista de jobs de la superficie heredada.** `fetchTimeTrackerJobs` llama a `/api/semse/time-tracker/jobs` (`v1/time-tracker`); el resto usa `v1/labor`. Es la excepción que `CLAUDE.md` describe como «jobs list still consumed». | `page.tsx:407`; `semse-api.ts:489-490` | Los proyectos vinculados a jobs (indicador «Proyectos», Time Entry › Proyectos y organizaciones) dependen **en parte** de la API heredada. Plan 7 §37 dice que la UI usa el cliente de Labor Engine «para entradas, sesiones, proyectos y resúmenes», lo que es **incompleto** para los jobs. No se debe consolidar ni retirar esa ruta sin confirmar sus llamadas. |
| LB-02 | Las menciones a `field-ops` en Plan 7 son **nombres de permiso** (`field-ops:read/write`) que usa Labor Engine, no del módulo heredado. | Plan 7 §79.4 y otras | Correcto. Sin acción. |
| LB-03 | **La app móvil nativa tiene su propio Timer** (`apps/mobile/src/screens/TimerScreen.tsx`, `apps/mobile/src/timer/localTimer.ts`, con almacenamiento en AsyncStorage), distinto del `trackerLocalStore.ts` web. Plan 7 sólo trata el **Tracker web** en tamaño móvil; la app nativa aparece una vez, por un commit de EAS. | árbol `apps/mobile/src` en `bc127c9` | **Alcance sin definir:** ¿el carrusel de ocho accesos, Time Entry y Cierre de jornada aplican también a la app nativa? Nueva pregunta Q7-18. |

## 5. Preguntas nuevas para el propietario

- **Q7-17:** ¿«Personal del mes» son horas de propósito personal (como en el código) o personal o trabajadores de la organización (como en §86.1 y r11)?
- **Q7-18:** ¿Plan 7 aplica sólo al Tracker web (incluido en teléfono) o también a la app móvil nativa (`apps/mobile`)?

Se suman a A-01 (C7-01 y Q7-16 contradictorios) y al resto de abiertas de la auditoría del expediente.

## 6. Límites

- No se ejecutó el stack local ni se recorrió el Tracker en un navegador (paso 4 de `semse-parity-audit`).
- No se ejecutaron tests ni CI.
- Los tests citados se identificaron por lectura en el SHA, no por ejecución.

**PLAN 7 ABIERTO.**
