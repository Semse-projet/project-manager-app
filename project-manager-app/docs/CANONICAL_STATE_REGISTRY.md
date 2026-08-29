# CANONICAL STATE REGISTRY — Registro Canónico de Estado del Sistema

- **Version:** 1.0
- **Corte:** 2026-08-28
- **Spec:** [`specs/platform/canonical-state-registry.spec.md`](specs/platform/canonical-state-registry.spec.md)
- **Relación con `SOURCE_OF_TRUTH.md`:** este registro es el instrumento
  operativo de los "ejes oficiales de verdad" ya declarados allí, llevado al
  nivel de una capacidad individual. `SOURCE_OF_TRUTH.md` dice qué capa gana
  en general; este documento dice, para una capacidad concreta, qué se sabe
  hoy, con qué evidencia, y qué queda pendiente de decidir.
- **Relación con `SPEC_INDEX.md`:** `SPEC_INDEX.md` rastrea el estado de un
  **spec** (contrato autorizado y su pipeline de entrega). Este registro
  rastrea el estado de una **capacidad** tal como se comporta hoy, que puede
  no coincidir con lo que su spec declara — esa brecha es precisamente lo que
  el registro existe para hacer visible.

## Por qué existe

Un spec puede decir `IMPLEMENTED`. Un reporte de sesión puede decir
"completado". Un checkpoint puede decir "listo para retomar". Ninguna de esas
tres afirmaciones, por sí sola, dice si la capacidad realmente funciona hoy,
en qué entorno, contra qué commit, ni qué le falta. Cuando esos rastros
divergen — spec dice una cosa, código otra, producción otra — un agente que
solo lee documentación hereda la lectura equivocada del presente aunque su
comprensión del futuro (la arquitectura, la visión) siga siendo correcta.

Este documento no reemplaza los specs, la constitución ni `SOURCE_OF_TRUTH.md`.
Es una capa adicional: un lugar donde **una capacidad no puede declararse
verificada sin nombrar la evidencia exacta que lo prueba**, y donde esa
declaración caduca si nadie la revisó recientemente.

## Jerarquía de verdad (de mayor a menor autoridad)

Cuando dos fuentes se contradicen sobre el estado de una capacidad, gana la de
mayor número en esta lista solo si es la de **menor posición** (más arriba):

1. **Comportamiento verificado en producción** — observado directamente
   (logs, métricas, smoke autenticado), no inferido de un deploy exitoso.
2. **Tests reproducibles contra un commit identificado** — ejecutados, no
   asumidos por la presencia del archivo de test.
3. **Código del branch canónico** (`main`) — lo que realmente se ejecutaría.
4. **Este registro canónico de capacidades** — última síntesis firmada de 1-3.
5. **Specs vigentes** (`APPROVED`/`IMPLEMENTED`/`VERIFIED` en `SPEC_INDEX.md`).
6. **Decisiones aceptadas** (ADRs, constitución, `VISION_DECISIONS_LOCKED`).
7. **Reportes históricos** (`docs/reportes/`).
8. **Handoffs y checkpoints** de sesiones de agentes.
9. **Inferencias derivadas de nombres de rama, worktree o carpeta.**

Reglas derivadas:

- Un reporte histórico (nivel 7) nunca puede, por sí solo, declarar una
  capacidad terminada si contradice el código en `main` (nivel 3) o un test
  reproducible (nivel 2).
- Un nombre de rama o worktree (nivel 9) no es evidencia de nada — es, como
  mucho, una pista de dónde buscar evidencia real.
- Si el nivel más alto disponible para una capacidad es 7, 8 o 9, el campo
  **Estado real** de esa fila no puede ser `verificada`: como mucho `parcial`
  o `no iniciada`, con la fuente débil anotada en **Documentos obsoletos** o
  **Próxima decisión**.

## Esquema de una fila

| Campo | Función |
|---|---|
| Capacidad | Qué promete hacer el sistema, en lenguaje de negocio |
| Propietario | Módulo/dominio responsable (de los nueve bounded contexts) |
| Estado real | `no_iniciada` \| `simulada` \| `parcial` \| `operativa` \| `verificada` |
| Evidencia | Código, prueba, despliegue o comportamiento que lo demuestra (ruta o comando exacto) |
| Entorno | `local` \| `staging` \| `produccion` |
| Commit verificado | SHA corto de la versión exacta comprobada |
| Limitaciones | Qué sigue incompleto, explícitamente |
| Riesgos | `seguridad` \| `pagos` \| `identidad` \| `permisos` \| `datos` \| `ninguno` |
| Última verificación | Fecha (`YYYY-MM-DD`) + quién/qué la hizo |
| Documentos obsoletos | Fuentes que ya no deben usarse para esta capacidad |
| Próxima decisión | Acción técnica o decisión humana pendiente |

