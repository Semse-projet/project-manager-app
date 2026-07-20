---
type: tasks
feature: "F2 — Prometeo Tool Registry gobernado"
domain: "prometeo"
plan: "docs/specs/prometeo/tool-registry-governance.plan.md"
version: "1.0"
status: "PENDING"
branch: "feat/f2-tool-registry-governance"
date: "2026-07-20"
---

# Tareas: F2 — Prometeo Tool Registry gobernado

> Orden obligatorio. No iniciar código hasta crear la rama de implementación
> desde `main` limpio y confirmar que spec/plan siguen APPROVED.

## Fase 0 — Preflight

- [x] **T-001** Crear `feat/f2-tool-registry-governance` desde `origin/main` limpio.
- [x] **T-002** Ejecutar `pnpm spec:validate:strict` y guardar baseline (0 errores, 0 warnings, confirmado 2026-07-20).
- [x] **T-003** Revisar Prisma schema/migrations recientes para evitar colisión con `PrometeoProposedAction`/`PrometeoToolInvocationAudit`. Sin colisión; migración `20260722000000_prometeo_tool_governance`.

## Fase 1 — Tests antes del código (F2-A)

- [x] **T-010** Test: `evaluatePrometeoToolPolicy` devuelve `allow` cuando el actor tiene todos los `descriptor.permissions`. (`apps/api/test/prometeo-tool-governance.policy.test.ts`)
- [x] **T-011** Test: devuelve `deny` cuando falta al menos uno de los permisos declarados por la tool (aunque el actor tenga `agents:run:create`).
- [x] **T-012** Test: devuelve `require_approval` cuando `approvalPolicy !== "none"` y el permiso sí está.
- [x] **T-013** Test: `invokeReadTool` responde 403 (no 200 con `__blockedReason`) cuando la policy deniega. (`apps/api/test/prometeo-tool-execution.service.test.ts`)
- [x] **T-014** Migración Prisma draft (`PrometeoProposedAction`, `PrometeoToolInvocationAudit`) + `prisma migrate diff` estático. `packages/db/prisma/migrations/20260722000000_prometeo_tool_governance/`, `prisma validate` OK. Sin `DATABASE_URL` real en este entorno no se pudo correr `migrate dev`/`diff` contra una base viva — el SQL se escribió a mano siguiendo el formato exacto que genera Prisma (comparado con migraciones recientes reales); falta que CI/un entorno con DB lo confirme antes de mergear a producción.
- [x] **T-015** Confirmar que T-010..T-013 fallan por ausencia controlada antes de implementar. (el módulo `tool-governance.policy.ts` no existía; los tests referenciaban un import inexistente)

## Fase 2 — Enforcement de lectura + audit (F2-B)

- [x] **T-020** Implementar `tool-governance.policy.ts` (`evaluatePrometeoToolPolicy`) — consume `hasPermission()` de `@semse/auth`, sin estado propio.
- [x] **T-021** Cablear la policy en `invokeReadTool` antes del switch de ejecución — deny lanza `ForbiddenException` (403) con `missingPermissions`.
- [x] **T-022** Implementar `tool-governance.repository.ts` (write path de `PrometeoToolInvocationAudit`). `@Optional()` sobre `PrismaService`, mismo patrón que `OutboxRepository` (no-op si no hay Prisma inyectado).
- [x] **T-023** Registrar en `PrometeoToolInvocationAudit` cada invocación de lectura (bloqueada por policy, bloqueada por adapter no cableado, y exitosa) — las 3 ramas de `invokeReadTool`.
- [x] **T-024** Añadir campo `adapterPending: boolean` explícito a `PrometeoToolDescriptor` (schema + registry). Marcados: los 6 tools `vision:run` sin case (5 + `analyze_video`) y los 7 write tools (ninguno tiene `invokeWriteTool` todavía).
- [x] **T-025** `GET /v1/prometeo/tools` expone `executable: !adapterPending` real por tool.
- [x] **T-026** Pasar T-010..T-013 en verde. 19/19 tests nuevos de F2 pasan; suite completa `@semse/api` 1924/1925 (único fallo preexistente ajeno en `graphify.service.test.ts`, no relacionado).

