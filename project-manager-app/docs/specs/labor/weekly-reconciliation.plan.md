---
type: plan
feature: "weekly-reconciliation"
domain: "labor"
spec: "docs/specs/labor/weekly-reconciliation.spec.md"
version: "2.0"
status: "DRAFT"
branch: "claude/plan3-conciliacion-gates-32rob6"
date: "2026-11-21"
---

# Plan técnico — Conciliación semanal del Time Tracker (DRAFT preparatorio)

> **DRAFT, no ejecutar.** La plantilla exige spec `APPROVED` como prerrequisito; la spec `labor.weekly-reconciliation` sigue en `DRAFT` (v0.13). Este plan existe para que la revisión de la SDD vea el camino completo y sus bloqueos. **No autoriza** código, migraciones, permisos, grants, flags, despliegues ni pagos. Cada decisión técnica marcada «propuesta» requiere al owner indicado.

## 1. Snapshot de verdad (2026-11-21)

- `origin/main` SHA: `86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f` (revalidado con `git fetch`).
- SHA desplegado API/Web/Worker: **no verificado en esta sesión**. Plan 2 v36r2 §2.23 informa que Railway declaraba `86c0be5…` el 21-11; esta sesión no consultó producción.
- Estado de servicios y migraciones: no verificados (sin acceso a producción, por instrucción).
- Flags: no existe flag de conciliación. BO-08 depende de `SEMSE_LABOR_POLICY_ENABLED` (valor efectivo no verificado).
- Deuda previa relevante (código en `86c0be5`, ver spec §10.10–§10.17.6):
  - ninguno de los 9 writers de TimeEntry usa revisión/CAS ni `appendInTransaction`;
  - rutas admin de timer sin `orgId`;
  - `AuditLog` no persiste `orgId`;
  - no hay principal de servicio tipado;
  - no hay zona horaria en `Org`/`Worksite`/`LaborSchedulePolicy`;
  - `TimeEvidence` sin FK a `Evidence` ni `tenantId`;
  - `Notification` sin `orgId`/Job y con `sentAt` fijado al crear;
  - **`packages/fsm` no existe** pese a la decisión bloqueada de la constitución («FSM explícito en `packages/fsm`»).

## 2. Constitution check

- [ ] **Art. I** Spec aprobada antes de código — **NO**: spec `DRAFT`.
- [ ] **Art. II** Tests derivados de la spec — descritos (T-V01…T-V22, T-R/W/A/C/I/P/B), **ninguno escrito ni ejecutado**.
- [~] **Art. III** Evidence-first — la spec contempla Evidence como referencia no decisoria y deja objetos Evidence para fases posteriores (Plan 6, opción A). Requiere que el owner confirme que esto es compatible con el artículo para este flujo. **[21-11]** Criterio de producto aprobado (R-C317-22: Evidence es respaldo de la decisión humana, sin efecto automático); falta la confirmación del owner de Plan 6.
- [ ] **Art. IV** Payment Governance — la base de facturación no emite facturas ni pagos (R-C317-23), pero **no se declara exenta**: el owner de Payments debe determinar si requiere revisión. Sin esa determinación no hay activación.
- [ ] **Art. V** AuditLog en transiciones críticas — contrato de tres clases definido; persistencia y atomicidad **bloqueadas** (G06–G07).
- [ ] **Art. VI** RBAC en backend — capabilities de captura, decisión y reapertura **no existen** (Plan 4).
- [~] **Art. VII** Multi-tenant — los modelos nuevos llevarán `tenantId`; `TimeEvidence` existente lo incumple (deuda heredada, Plan 6).
- [x] **Art. VIII** Privacy routing — notas `privacyCritical`; el intérprete de notas usaría la ruta local (spec §9.11). Sin implementación.
- [x] **Art. X** Un solo backend — todo en `apps/api`; BFF en `apps/web/app/api/semse/**`.
- [ ] **Art. XIII** Estados independientes — se registrarán por separado; hoy todos `NOT_STARTED`/`NOT_RUN`/`UNMERGED`/`NOT_DEPLOYED`/`INACTIVE`.
- [ ] Decisión bloqueada «FSM en `packages/fsm`» — **requiere decisión**: crear el paquete o enmendar la constitución (owner de arquitectura).

## 3. Arquitectura y autoridad (propuesta)