Definición de **Estado real** (evita el "estado imaginado"):

- `no_iniciada` — no existe código para esta capacidad.
- `simulada` — existe código, pero opera en modo dry-run, mock, stub o detrás
  de un flag siempre apagado; no toca datos ni sistemas reales.
- `parcial` — el camino feliz funciona en al menos un entorno, pero faltan
  casos borde, permisos, idempotencia o cobertura de tests declarados por su
  spec.
- `operativa` — pasa sus tests declarados y corre en el entorno indicado, pero
  nadie confirmó comportamiento en producción con evidencia reciente.
- `verificada` — tiene evidencia de nivel 1 o 2 de la jerarquía de verdad,
  con fecha de verificación y SHA registrados.

## Cómo se mantiene este registro

1. **No se fabrica evidencia.** Si nadie audita todavía una capacidad, su fila
   dice `no_iniciada`/`parcial` con **Próxima decisión: auditar** — nunca se
   asume `verificada` por default ni se copia el estado de `SPEC_INDEX.md`
   sin confirmarlo contra código o producción.
2. **Toda fila cita su fuente exacta** en **Evidencia** (ruta de archivo,
   comando de test, endpoint de healthcheck) — no "está implementado" a
   secas.
3. **Caducidad explícita.** Una fila sin **Última verificación** en los
   últimos 60 días se trata como no confiable para decisiones nuevas hasta
   revalidar, aunque el campo **Estado real** no haya cambiado.
4. **Actualización disparada por evento**, no por calendario: un merge, un
   deploy, un incidente o un hallazgo de auditoría que cambie el estado real
   de una capacidad debe actualizar su fila en el mismo PR/reporte que lo
   descubre.
5. **Validación automática mínima** (`tests/unit/canonical-state-registry.test.ts`):
   confirma que este archivo mantiene las columnas del esquema y que cada
   ruta citada en **Evidencia** para filas `operativa`/`verificada` existe
   realmente en el repositorio. No valida contenido semántico — eso requiere
   revisión humana o de agente al momento de escribir la fila.

## Registro de capacidades

