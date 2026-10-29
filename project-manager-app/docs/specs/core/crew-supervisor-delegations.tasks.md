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
- [x] DOC-04b-a — inventariar creación de Org, Membership y las fuentes de autoridad (P-01).
- [x] DOC-04b-b — documentar candidato de verificación/revocación de autoridad (sin implementar).
- [ ] DOC-04b-c — ratificar modelo canónico, revisor, pruebas y migración, e implementar guard tras aprobación.
- [x] DOC-04b-d — comprobar que createCrew() sigue nombrando supervisor inicial
  con solo `org:crews:manage` (sin owner verificado); brecha legacy documentada.
- [ ] DOC-04b-e — cerrar autorización de nombramiento en `createCrew`
  y futuros replace/revoke según autoridad empresarial verificada,
  sin retirar permisos generales de gestión legítimos.
- [x] DOC-05a a DOC-09a — recopilar opciones y propuesta técnica de OPEN-SUP-02…06.
- [ ] DOC-05 — **ratificar** OPEN-SUP-02 elegibilidad/engagement.
- [ ] DOC-06 — **ratificar** OPEN-SUP-03 suplencia.
- [ ] DOC-07 — **ratificar** OPEN-SUP-04 grados de autonomía.
- [ ] DOC-08 — **ratificar** OPEN-SUP-05 safety / no confundir con OSHA competente.
- [ ] DOC-09 — **ratificar** OPEN-SUP-06 transición legacy segura.
- [ ] DOC-10 — revisión independiente, `APPROVED`, index, análisis.

## Estado real S0a/S0b en GitHub (2026-10-28)