- Fuente de verdad de escritura: TimeEntry sigue siendo el único registro de horas (Labor Engine). La conciliación **no escribe** TimeEntry (C3-05). Las correcciones van sólo por BO-08 reforzado.
- Nuevo agregado propuesto: caso de conciliación (lote → caso → declaración versionada → cotejo → decisión/ajuste → etapa). Owner: módulo Labor Engine (`apps/api/src/modules/labor-engine/`), sin módulo nuevo independiente (C3-16).
- Read model: lector canónico de TimeEntry por organización (spec §10.6/§10.9). Ruta, corte y límite **requieren owner**.
- Contratos Zod: `packages/schemas/src/` (nuevos schemas del caso, la constancia y el resultado). La skill `semse-schemas-contract` advierte que nada obliga a las páginas a importarlos; hay que verificarlo en review.
- API/BFF/UI: endpoints bajo `/v1/labor/...` y BFF `apps/web/app/api/semse/labor/**`; pestaña dentro de `/worker/tracker` y de `/admin/labor-engine`. El parche DEV de Plan 1 **no** se usa como base hasta la aprobación de la SDD. **[2026-11-23] Ubicación de navegación (Plan 7 N7-08…N7-14):** la conciliación semanal vive en Time Tracker › Time Entry › Conciliación, dentro de la navegación interna de Time Entry, no como un acceso del carrusel principal. Su resumen es Time Entry › Resumen operativo. El «Cierre de jornada» del carrusel es una revisión diaria, distinta del cierre semanal. Las rutas exactas siguen pendientes de inventario. Esta ubicación no concede permisos ni sustituye los gates.
- Worker/queues: job programado de vencimiento C3-17 (BullMQ) con principal de servicio verificable. **Bloqueado** por G04.
- Agentes/tools: intérprete de notas (§9.11) fuera del primer slice de implementación.
- ADR requerido: (1) ubicación del FSM (`packages/fsm` vs. módulo); (2) token de revisión de TimeEntry; (3) principal de servicio del worker.

## 4. Datos y migración (propuesta; nada se aplica)

- TimeEntry: columna de revisión entera monotónica (recomendación de la spec §10.2); todos los writers W1–W9 la incrementan. Los escritores indirectos I2/I3 (`SetNull`) requieren decisión (G11).
- `LaborTimeCorrection`: `originalRevision`, estado `STALE` y evento `labor_correction.stale` (catálogo).
- Modelos nuevos propuestos, todos con `tenantId` y `orgId`: lote, caso, declaración (versionada e inmutable), constancia de notificación por trabajador y versión (R-C317-13/14/19), resultado y etapa. Nombres y campos se fijan en la SDD aprobada.
- Zona horaria: `Org`/`Worksite` sin zona. C3-17 mide en instantes (R-C317-11), así que el plazo no depende de esto, pero el perfil horario sí (G19/G20).
- Expand/contract: (1) columnas nullable, (2) backfill de revisión, (3) writers actualizados detrás de flag, (4) constraint. Las solicitudes BO-08 pendientes sin `originalRevision` no se aprueban automáticamente (spec §10.3).
- Rollback: forward-fix; la columna de revisión no se elimina una vez emitida.
- Prueba de migración: base aislada con datos sintéticos (`semse-synthetic-test-data`); prohibido contra producción.

## 5. Seguridad y política

- Permisos: capabilities nuevas para capturar, leer equipo, decidir y reabrir (`case.reopen`), definidas por Plan 4. Ninguna se crea en este plan.
- Scope: ResourceScope (401/403/404 según Plan 4 v37), revalidado en cada página y en cada acción.
- Step-up/aprobación: decisión y reapertura requieren autoridad verificada y separación de funciones (C3-04).
- Auditoría: clases A (decisión de acceso), B (mutación/ajuste, atómica) y C (lectura sensible).
- Riesgos: el bootstrap token permite emitir sesión para cualquier `userId` activo (Plan 4/seguridad); `@Public` en la descarga de archivos de Evidence (Plan 4 B4-15).
- Abuse cases: notificación fabricada para iniciar el plazo; parte del pagador manipulado; carrera decisión/vencimiento; cursor manipulado; acceso cross-org.

## 6. Eventos, idempotencia y reconstrucción