> Fase 1 (entrega inicial): el registro arranca con un número pequeño de
> filas verificables contra código y specs existentes, más una fila que
> documenta el propio registro. Fase 2 (primer avance, mismo PR): se abrió
> `field-ops`/Labor Engine con lectura directa de código (`git grep`,
> lectura de controllers/repositories/páginas web), separando lo que
> `project-manager-app/CLAUDE.md` describía como un solo hecho ("time-tracker
> legacy, sólo el listado de jobs") en tres capacidades reales con evidencia
> propia — incluyendo un riesgo de datos (tabla `timeEntry` compartida) que
> ese documento no mencionaba. Las demás capacidades del sistema (el resto
> de los nueve dominios) quedan pendientes de auditoría — ver
> `docs/specs/platform/canonical-state-registry.tasks.md` Fase 2. No se
> rellenan filas especulativas para "completar la tabla".

| Capacidad | Propietario | Estado real | Evidencia | Entorno | Commit verificado | Limitaciones | Riesgos | Última verificación | Documentos obsoletos | Próxima decisión |
|---|---|---|---|---|---|---|---|---|---|---|
| Registro canónico de estado (este documento) | platform | operativa | `docs/CANONICAL_STATE_REGISTRY.md` + `tests/unit/canonical-state-registry.test.ts` (verde en `pnpm test:unit`) | local | ver `git log -1 -- docs/CANONICAL_STATE_REGISTRY.md` | Sin automatización en CI todavía; sin integración con `pnpm spec:index`; sólo 3 filas sembradas | ninguno | 2026-08-28 — sesión de creación | — | Ejecutar auditoría Fase 2 por dominio y decidir si `pnpm verify:workspace` debe correr esta validación |
| Labor Engine — time tracking (`/worker/tracker`) | labor | operativa | `apps/web/app/(app)/worker/tracker/page.tsx` importa `startLaborTimer`/`pauseLaborTimer`/`resumeLaborTimer`/`stopLaborTimer`/`updateLaborTimerNotes`/`fetchLaborEntries` desde `apps/web/app/(app)/labor-api.ts` → `/api/semse/labor/timer/*` → `apps/api/src/modules/labor-engine/labor-engine.controller.ts` (`v1/labor`) → `labor-engine.repository.ts` (Prisma `timeEntry`) | produccion | no verificado en esta sesión (código de `main` leído directamente, sin smoke autenticado) | No se corrió ningún test end-to-end de este flujo en esta sesión; sólo lectura de código | ninguno detectado en esta pasada | 2026-08-28 — lectura directa de código en esta sesión (nivel 3 de la jerarquía de verdad) | — | Confirmar con un smoke autenticado en producción para subir a `verificada` |
| Field Ops legacy — endpoints de escritura de tracker (`v1/time-tracker/sessions/*`) | labor | parcial | `apps/api/src/modules/field-ops/time-tracker.controller.ts` expone `sessions/start`, `sessions/manual`, `sessions/:id/pause`\|`resume`\|`stop`, `sessions/:id/notes`, todos registrados y activos en `FieldOpsModule` (wireado en `apps/api/src/app.module.ts:27,123`); grep de todo `apps/web/app` confirma que ningún componente de UI actualmente enlazado los invoca — sólo `fetchTimeTrackerJobs` (listado, solo lectura) se usa, desde `apps/web/app/(app)/worker/tracker/page.tsx:405`, con `.catch(() => [])` best-effort | produccion (endpoints vivos, sin tráfico de UI conocido) | no auditado más allá de este commit | No se verificó tráfico real vía logs/métricas de producción — sólo ausencia de invocación desde el código de UI actualmente enlazado; un cliente directo (mobile viejo, integración, llamada manual) podría seguir usándolos | datos (crítico: `field-ops.repository.ts:237-381` escribe/lee el mismo modelo Prisma `timeEntry` que usa `labor-engine.repository.ts`, con reglas de negocio distintas — overnight-shift, idempotencia y proximity check-in del Labor Engine no se aplican en este camino; una llamada directa a estos endpoints puede crear filas `timeEntry` divergentes del ledger que el Labor Engine trata como fuente de verdad) | 2026-08-28 — verificado contra código en esta sesión (nivel 3) | `project-manager-app/CLAUDE.md` ("field-ops/time-tracker remains only as legacy API — jobs list still consumed") es correcto para el listado pero no menciona que los endpoints de escritura siguen activos y comparten tabla con Labor Engine | Decidir si estos 6 endpoints de escritura se deshabilitan (RBAC/feature flag) o se eliminan; hasta entonces documentar el riesgo de `timeEntry` compartido en el runbook de Labor Engine |
| Field Ops — units/worklogs/facts/vendors/compliance (`/worker/field-ops`) | labor | operativa | `apps/web/app/(app)/worker/field-ops/page.tsx` llama directamente `/api/semse/field-ops/units`, `/worklogs`, `/facts`, `/vendors`, `/vendors/:id/compliance` (líneas 160-724) → `apps/api/src/modules/field-ops/field-ops.controller.ts` → `field-ops.service.ts`. Es una capacidad distinta del tracker: no forma parte del alcance del Labor Engine y no está siendo reemplazada | produccion | no verificado en esta sesión (código de `main` leído directamente, sin smoke autenticado) | Sin cobertura de test verificada en esta sesión; el antiguo Tracker tab de esta misma página fue removido explícitamente (comentario en el propio archivo, línea ~863: "REMOVED (deprecated 2026-07-27, AUDIT_REMEDIATION_PLAN.md 2.1)") porque duplicaba `/worker/tracker` | ninguno detectado en esta pasada | 2026-08-28 — lectura directa de código en esta sesión (nivel 3) | La nota de `project-manager-app/CLAUDE.md` ("`field-ops/` — being replaced; new work goes to the Labor Engine") describe el sub-feature de tracker, no éste; leída sin matizar podría hacer pensar que toda la superficie de field-ops está en camino de desaparecer, y no es así | Confirmar con un smoke autenticado en producción para subir a `verificada`; aclarar el alcance de la nota de `CLAUDE.md` si se reescribe |
| `operations.project-lifecycle-projection` | operations | operativa (según spec, no re-verificado aquí) | `docs/specs/operations/project-lifecycle-projection.spec.md` — spec en `VERIFIED`, `deploy_status: DEPLOYED`, `activation_status: CANARY`, `last_verified: 2026-07-31` | produccion (canary) | ver `production_evidence` del spec citado | Activación es `CANARY`, no `ACTIVE` — no promovida a todos los tenants; este registro no re-confirmó el canary de forma independiente en esta sesión | datos, permisos (proyección cross-módulo) | 2026-07-31 — heredada del spec, sin re-verificación independiente en esta sesión | — | Antes de citar esta fila como "verificada" de forma independiente, correr un smoke autenticado nuevo y registrar SHA propio |

## Qué no es este documento

- No es una auditoría completa de SEMSEproject — es la infraestructura para
  hacerla sostenible. Poblarlo dominio por dominio es trabajo de seguimiento
  explícito (Fase 2), no de esta entrega.
- No autoriza ni deniega despliegues por sí mismo — eso lo sigue gobernando
  el flujo SDD y los gates de cada spec.
- No sustituye `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`; ese
  documento describe planeado-vs-implementado a nivel de arquitectura. Este
  registro es más granular y exige evidencia citada fila por fila.