- [x] Comparación con [#1054](https://github.com/Semse-projet/project-manager-app/pull/1054):
  código S0a y tests N01–N09 presentes en PR DRAFT tras commit
  `d5b2520` (2026-10-28), **no ejecutados**.
- [x] Comparación con [#1053](https://github.com/Semse-projet/project-manager-app/pull/1053):
  `appendInTransaction` presente y prueba PostgreSQL reportada para **BO-12**.
- [x] Registrar base de #1054 sobre #1027 y necesidad de refrescarla
  antes de merge, sin confundir el dif de la rama con test PASS.
- [x] Escribir tests N08/N09 en #1054: gestor PRO legítimo y denegaciones
  por Org/tenant aun con claims de sesión (commit `d5b2520`).
- [ ] Ejecutar N01–N09, revisión de seguridad de S0a y validar en entorno
  local adecuado; el autor reportó caché offline incompleta, no falla del código.
- [ ] Reconciliar auditoría S0b con #1053 y prueba de ausencia de
  `ensureActorContext`/upserts sintéticos en mutaciones de assignments.
- [ ] Obtener SDD aplicable APPROVED, realizar tests/red-green y CI
  terminal al final antes de fusionar cualquier PR técnico.

Informe: `docs/reportes/2026-10-28_s0a-s0b-live-pr-reconciliation.md`.

- [x] S0-SEC-TENANT-01 — código #1054: `listMine/roster` de Crew
  requieren tenant de sesión y filtran consultas; test
  `S0A-TENANT-01` escrito, **NO EJECUTADO**.
- [x] S0-SEC-MULTIROLE-02 — tests `N03b` y `N04b` escritos
  para WORKER suspendido/revocado con PRO ACTIVE; **NO EJECUTADOS**.
- [ ] S0-SEC-VALIDATION-03 — ejecución dirigida y PostgreSQL,
  revisión HTTP multi-tenant, no regresión y evidencia SHA #1054.
- [ ] S0-SEC-MERGE-04 — actualizar rama de #1054 respecto a la
  última #1027, resolver conflictos y CI terminal al final, antes
  de fusionar; no merge/deploy por este documento.

- [x] S0-SEC-ROSTER-05 — código #1054: el roster filtra `CrewMember.ACTIVE`
  por `Membership WORKER.ACTIVE` del mismo tenant y org mediante batch.
- [x] S0-SEC-ROSTER-06 — prueba `S0A-ROSTER-01` escrita para
  WORKER revocado con PRO ACTIVE (historial conservado), **NO EJECUTADA**.
- [x] S0-SEC-TENANT-07 — prueba de controlador `S0A-TENANT-02`
  escrita para ignorar headers falsos y transmitir authContext; **NO EJECUTADA**.
- [ ] S0-SEC-VALIDATION-08 — ejecutar pruebas BO-07/BO-10 y
  test de controlador tras instalar dependencias; review de seguridad.

## S0 — Guardas existentes (PR propio)
- [ ] S0-01 — capturar head SHA, flags reales y tests existentes.
- [ ] S0-02 — test rojo: WORKER suspendido y PRO activo, supervisorUserId legacy.
- [ ] S0-03 — tests rojos para cross-org, tenant y crew archivada.
- [ ] S0-04 — parche mínimo con membresía WORKER ACTIVE + contexto de recurso.
- [ ] S0-05 — tests regresión gestores legítimos sin elevar privilegios.
- [ ] S0-06 — ejecutar spec:validate:strict, typecheck, lint y CI.
- [ ] S0-07 — review independiente; sin merge/deploy implícito.

## S0b — integridad de asignaciones (PR propio, después de S0a)
- [x] S0b-DOC-01 — revisión estática `TaskAllocation`, `JobTask`, índice
  único, servicio de auditoría y suites, con contrato N10…N18 en
  `docs/reportes/2026-10-26_s0b-allocation-atomicity-cross-crew-contract.md`.
- [ ] S0b-DEC-01 — ratificar D-S0B-01…05 en BO-10 (tareas crew, conflicto
  inter-crew, lote atómico, traslados y unicidad).
- [x] S0b-DOC-02 — documentar S0-F11 y límite transaccional del audit
  en `docs/reportes/2026-10-26_s0b-audit-transaction-boundary-review.md`.
- [ ] S0b-TEST-01 — escribir tests rojos N10…N18 con PostgreSQL.
- [ ] S0b-TEST-02 — pruebas AUD-01…AUD-08: error de audit, no creación
  de User/Org/Tenant implícitos, retries y competencia de revocación.
- [ ] S0b-CODE-01 — implementar solución transaccional y auditoría segura
  tras SDD APPROVED; proteger idempotencia y fronteras tenant/org/crew.
- [ ] S0b-VALIDATE-01 — tests locales, regresión y revisión seguridad;
  CI solo al final de la preparación y antes del merge.

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

## Documentación de decisiones preparada

- [x] P-01: informe de situación real y modelo candidato en
  `docs/reportes/2026-10-22_p01-canonical-org-owner-authority-design.md`.
- [x] P-02…P-06: alternativas y recomendaciones sin aprobar en
  `docs/reportes/2026-10-22_p02-p06-supervisor-decision-proposals.md`.
- [ ] Ratificar decisiones y ejecutar gates de SDD; ningún cambio de código.

## Registro maestro de pendientes

- [x] Se documentaron los pendientes y orden P-01…P-22 en
  `docs/reportes/2026-10-22_supervisor-backlog-pending-and-ci-last.md`.
- [ ] Completar decisiones OPEN-SUP-02…06 y fuente verificable de OPEN-SUP-01.
- [ ] Cerrar S0-F01…F11, pruebas N01…N18 + AUD-01…AUD-08 y revisión antes de CI.
  S0a N01…N09: `docs/reportes/2026-10-25_s0a-supervisor-negative-test-contract.md`;
  S0b N10…N18: `docs/reportes/2026-10-26_s0b-allocation-atomicity-cross-crew-contract.md`.
- [ ] Mantener `ci_status` NO_VERIFIED/FAIL según evidencia, nunca PASS asumido.

## Criterio de done

- [ ] Owner/representante verificable y autoridad granular por crew.
- [ ] Revocación inmediata en siguiente request, incluso con sesión antigua.
- [ ] Cero escaladas cross-tenant/org/crew, cero acceso a salarios ajenos.
- [ ] PRO independiente conserva perfil, WORKER no hereda autoridad fuera de scope.
- [ ] No duplicación de JobTask, TimeEntry ni Evidence.
- [ ] Gates CI/merge/deploy/activation evidenciados de manera independiente.