- Productores: servicio de conciliación (caso, constancia, decisión, ajuste, reapertura).
- Outbox atómico: el resultado y su evento en la misma transacción; el modelo `DomainOutboxEvent` existe, pero su uso por Labor no está demostrado.
- Nombres de eventos: no se inventan; deben incorporarse a `EVENT_CATALOG.md` por su proceso (p. ej. el propuesto `labor_correction.stale`).
- Idempotencia: clave por (caso, versión del parte, trabajador, tipo de operación).
- Replay/rebuild: el resultado del caso debe reconstruirse desde declaraciones, constancias y decisiones inmutables.
- Correlación: decisión A → mutación B → lectura C con `correlationId` común.

## 7. Estrategia de implementación (sólo tras spec `APPROVED`)

- **Fase A — Tests y contratos:** tests rojos T-R, T-W, T-A, T-C, T-I, T-P, T-B y T-V; schemas Zod.
- **Fase B — Datos y dominio:**
  - B1 revisión en TimeEntry y CAS en W1–W9;
  - B2 BO-08 con `STALE` y `appendInTransaction`;
  - B3 modelos del caso;
  - B4 servicio de conciliación sin writer de TimeEntry.
- **Fase C — API/BFF/UI:**
  - C1 lector canónico;
  - C2 captura de declaración;
  - C3 decisión y reapertura;
  - C4 vista en Tracker con estados explícitos.
- **Fase C′ — Vencimiento C3-17:** job programado con principal de servicio; sólo después de G04.
- **Fase D — Verificación local/CI:** tests dirigidos, regresión, build, typecheck, lint y `spec:validate:strict`.
- **Fase E — Integración:** PR por slice; CI terminal sobre el merge ref; registrar SHA.
- **Fase F — Producción:** flag inactivo; canary autenticado en la organización piloto sólo con la autoridad del responsable designado verificada (G23); rollback = desactivar el flag.

**Slices propuestos (un PR reversible cada uno):**
- S1 = B1+B2 (concurrencia, sin UI);
- S2 = C1 (lector);
- S3 = B3+B4+C2+C3+C4 (caso);
- S4 = C′ (vencimiento C3-17).

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Un writer no incrementa la revisión | media | alto (CAS falso) | inventario §10.11 + test T-C04 por writer | conflicto no detectado en carrera |
| Vencimiento aplicado sin constancia válida | media | alto (base de facturación incorrecta) | R-C317-13/15 fail-closed + T-V13/T-V15 | ajuste sin constancia en auditoría |
| Decisión humana y vencimiento simultáneos | media | medio | CAS del caso + T-V07 | dos resultados para la misma versión |
| Lectura cross-org | baja | crítico | ResourceScope + T-R04/R05 | cualquier fila ajena |
| `TimeEntry` cambia durante el plazo | media | medio | R-C317-21: cotejo `STALE` terminal, cotejo nuevo y nueva notificación; test T-V23 | diferencia notificada ≠ diferencia vigente |
| Worker sin identidad | alta (hoy) | alto | S4 bloqueado hasta G04 | — |
| `TimeEntry` cambia después del ajuste | media | medio | R-C317-24…26: resultado desactualizado, revisión iniciada por una persona autorizada y sin plazo automático, base conservada hasta la resolución; tests T-V26…T-V31 | resultado sin marcar tras un cambio de revisión de `TimeEntry` |
| Resultado desactualizado que nadie revisa (sin plazo, R-C317-26) | media | medio | visibilidad del resultado desactualizado; recordatorios **no definidos** (decisión aparte del dueño) | resultados desactualizados acumulados sin revisión |
| Reapertura sin autoridad verificable | alta (hoy) | alto | evidencia solicitada a Plan 4; la acción no se expone | reapertura por un actor sin delegación |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| Reglas de horas extra federales (contexto) | DOL FLSA, consultado 16–17 nov 2026 (spec §9.9) | Sólo contexto; validación legal pendiente (G21) |

## 10. Gates antes de tareas

- [ ] Archivos exactos identificados — parcial: writers, lectores y auditoría en spec §10.10–§10.13
- [ ] Migración y rollback definidos — propuesta §4, sin aprobar
- [ ] Tests ordenados antes del código — listados, no escritos
- [ ] Canary/feature flag definidos — propuesta §7 F, sin flag
- [ ] Evidencia requerida para cada estado de entrega — Art. XIII
- [ ] Scope cabe en un PR reversible — S1–S4 propuestos
- [ ] Spec `APPROVED` — **no**
