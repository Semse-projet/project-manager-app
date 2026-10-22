---
type: tasks
feature: "crew-supervisor-delegations"
domain: "core"
plan: "docs/specs/core/crew-supervisor-delegations.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/sdd-crew-supervisor-delegations-20261022"
date: "2026-10-22"
---

# Tareas — supervisor de cuadrilla

> Estado: backlog SDD. **No hay ejecución de pruebas, código ni deploy
> en este PR documental.** El plan requiere spec APPROVED antes de código.

## SDD / reconciliación
- [x] DOC-01 — inventariar Crew, TaskAllocation, Membership, roles y ofertas desde main.
- [x] DOC-02 — registrar hallazgo de guard WORKER vs cualquier ACTIVE.
- [x] DOC-03 — documentar roles, permisos candidatos, flujos y fuentes primarias.
- [x] DOC-04 — OPEN-SUP-01: aprobar regla exclusiva de propietario/representante verificado (2026-10-22).
- [ ] DOC-04b — validar fuente canónica, lifecycle y prueba backend de titularidad/delegación.
- [ ] DOC-05 — resolver OPEN-SUP-02 elegibilidad/engagement.
- [ ] DOC-06 — resolver OPEN-SUP-03 suplencia.
- [ ] DOC-07 — resolver OPEN-SUP-04 grados de autonomía.
- [ ] DOC-08 — resolver OPEN-SUP-05 safety / no confundir con OSHA competente.
- [ ] DOC-09 — resolver OPEN-SUP-06 transición legacy segura.
- [ ] DOC-10 — revisión independiente, `APPROVED`, index, análisis.

## S0 — Guardas existentes (PR propio)
- [ ] S0-01 — capturar head SHA, flags reales y tests existentes.
- [ ] S0-02 — test rojo: WORKER suspendido y PRO activo, supervisorUserId legacy.
- [ ] S0-03 — tests rojos para cross-org, tenant y crew archivada.
- [ ] S0-04 — parche mínimo con membresía WORKER ACTIVE + contexto de recurso.
- [ ] S0-05 — tests regresión gestores legítimos sin elevar privilegios.
- [ ] S0-06 — ejecutar spec:validate:strict, typecheck, lint y CI.
- [ ] S0-07 — review independiente; sin merge/deploy implícito.

## S1 — autoridad empresarial (PR propio)
- [ ] S1-01 — aplicar regla ratificada: solo dueño o representante VERIFICADO;
  definir la fuente canónica y su prueba server-side, sin suponer `Org.ownerUserId`.
- [ ] S1-02 — policy `org:supervisors:delegate` o alternativa aprobada.
- [ ] S1-03 — tests: dueño verificado sí; representante verificado sí;
  PRO dueño no verificado no; PRO ajeno no; CLIENT/WORKER sin prueba no;
  OPS_ADMIN sin título propio no; revocación de representante => no;
  no eliminar último dueño verificado.
- [ ] S1-04 — gobernar revocación/delegación con motivo y auditoría.
- [ ] S1-05 — no cambiar `org:offers:manage` sin spec de ofertas.

## S2 — persistencia y API (PR propio)
- [ ] S2-01 — test rojo de grant activo/vencido/revocado y recurso.
- [ ] S2-02 — modelar y migrar tabla aditiva, version/CAS, constraints.
- [ ] S2-03 — actualizar EVENT_CATALOG y STATE_MACHINES con eventos aprobados.
- [ ] S2-04 — crear/listar/revocar/mi autoridad con backend policy.
- [ ] S2-05 — escritura atómica estado + audit + outbox.
- [ ] S2-06 — concurrencia revoke-vs-task y idempotencia.
- [ ] S2-07 — test de same-tenant diferente dueño, cross-org/cross-crew.
- [ ] S2-08 — verificar checksum migración y rollback no destructivo.

## S3 — UI y flujos (PR propio)
- [ ] S3-01 — páginas equipo/supervisor, ES/EN y accesibilidad.
- [ ] S3-02 — mostrar crew, org, vigencia, autoridad y deberes.
- [ ] S3-03 — ocultar compensación/PII; no confiar en UI como guard.
- [ ] S3-04 — reutilizar JobTask/TaskAllocation, no crear TimeEntry doble.
- [ ] S3-05 — pruebas de cambio idioma, logout/switch org, revoked/error.
- [ ] S3-06 — Prometeo solo read-only y deny-by-default.

## S4 — verificación / entrega: CI como último gate pre-merge
- [ ] S4-01 — terminar código/spec y tests locales unit/API/integration;
  build/typecheck/lint (sin ejecutar CI manual todavía).
- [ ] S4-02 — `pnpm spec:validate:strict`, `pnpm spec:index`, cobertura
  local y reconciliación de documentos.
- [ ] S4-03 — revisión independiente de seguridad y gobernanza funcional;
  cerrar observaciones sin ampliar alcance.
- [ ] S4-04 — **CI AL FINAL**: después de S4-01…03, diagnosticar histórico,
  validar todos los checks obligatorios sobre HEAD final y registrar SHA.
- [ ] S4-05 — merge explícitamente autorizado solo con CI PASS;
  migración y deploy se verifican por separado.
- [ ] S4-06 — staging sintético, smoke autenticado ES/EN, móvil.
- [ ] S4-07 — canary opt-in, señales de rollback y evidencia.
- [ ] S4-08 — estado VERIFIED solo con evidencias reales.

## Registro maestro de pendientes

- [x] Se documentaron los pendientes y orden P-01…P-22 en
  `docs/reportes/2026-10-22_supervisor-backlog-pending-and-ci-last.md`.
- [ ] Completar decisiones OPEN-SUP-02…06 y fuente verificable de OPEN-SUP-01.
- [ ] Cerrar S0-F01…F05, pruebas N01…N12 y review antes de CI.
- [ ] Mantener `ci_status` NO_VERIFIED/FAIL según evidencia, nunca PASS asumido.

## Criterio de done

- [ ] Owner/representante verificable y autoridad granular por crew.
- [ ] Revocación inmediata en siguiente request, incluso con sesión antigua.
- [ ] Cero escaladas cross-tenant/org/crew, cero acceso a salarios ajenos.
- [ ] PRO independiente conserva perfil, WORKER no hereda autoridad fuera de scope.
- [ ] No duplicación de JobTask, TimeEntry ni Evidence.
- [ ] Gates CI/merge/deploy/activation evidenciados de manera independiente.