**Fase 2 (F2-B) completa.** Siguiente: Fase 3 (write tools + proposed actions) y Fase 4 (gate híbrido de pagos) quedan para incrementos posteriores.

**Hallazgo adicional durante la implementación:** el permiso `payments:write`
que declara `payments.propose_release` no existe en ningún rol de
`packages/auth/src/rbac.ts` — ni siquiera `OPS_ADMIN` lo tiene. Con el
enforcement de T-021 ya activo, esa tool sería hoy inejecutable por
cualquier actor. Esto es exactamente el tipo de brecha silenciosa que F2
existe para cerrar, pero la corrección de qué permiso real debe exigir
`payments.propose_release` es una decisión de producto/seguridad para F2-D
(T-040), no algo que este commit decida unilateralmente.

## Fase 3 — Write tools de bajo riesgo (F2-C)

- [x] **T-030** Implementar `invokeWriteTool` en `PrometeoToolExecutionService`. Deniega igual que `invokeReadTool` (mismo `evaluatePrometeoToolPolicy`); si `approvalPolicy` es `"none"` ejecuta el efecto directo; si requiere aprobación, crea un `PrometeoProposedAction` y devuelve `status: "queued"` sin ejecutar nada todavía.
- [x] **T-031** Decisión: ninguna de las 7 write tools pasa a `approvalPolicy: "none"` en este incremento. Las 6 tools de bajo/medio riesgo (`time_tracker.start/pause/resume/stop/create_manual_entry`, `agro.create_task`) quedan en `"confirm"` — el mecanismo de aprobación queda operativo y el propio actor puede auto-aprobar su propia propuesta (ver T-033), lo que en la práctica es casi tan fluido como `"none"` pero deja rastro auditable (`PrometeoProposedAction` + `PrometeoToolInvocationAudit`) antes de tocar datos reales. `payments.propose_release` sigue en `"human_required"` (Fase 4). Revisar esta decisión con el owner de producto si se quiere real `"none"` para alguna de las 6 en un incremento futuro.
- [x] **T-032** Implementado en `ToolGovernanceRepository` (`createProposedAction`, `findProposedAction`, `transitionProposedAction`, `finalizeProposedAction`) + wiring en `invokeWriteTool` para las tools `approvalPolicy: "confirm"` (`agro.create_task`, `time_tracker.*`). El adapter real (`executeWriteEffect`) quedó cableado para estas 6 — llaman a los mismos `FieldOpsService`/`AgroTaskService` que sus endpoints REST — por lo que `adapterPending` pasó a `false` para ellas en el registry (antes las 7 write tools eran `adapterPending: true`; `payments.propose_release` se mantiene `true`, gateada a Fase 4/T-041).
- [x] **T-033** `POST /v1/prometeo/tools/invocations/:id/approve` y `.../reject` implementados en `PrometeoController` + `PrometeoToolExecutionService.approveProposedAction`/`rejectProposedAction`. RBAC: `OPS_ADMIN` (normalizado vía `normalizeRoles`, incluye alias `ADMIN`) siempre puede decidir; el actor original puede auto-aprobar/rechazar únicamente cuando `approvalPolicy === "confirm"` — para `human_required`/`dual_approval` solo `OPS_ADMIN`. Acción inexistente → 404.
- [x] **T-034** Tests en `apps/api/test/prometeo-tool-write-execution.service.test.ts`: aprobar (T-034) ejecuta el efecto real vía el mock de `FieldOpsService` y persiste `resultJson` con `finalizeProposedAction({status:"EXECUTED",...})`; rechazar (T-034b) deja `status: "REJECTED"` con `rejectionReason` y nunca invoca el ejecutor (contador de llamadas en 0).
- [x] **T-035** Test de transición atómica: `transitionProposedAction` usa `prisma.updateMany({where:{status:{in:[...]}}})` condicionado — aprobar una acción ya terminal responde 409 (`ConflictException`) sin re-ejecutar (T-035). Test de concurrencia (T-035b) lanza dos `approveProposedAction` en paralelo sobre la misma acción: exactamente una se resuelve con `"succeeded"`, la otra recibe 409, y el efecto subyacente se invoca una sola vez.

