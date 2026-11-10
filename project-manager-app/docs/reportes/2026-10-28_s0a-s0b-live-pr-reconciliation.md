# SEMSE — Reconciliación real S0a/S0b con PR #1054 y #1053
**Corte:** 2026-10-28. **Ámbito:** supervisores de cuadrilla (BO-07), asignaciones BO-10 y auditoría compartida.  
**PR documental padre:** [#1027](https://github.com/Semse-projet/project-manager-app/pull/1027), estado DRAFT; **decisión del propietario:** mantener CI manual para último gate previo a merge, sin desactivar checks automáticos.  
**Método:** lectura de estado y diffs GitHub, cotejo con `main` y contratos; **ningún test nuevo ejecutado** ni entorno/producción tocados.

## 1. Mapa de cambios existentes (no repetir)

| Pieza | PR / base | Observación | Estado de evidencia |
|---|---|---|---|
| Contrato de autoridad y S0a/S0b | [#1027](https://github.com/Semse-projet/project-manager-app/pull/1027) -> `main` | Decisión OPEN-SUP-01 aprobada; SDD global DRAFT; N01–N18 y AUD-01…08 documentados | Documentos; **NO aprobación global**, no runtime |
| Guardas supervisor / worker | [#1054](https://github.com/Semse-projet/project-manager-app/pull/1054) -> rama #1027 | Cambia `CrewsService` y `TaskAllocationsService`; pruebas N01–N07 añadidas | **Código en PR DRAFT, tests ejecutables NO EJECUTADOS** |
| Auditoría dentro de tx (BO-12) | [#1053](https://github.com/Semse-projet/project-manager-app/pull/1053) -> `main` | Añade `AuditService.prepareActorContext`, `appendInTransaction(entry, tx)`; transacciones en `SkillsService` | PR reporta PostgreSQL integration PASS en run 40267162097, **solo para BO-12**, no prueba BO-10 |
| BO-07 y BO-10 legacy | #985 y #1001, fusionados; archivos `main` consultados 2026-10-28 | Flujos existentes y flags; specs de BO-07 y BO-10 aún `DRAFT` | No afirmar flag/Railway real, no confundir merge con activación |

**Atención a la topología:** #1054 está **apilado sobre la rama de #1027**, no directamente sobre `main`. #1053 es independiente. Una aprobación/merge de #1027 no demuestra automáticamente aprobación técnica del #1054, ni habilita S0b. Al integrar, revisar los SHAs bases reales y rebase/diff aislado; ningún merge automático.

## 2. Qué se implementó ya en #1054 (lectura de diff, no ejecución)

- `CrewsService.hasActiveWorkerMembership(tenantId,orgId,userId)`: exige una Membership WORKER ACTIVE en lecturas de `listMine` y roster.
- `TaskAllocationsService.requireCrewScope`: separa **supervisor WORKER ACTIVE** del **gestor con `org:crews:manage`** sobre membresías vigentes; esto evita retirar gestión existente a PRO/CLIENT.
- `isActiveWorkerInCrew`: confirma Crew ACTIVE de mismo tenant/org + CrewMember ACTIVE + WORKER ACTIVE.
- `assign` revisa elegibilidad de todos los destinatarios antes de entrar al bucle de escrituras.
- `listMine` oculta asignaciones de trabajadores ya sin membresía/crew válidas; `updateStatus` rechaza tras revocación/archivo.
- Tests incorporados al diff: N01 (WORKER suspendido + PRO activo en roster); N02 (VIEWER activo sin WORKER y sin permiso manager); N03 (destinatario suspendido); N04–N07 (perder WORKER, CrewMember removido o Crew archivada).

**Limitaciones todavía visibles:**
1. La rama #1054 ya tiene **N08/N09 escritos** en `task-allocations.test.ts` (commit `d5b2520` del 2026-10-28), pero **no se han ejecutado**, por lo que no hay PASS confirmado. Antes de ese commit no documentaba pruebas dirigidas PASS. El autor reportó `--check` y `git diff --check` PASS, pero `pnpm install --frozen-lockfile --offline` no completó por metadata de `@algolia/abtesting` no disponible. Ese fallo no prueba un defecto del código.
2. **N08** comprueba PRO ACTIVE + WORKER SUSPENDED como gestor legítimo; **N09** comprueba misma tenant/org ajena y tenant ajeno sin confiar en claims. Ambos tests fueron agregados al PR #1054 el 2026-10-28; faltan ejecución local, integración y revisión. N08 **no autoriza** a designar supervisores sin verificación empresarial.
3. El helper `isActiveWorkerInCrew` hace varias lecturas por persona y por asignación (N+1). En casos con una cuadrilla grande, diseñar consulta/batch scope para evitar latencia y cargar PostgreSQL; medir antes de optimizar.
4. Las validaciones S0a ocurren antes de las mutaciones sin bloqueo/protocolo de revocación compartido: **no cierran carreras TOCTOU** por sí solas. La reparación de concurrencia necesita S0b.
5. `main` todavía muestra los guards legacy sin la corrección de #1054. **No marcar S0a COMPLETADO ni en producción**.

## 3. La infraestructura de #1053 se puede reutilizar, pero NO a ciegas

En #1053, `AuditService.appendInTransaction(entry, tx)` escribe `tx.auditLog.create` usando la función `auditData`, y las pruebas BO-12 reportan rollback real al fallar el trigger de AuditLog.

El mismo diff conserva `prepareActorContext(entry)` que llama `ActorContextService.ensureActorContext` ANTES del `$transaction`. Ese servicio puede `upsert` `Tenant`, `Org` y `User`. Esto es útil en paths existentes de bootstrap/fixtures pero **no debe normalizarse como fuente de identidad en S0b**.

**Adaptación propuesta (D-S0B aún no ratificada):**
- **REUTILIZAR** el contrato `appendInTransaction(entry, tx)` después de que #1053 esté integrado en una base apropiada y haya pasado sus gates; si no, preparar un adaptador equivalente bajo revisión, evitando copiar lógica AuditLog.
- **NO llamar** `prepareActorContext` ni `ensureActorContext` desde `assign/release/updateStatus` para inventar tenant, org o user; comprobar únicamente registros reales en DB y fail-closed.
- Usar `tx` único para `TaskAllocation` + AuditLog + outbox autorizado si BO-10 lo requiere. **No afirmar que #1053 ya hace atómico BO-10**.
- Verificar FK actor existente antes del tx; no alterar `ActorContextService` globalmente sin regresión en workers.
- Resolver carreras `P2002/P2034` y revocación a través de pruebas SQL, no mediante mocks ni reintentos automáticos sin límite.

## 4. Contrato BO-07 / BO-10: qué parte se debe reconciliar

| Contrato | Estado de spec observado | Delimitación correcta |
|---|---|---|
| BO-07 `core.crews-worksites` | DRAFT / code IN_PROGRESS | Supervisor operativo exige WORKER ACTIVE; lectura roster/mine limitada a crew; manager `org:crews:manage` sigue facultad **de gestión**, no prueba de ser dueño |
| BO-10 `core.task-allocations` | DRAFT / code IN_PROGRESS | Asignación exige crew y WORKER activos, tenant/org; `JobTask` única y `TaskAllocation` única task+user; liberar y transferir no equivalen; auditoría/verificación de status del trabajador en cada request |
| Delegación `core.crew-supervisor-delegations` | DRAFT / code NOT_STARTED | Solo propietario o representante **verificado** puede designar/revocar (OPEN-SUP-01 aprobada); diseño de fuente y OPEN-SUP-02…06 pendiente; no otorgar `org:supervisors:delegate` por PRO/CLIENT/OPS_ADMIN |
| BO-12 `core.skills` | Contrato separado y PR #1053 DRAFT | Su auditoría transaccional sirve de posible infraestructura compartida; sus PASS no certifican S0a/S0b |

**Fricción con BO-10 a resolver formalmente antes de S0b:** `assign` usa `taskId+userId` para encontrar la fila sin validar `crewId`; cuando `JobTask.entityType==='Crew'`, no compara `entityId` contra la crew invocante. Se requiere ratificar conflicto neutral cross-crew, transferencia explícita, atomicidad todo-o-nada y preservación de historial, no inferir cambio de diseño del registro original.

## 3A. Seguridad de lecturas en contexto multi-tenant (2026-10-28)

Durante la implementación de #1054 se detectó que `MyCrewsController`
pasaba solo `userId` a `CrewsService.listMine` y
`rosterForSupervisor`. Las consultas de crews se hacían por
`supervisorUserId`/membresías de la persona **sin imponer tenant
del request**: una cuenta con WORKER activo en dos tenants podía
consultar información de ambas compañías desde una sola sesión.

**Parche incorporado a #1054:**
- El controlador envía `tenantId: actor.tenantId` y `userId`
  en ambas rutas, sin aceptar tenant arbitrario en parámetros cliente.
- El servicio exige `tenantId` en ambas firmas y lo aplica a
  las consultas de crews por supervisor/miembro y por roster.
- Caso `S0A-TENANT-01` simula al mismo usuario como supervisor
  legítimo en tenants t1 y t2, exige solo crews del tenant de la
  sesión y 404 para roster del otro tenant.
- Regresiones adicionales `N03b` (preflight de lote mixto
  con WORKER suspendido y PRO activo) y `N04b` (PRO activo no
  conserva avance de asignaciones tras revocación de WORKER).

**Evidencia:** los archivos y referencias de código se contrastaron
estáticamente en la rama de #1054; el commit que incorpora el último
caso es `70621f3c93dfd1f9edd304981bac19de1e9bf25e`.
Tests ejecutables, integración PostgreSQL, build y CI **no ejecutados**
por esta actualización. La numeración S0b N10–N18 permanece reservada.

## 4A. Bloqueador de autoridad empresarial (DEC-SUP-01)

En `main` y en #1054, `CrewsService.createCrew()` invoca
`requireManage(actor, orgId)`, que autoriza una Membership ACTIVE con
`org:crews:manage`, y acepta `supervisorUserId` de un WORKER ACTIVE.
**No comprueba propiedad ni representación empresarial verificada.**
Por tanto, un gestor PRO con ese permiso puede nombrar al supervisor
inicial al crear una crew, aunque no se haya acreditado como propietario
ni representante. Esto es **comportamiento legacy existente**,
separado de los guards S0a y en conflicto con la regla funcional
OPEN-SUP-01 ya ratificada.

**Bloqueador funcional P0 para nuevas designaciones empresariales:**
definir/ratificar la fuente canónica de OWNER o representante verificado;
requerirla en create/reemplazo/revocación del supervisor; cubrir creación
de crew por un gestor con permiso pero sin authority grant, con
404/403 neutro sin efectos, y propietario verificado legítimo.
No retirar globalmente `org:crews:manage` a PRO/CLIENT;
separar gestionar crews existentes de **designar la persona supervisora**.
No activar nuevos grants ni migrar en automático desde
`supervisorUserId` antes de que el contrato SDD sea APPROVED
y exista prueba funcional.

Este hallazgo es **revisión estática**, no demuestra exposición
productiva, flags habilitados ni explotación real.

## 5. Secuencia de entrega efectiva (sin ejecutar CI ahora)

1. **S0a en #1054:** N08/N09 ya escritos (no ejecutados); revisar diff y fixtures, instalar dependencias en entorno permitido (el bloqueo offline no es fallo funcional), ejecutar N01–N09 y regresiones dirigidas/locales y evaluación independiente de seguridad. Mantener el PR draft hasta aprobación aplicable del SDD.
2. **Conciliar BO-07/BO-10:** insertar referencias al contrato S0a y cerrar las decisiones semánticas nuevas de S0b. OPEN-SUP-01 está aprobada, pero OPEN-SUP-02…06 y D-S0B-01…05 **no**.
3. **Revisar #1053:** decidir merge independiente de BO-12 con sus propios gates; luego reutilizar `appendInTransaction` en S0b. Si #1053 no es integrable aún, registrar dependencia y preparar adaptación acotada.
4. **S0b en PR técnico separado:** pruebas rojas N10–N18 y AUD-01…AUD-08 primero; luego atomicidad, scope de tareas, colisiones por crew, auditoría y pruebas PostgreSQL reales.
5. **Último gate CI:** cuando códigos, specs, tests locales y revisión estén listos, validar CI terminal PASS por SHA exacto **antes del merge de cada PR**; no desactivar workflows, no saltar quality gates.
6. **Después:** merge autorizado por PR, despliegue, staging autenticado, canary/rollback y evidencia de producción por separado.

## 6. Registro de gaps concretos

| ID | Dueño/PR sugerido | Estado |
|---|---|---|
| G-S0-01 — worker suspendido con PRO activo | #1054 | Código y tests N01–N09 en PR DRAFT, sin pruebas ejecutadas |
| G-S0-02 — elegibilidad destinatario | #1054 | Código preparado, sin pruebas ejecutadas |
| G-S0-03 — revocación de acceso worker | #1054 | Código preparado, sin pruebas ejecutadas |
| G-S0-04 — N08/N09 y rendimiento/TOCTOU | #1054 + S0b | N08/N09 escritos en #1054; ejecutar, revisar y tratar TOCTOU en S0b |
| G-S0B-05 — cross-crew `TaskAllocation` | PR S0b futuro | No implementado |
| G-S0B-06 — origin `JobTask.Crew` | PR S0b futuro | No implementado |
| G-S0B-07 — atomicidad transaccional/rollback real | #1053 aporta infraestructura, PR S0b futuro | BO-12 con evidencia; BO-10 no |
| G-S0B-08 — `ensureActorContext` puede auto-crear | PR S0b futuro | Prohibir en mutación sensible; tests pendientes |
| G-S1-09 — propietario verificado y grants | Diseño #1027, futuro PR | OPEN-SUP-01 parcial aprobada; mecanismo pendiente |

**Ninguna de estas filas pasa a CLOSED por el solo hecho de existir el documento o un PR abierto.**

## 7. Evidencias y fuentes GitHub consultadas

- [#1027](https://github.com/Semse-projet/project-manager-app/pull/1027) — cabecera DRAFT y última diff de SDD.
- [#1054](https://github.com/Semse-projet/project-manager-app/pull/1054) — cambios de `crews.service.ts`, `task-allocations.service.ts` y sus suites.
- [#1053](https://github.com/Semse-projet/project-manager-app/pull/1053) — `AuditService.appendInTransaction`, `SkillsService` y prueba de integración PostgreSQL del dominio Skills, run https://github.com/Semse-projet/project-manager-app/actions/runs/40267162097 (run mencionado en PR; no re-ejecutado aquí).
- `main` consultado el 2026-10-28: BO-07/BO-10 specs aún DRAFT, guardas legacy presentes.
- [Contrato S0a](2026-10-25_s0a-supervisor-negative-test-contract.md), [S0b](2026-10-26_s0b-allocation-atomicity-cross-crew-contract.md), [audit S0b](2026-10-26_s0b-audit-transaction-boundary-review.md).