**Fase 3 (F2-C) completa.** 19 tests nuevos (10 en `prometeo-tool-write-execution.service.test.ts` + 2 de registry actualizados); suite completa `@semse/api` 1936/1936 en verde, sin regresiones. Siguiente: Fase 4 (gate híbrido de pagos, `payments.propose_release`) queda para un incremento posterior — requiere primero resolver el hallazgo de F2-B sobre el permiso `payments:write` inexistente en `rbac.ts` (T-040).

**Hallazgo adicional durante la implementación (F2-C):** el descriptor de `agro.create_task` en el registry no declaraba `type` como campo requerido, pese a que `AgroTaskService.createTask` lo exige y rechaza con 400 cualquier valor fuera de `VALID_TYPES`. Sin este fix, la tool habría quedado con adapter cableado pero inejecutable en la práctica (todo intento real habría fallado por falta de `type`). Corregido en `prometeo-tool-registry.ts`: `type` ahora es requerido con el mismo enum que `VALID_TYPES` en `agro-task.service.ts` (duplicado intencionalmente, mismo patrón que `materials.calculate`; si `VALID_TYPES` cambia, este enum debe actualizarse a mano).

## Fase 4 — Gate híbrido de pagos (F2-D)

- [ ] **T-040** Conectar `payments.propose_release` al flujo `PrometeoProposedAction` (namespace `payments` fuerza `human_required`/`dual_approval` — confirmar cuál con el owner si `dual_approval` aplica aquí).
- [ ] **T-041** Al aprobar, llamar `POST /v1/milestones/:milestoneId/escrow/release` sin modificar ese endpoint ni `PaymentsService.release()`.
- [ ] **T-042** Test: rechazo de la propuesta de pago no deja ningún estado a medio camino en `PrometeoProposedAction` ni en Payments.
- [ ] **T-043** Test: aprobación de una propuesta de pago cuyo milestone dejó de cumplir los invariantes de `PaymentsService.release()` (p. ej. disputa abierta abierta entre la propuesta y la aprobación) falla limpio en el gate financiero existente — F2 no lo enmascara.
- [ ] **T-044** Fault test: `PrometeoProposedAction` aprobada dos veces en paralelo (concurrencia) ejecuta el release una sola vez.

## Fase 5 — Validación y cierre (F2-E)

- [ ] **T-050** `pnpm spec:validate:strict`.
- [ ] **T-051** Tests unitarios/integration del slice completo.
- [ ] **T-052** `pnpm verify:workspace`.
- [ ] **T-053** Actualizar `docs/architecture/SEMSE_API_SURFACE_V1.md` con los endpoints nuevos.
- [ ] **T-054** Actualizar `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md` (fila Tool Registry) con conteos reales post-implementación.
- [ ] **T-055** Actualizar `ROADMAP.md` sección F2 según estado real.
- [ ] **T-056** Crear reporte F2 con evidencia (mismo formato que `F1E_OPS_DLQ_REPLAY_2026-07-19.md`).

## Criterio de cierre

- [ ] ninguna tool declarada aparece como ejecutable sin adapter;
- [ ] `descriptor.permissions` se verifica en el 100% de las invocaciones, no solo `agents:run:create`;
- [ ] write tools de riesgo medio/alto requieren aprobación registrada antes de ejecutar;
- [ ] `payments.propose_release` nunca mueve dinero sin pasar por `PaymentsService.release()` intacto;
- [ ] cada ejecución deja `auditRef`/registro real, no una etiqueta;
- [ ] CI verde en el SHA de corte;
- [ ] spec marcado `IMPLEMENTED`/`VERIFIED` solo con evidencia correspondiente.
