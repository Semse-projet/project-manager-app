---
type: tasks
feature: "SEMSE OS Capability Control Plane"
domain: "platform"
spec: "docs/specs/platform/semse-os-control-plane.spec.md"
plan: "docs/specs/platform/semse-os-control-plane.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "feat/semse-os-control-plane"
date: "2026-07-19"
risk: "critical"
approval_scope: "implementation-f1-f4-only"
implementation_authorized: "F1-F4-only"
production_authorized: false
approved_plan_review_digest: "644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7"
approved_plan_digest: "5eaf03d11dc5de1dc6e83a4e5afd4aafed003c9cb1a798fffb989b27d8eb5eab"
approved_f0_review_digest: "62eeb221dcf408e61df085d73aaf26428bf44d29275e3f83cb1f50fb5c4d3714"
f0_review_authorized: true
f0_result_plan_digest: "0061f87bd22fc6f0d29b8c5827b8a31c2e55a277af5cb04a8dd110308405d489"
f0_review_status: "COMPLETE_WITH_ENV_BLOCKER"
approved_f1_f3_tasks_digest: "3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae"
approved_f4_tasks_digest: "20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa"
dependency_install_authorized: "frozen-lockfile-only"
lockfile_control_plane_importer_authorized: true
prisma_migration_postgresql_local_authorized: true
git_waiver: true
---

# Tareas: SEMSE OS Capability Control Plane

> F0 documental fue autorizada: T-001..T-005/T-007 están completas y T-006
> permanece bloqueada. T-008/T-009 autorizaron F1-F3 y una aprobación humana
> posterior autoriza exclusivamente F4/T-040..T-048, incluido el importer vacío
> de `packages/control-plane`, Prisma, migration, repository y PostgreSQL local.
> F5 en adelante continúa prohibida; no iniciar Docker, desplegar ni tocar
> producción.

Convenciones: `[ ]` pendiente · `[x]` completado · `[~]` bloqueado · `[P]`
paralelizable dentro de su fase después de satisfacer dependencias.

## 1. Inputs inmutables y límites

| Artefacto | Digest aprobado |
| --- | --- |
| Spec promovido | `sha256:54e8506324049e9defc2b0ca8118656520b4e0f4a7b09d2ff79ec32dc3460431` |
| Plan revisado por el owner | `sha256:644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7` |
| Plan promovido `tasks-only` | `sha256:5eaf03d11dc5de1dc6e83a4e5afd4aafed003c9cb1a798fffb989b27d8eb5eab` |

Fuera de alcance para todos los task packets:

- Railway, producción, Kubernetes, pagos, escrow y mutaciones de Evidence;
- secretos literales, `.env`, credenciales largas o Docker socket en agentes;
- shell/comandos provenientes de Prometeo o del modelo;
- reutilizar `DeveloperRuntimeShellService` como adapter de infraestructura;
- extracción masiva de microservicios o segundo runtime de agentes;
- dependencias nuevas sin revisión y autorización específicas.

## 2. Grafo de dependencias

```text
F0 gates + autorización de implementación
  -> F1 tests rojos
  -> F2 schemas
  -> F3 núcleo puro
  -> F4 persistencia aditiva
  -> F5 API + approvals + eventos
  -> F6 queue + executor local
  -> F7 local-ai-runtime
  -> F8 Mission Control read-only
  -> F9 verificación y DecisionPackage
```

Ninguna fase puede usar un artefacto de una fase posterior. Los builders no
certifican su propio trabajo; Security/Governance y QA producen evidencia
independiente en F9.

## 3. Contrato del Agent Harness

Cada WorkItem/TaskPacket futuro debe contener:

- `specDigest`, `planDigest`, digest de estas tasks y task IDs exactos;
- owner, riesgo, dependencias, lease/timeout y criterios de parada;
- `allowedPaths` mínimos y herramientas permitidas;
- pruebas obligatorias y evidencia esperada;
- rollback, secretos por handle y acciones explícitamente prohibidas.

La autoridad efectiva es la intersección de spec, task packet, manifest del
agente, policy del entorno y aprobación humana. Prometeo propone; Governance
decide; el adapter ejecuta únicamente contratos estructurados.

## Fase 0 — Gates y autorización bloqueante

> T-000..T-005 y T-007 tienen evidencia documental. T-006 sigue bloqueada y
> T-008/T-009 conservan el candado de implementación.

- [x] **T-000** Registrar la aprobación `tasks-only` del plan revisado.
  - Evidencia: frontmatter del plan y de este documento.
- [x] **T-001** Architecture acepta ADR-023 y documenta límites con
  Forge, Agents, Developer Runtime, Event Backbone y Mission Control.
  - Archivo permitido: `docs/architecture/ADR-023-semse-os-capability-control-plane.md`.
  - Evidencia: ADR `ACCEPTED` para diseño, sin autorización de implementación.
- [x] **T-002** Security acepta el threat model, incluyendo broker local,
  `spawn(executable,args[])`, allowlists, grant temporal, redacción y ausencia
  de Docker socket en agentes.
  - Archivo permitido: `docs/security/SEMSE_OS_CONTROL_PLANE_THREAT_MODEL.md`.
  - Evidencia: controles TOCTOU, path/symlink, broker identity, output y red.
- [x] **T-003** Domain Architecture acepta FSM y eventos candidatos y los
  incorpora sin duplicados en los catálogos canónicos.
  - Archivos permitidos: `docs/foundation/STATE_MACHINES.md`,
    `docs/foundation/EVENT_CATALOG.md`,
    `docs/specs/platform/semse-os-control-plane.contracts.md`.
  - Evidencia: lifecycle y diez eventos v1 reservados; ningún productor activo.
- [x] **T-004** Governance acepta `OPS_ADMIN`, `CAPABILITY_EXECUTOR`, permisos,
  requester distinto de approver, dos actores humanos para riesgo `critical`,
  expiración y binding a digest/revisión/target.
  - Evidencia: `docs/program/governance/SEMSE_OS_CONTROL_PLANE_AUTHORIZATION_MODEL.md`.
- [x] **T-005** Product/Ops acepta que el único primer slice sea
  `local-ai-runtime` con Ollama local, sin Railway ni datos productivos.
  - Evidencia: `docs/program/SEMSE_OS_CONTROL_PLANE_LOCAL_AI_SLICE_DECISION.md`.
- [~] **T-006** Habilitar Docker Desktop + WSL 2 y demostrar `docker version` y
  `docker compose version`.
  - Bloqueo verificado: Docker/desktop/procesos ausentes y WSL no instalado.
  - `winget list` no pudo consultar por ausencia de sesión válida.
  - No instalar ni iniciar nada bajo la aprobación vigente.
- [x] **T-007** Data Architecture acepta el paquete de migración aditiva, su
  rollback operacional y el nombre exacto de la futura carpeta de migration.
  - No editar `schema.prisma` durante este gate.
  - Ruta futura reservada:
    `packages/db/prisma/migrations/20260719000000_semse_os_capability_control_plane/migration.sql`.
  - Evidencia: `docs/architecture/migrations/SEMSE_OS_CONTROL_PLANE_MIGRATION_PLAN.md`.
- [x] **T-008** Tras cerrar T-001..T-005 y T-007, el owner humano autoriza
  explícitamente implementación sobre el digest final de estas tasks y define
  si el permiso cubre una o varias fases. T-006 sigue bloqueando F7/T-094.
  - Scope aprobado: F1-F3 (T-010..T-038); F4+ y staging/producción fuera.
  - Se autoriza instalación exacta del lockfile y waiver Git sin branch/commit.
  - Aprobación posterior sobre `20a60e08…0aaa`: F4/T-040..T-048 completo y
    registro del importer vacío en el lockfile; F5+ continúa fuera.
- [x] **T-009** Forge Supervisor genera TaskPackets por fase con scopes mínimos,
  owners separados Builder/Verifier y leases; para F1..F6 depende de T-001..T-005,
  T-007 y T-008. Los packets de F7/T-094 dependen además de T-006.
  - Evidencia: `docs/agents/agent-runtime/task-packets/CP-F{1-TESTS,2-SCHEMAS,3-CORE,4-DATA}.md`.

## Fase 1 — Tests antes del código

> Bloqueada por T-001..T-005 y T-007..T-009. T-006 bloquea únicamente el slice
> local y T-094. Los tests deben fallar por ausencia controlada de la feature
> antes de implementar F2.

- [x] **T-010** Crear fixtures de manifests válidos, incompatibles y maliciosos.
  - Paths: `tests/fixtures/capabilities/**`.
  - Cubre CP-001, firma/publisher, semver, secret literal y tag mutable.
- [x] **T-011** [P] Escribir tests de FSM para transiciones válidas, inválidas y
  terminales.
  - Path: `tests/unit/capability-fsm.test.ts`.
- [x] **T-012** [P] Escribir tests de planner/digest determinista, dependencias,
  drift y cambio de target/revisión.
  - Path: `tests/unit/capability-planner.test.ts`; cubre CP-004 y CP-007.
- [x] **T-013** [P] Escribir tests de policy y approval: deny no llama adapter,
  autoaprobación rechazada, dos humanos para `critical`, expiry y replay.
  - Path: `tests/unit/capability-policy.test.ts`; cubre CP-003 y CP-004.
- [x] **T-014** [P] Escribir negativos API 400/403/404/409, IDOR tenant/org/
  workspace y separación de permisos.
  - Path: `apps/api/test/capabilities.controller.test.ts`; cubre CP-002.
- [x] **T-015** [P] Escribir integration tests de idempotencia, lease,
  state+outbox y rollback transaccional con PostgreSQL real.
  - Path: `apps/api/test/capability-persistence.integration.test.ts`;
    cubre CP-005, CP-006 y CP-011.
- [x] **T-016** [P] Escribir tests de worker retry/crash/receipt sin doble apply.
  - Path: `tests/unit/capability-worker.test.mjs`; cubre CP-005 y CP-014.
- [x] **T-017** [P] Escribir negativos del adapter contra command injection,
  cwd/service/Compose fuera de allowlist, timeout y secreto en output.
  - Path: `tests/unit/capability-compose-adapter.test.mjs`;
    cubre CP-008 y CP-013.
- [x] **T-018** Escribir fault test local de liveness sin readiness y rollback a
  revisión direccionable.
  - Path: `tests/integration/capability-local-ai-runtime.test.mjs`;
    cubre CP-009 y CP-010.
- [x] **T-019** Ejecutar la selección anterior, guardar baseline rojo y probar
  que ningún fallo proviene del arnés o de fixtures corruptos.

## Fase 2 — Schemas compartidos

- [x] **T-020** Implementar schemas Zod estrictos para manifest,
  installation, operation, plan, approval, grant y receipt.
  - Path: `packages/schemas/src/capability-control-plane.schema.ts`.
- [x] **T-021** Exportar los contratos desde `packages/schemas/src/index.ts` sin
  duplicar tipos locales en API/worker.
- [x] **T-022** Validar semver, digest, publisher, `SecretReference`, steps
  cerrados, timeouts acotados y prohibición de secretos literales.
- [x] **T-023** Añadir schemas del protocolo executor/broker: solo IDs, digest,
  grant handle y receipts; nunca comando shell o Compose completo.
- [x] **T-024** Pasar CP-001 y los casos de schema de CP-008/CP-013.
- [x] **T-025** Ejecutar build/typecheck de `@semse/schemas` y registrar evidencia.

## Fase 3 — Núcleo puro `@semse/control-plane`

- [x] **T-030** Crear `packages/control-plane/package.json` y
  `packages/control-plane/tsconfig.json` siguiendo packages workspace actuales.
- [x] **T-031** Implementar tipos y parsing de manifests/compatibilidad.
  - Paths: `packages/control-plane/src/types.ts`,
    `packages/control-plane/src/manifest.ts`.
- [x] **T-032** Implementar FSM pura con guards aceptados en T-003.
  - Path: `packages/control-plane/src/fsm.ts`.
- [x] **T-033** Implementar resolución de dependencias, planner determinista y
  digest estable.
  - Path: `packages/control-plane/src/planner.ts`.
- [x] **T-034** Implementar policy inputs/default-deny sin acceso a identidad,
  red o persistencia.
  - Path: `packages/control-plane/src/policy.ts`.
- [x] **T-035** Definir `RuntimeAdapter` y operaciones cerradas; no implementar
  Docker dentro del paquete puro.
  - Path: `packages/control-plane/src/runtime-adapter.ts`.
- [x] **T-036** Exportar únicamente APIs públicas desde
  `packages/control-plane/src/index.ts`.
- [x] **T-037** Confirmar que el paquete no importa NestJS, Prisma, BullMQ,
  Docker, `child_process` ni módulos de agentes.
- [x] **T-038** Pasar T-011..T-013 y registrar CP-003, CP-004 y CP-007.

## Fase 4 — Persistencia aditiva

> Bloqueada además por T-007. La ruta de migration se congela aquí únicamente
> después de ese gate; no se inventa en este documento.

- [x] **T-040** Convertir el paquete de diseño aceptado en DDL revisable,
  índices, constraints, rollout y rollback dentro de la ruta futura reservada;
  confirmar primero que la ruta siga libre y que T-008/T-009 cubran CP-DATA.
- [x] **T-041** Agregar enums/modelos `CapabilityDefinition`, `RuntimeTarget`,
  `CapabilityInstallation`, `CapabilityOperation`,
  `CapabilityOperationApproval` y `CapabilityExecutionReceipt`.
  - Path condicionado: `packages/db/prisma/schema.prisma`.
- [x] **T-042** Crear migration SQL aditiva aprobada, sin down destructivo.
  - Path: se fija por T-040; prohibido usar `db push`.
- [x] **T-043** Implementar repository tenant/workspace scoped y compare-and-set.
  - Path: `apps/api/src/modules/capabilities/capabilities.repository.ts`.
- [x] **T-044** Implementar idempotency key, lease por target/installation y
  receipts únicos.
- [x] **T-045** Implementar transacción atómica estado + AuditLog + outbox v2.
- [x] **T-046** Implementar observe-before-apply y reconciliación de leases
  vencidas sin adopción silenciosa de drift.
- [x] **T-047** Pasar T-015 con PostgreSQL real y demostrar CP-005, CP-006,
  CP-011 y CP-012.
- [x] **T-048** Ejecutar `prisma validate`, generate y migrate diff estático;
  no aplicar a staging/producción.
  - Evidencia F4: 8/8 tests sobre PostgreSQL local efímero; validate/generate
    PASS; 15 FKs, 16 checks y 24 índices no primarios verificados en catálogo.
  - El migrate diff no reporta deriva `Capability*`; conserva deriva histórica
    preexistente de otros dominios, documentada en el reporte F4.

## Fase 5 — API, RBAC, approvals y eventos

- [ ] **T-050** Crear módulo NestJS `capabilities` con controller, service,
  repository, policy, approval service, events y module.
  - Scope: `apps/api/src/modules/capabilities/**`.
- [ ] **T-051** Implementar ownership por tenant + org + workspace y policy
  default-deny en el backend.
- [ ] **T-052** Implementar read/list y creación idempotente de operation usando
  schemas compartidos; no aceptar target/tenant confiados desde el cliente.
- [ ] **T-053** Implementar approve/reject con requester distinto del approver,
  dos humanos para `critical` y binding a digest/revisión/target/expiry.
- [ ] **T-054** Implementar rollback gobernado; rechazar revisión no
  direccionable, grant inválido o operación incompatible con lease.
- [ ] **T-055** Implementar endpoint interno claim/process.
  - Ruta: `POST /v1/capability-operations/:operationId/process`.
  - Recibe solo `workerId`, hace claim/process durable y exige a la vez rol
    `CAPABILITY_EXECUTOR` y permiso `capabilities:execute`.
- [ ] **T-056** Agregar permisos a `packages/auth/src/rbac.ts` y bootstrap de
  identidad/roles a `packages/db/prisma/seed.ts`; no editar `.js` generado a
  mano.
- [ ] **T-057** Registrar `CapabilitiesModule` en `apps/api/src/app.module.ts`.
- [ ] **T-058** Emitir únicamente eventos aceptados en T-003 mediante Event
  Backbone v2, con actor/correlation/causation/idempotency/schemaRef y redacción.
- [ ] **T-059** Pasar T-013/T-014, actualizar
  `docs/architecture/SEMSE_API_SURFACE_V1.md` y demostrar CP-002/003/004/012.

## Fase 6 — Queue, worker y executor Compose local

- [ ] **T-060** Añadir `SEMSE_CAPABILITY_OPERATION_QUEUE` a
  `packages/shared/src/index.ts` y documentar que el payload contiene solo
  `operationId`.
- [ ] **T-061** Encolar después del commit; retries reutilizan operation/digest
  y no aceptan plan canónico desde Redis.
- [ ] **T-062** Crear consumer idempotente en
  `apps/worker/src/modules/capabilities/capability-operation.worker.mjs` y
  registrarlo en `apps/worker/src/main.mjs` con shutdown limpio.
- [ ] **T-063** Revalidar policy, approval, digest, target y grant al hacer claim
  y antes de cada efecto externo.
- [ ] **T-064** Crear executor local en `scripts/capability-runtime/` con
  `index.mjs`, `compose-adapter.mjs`, `allowlist.mjs` y `redaction.mjs`.
- [ ] **T-065** Implementar solo `compose.observe`, `activate_profile`,
  `verify_service`, `stop_service` y `rollback_revision` mediante
  `spawn(executable,args[])`, cwd/Compose/service allowlisted y timeout.
- [ ] **T-066** Persistir receipts por step antes de avanzar y soportar
  cancellation/restart sin doble apply.
- [ ] **T-067** Mantener `SEMSE_CAPABILITY_EXECUTION_ENABLED=false` por defecto;
  el worker no hereda `OPS_ADMIN` ni credenciales Docker del agente.
- [ ] **T-068** Pasar T-016/T-017 y demostrar CP-005, CP-008, CP-013 y CP-014.

## Fase 7 — Slice local `local-ai-runtime`

> Requiere T-005, T-006 y F1..F6 completas. Solo target local allowlisted.

- [ ] **T-070** Crear manifest
  `infra/capabilities/local-ai-runtime.v1alpha1.yaml` con publisher, permisos,
  readiness, rollback y dependencias exactas.
- [ ] **T-071** Registrar la definición en
  `apps/api/src/modules/capabilities/capability-catalog.ts` sin seed productivo.
- [ ] **T-072** Usar el profile `local-ai` de
  `.devcontainer/docker-compose.devcontainer.yml`; fijar Ollama por versión o
  digest aprobado y rechazar `latest`.
- [ ] **T-073** Ejecutar plan/dry-run y demostrar que no existe mutación antes
  de policy y approval.
- [ ] **T-074** Obtener aprobación humana local ligada al plan exacto y emitir
  un grant de corta vida.
- [ ] **T-075** Activar localmente, persistir receipts y exigir liveness +
  readiness antes de `ACTIVE`.
- [ ] **T-076** Inyectar fallo de readiness y demostrar rollback a revisión
  direccionable con estado `ROLLED_BACK`.
- [ ] **T-077** Confirmar que no se contactó Railway, Kubernetes, registry no
  allowlisted ni datos productivos.
- [ ] **T-078** Pasar T-018 y cerrar CP-009/CP-010 con logs redactados.

## Fase 8 — Mission Control read-only y hardening

- [ ] **T-080** Exponer consultas tenant-scoped de installations, operations,
  approvals, receipts, drift e incidentes; ninguna acción Docker desde UI.
- [ ] **T-081** Crear vista read-only en
  `apps/web/app/(app)/admin/mission-control/capabilities/page.tsx`.
- [ ] **T-082** Crear componentes de estado, riesgo, plan digest, approvals,
  rollback y receipts bajo `apps/web/components/semse/capabilities/`.
- [ ] **T-083** Integrar navegación en `apps/web/lib/admin/admin-navigation.ts`
  sin crear una segunda Mission Control.
- [ ] **T-084** Instrumentar métricas definidas en el plan y logs estructurados
  redactados; cubrir CP-015.
- [ ] **T-085** Implementar alertas de operación atascada/drift y replay o
  rollback gobernados, nunca adopción silenciosa.
- [ ] **T-086** Escribir tests de accesibilidad, estados vacíos/error, RBAC y
  ausencia de controles de ejecución directa.
- [ ] **T-087** Crear runbook local de kill switch, claim stop, leases, rollback
  y conservación de evidence/audit.

## Fase 9 — Verificación independiente y cierre

- [ ] **T-090** Ejecutar unit/contract tests afectados y mapear resultados
  CP-001..CP-015.
- [ ] **T-091** Ejecutar integration tests con PostgreSQL real, Redis caído,
  worker crash/retry y concurrencia.
- [ ] **T-092** Ejecutar `pnpm spec:validate:strict` y `pnpm spec:coverage`.
- [ ] **T-093** Ejecutar build/typecheck/lint y verificaciones workspace
  afectadas, sin instalar dependencias no aprobadas.
- [ ] **T-094** Con Docker local: `compose config`, build, up, health/readiness y
  down del profile allowlisted; no usar Railway.
- [ ] **T-095** Ejecutar fault injection, kill switch y rollback; conservar
  receipts, AuditLog y Domain Events.
- [ ] **T-096** Security/Governance reviewer independiente verifica IDOR,
  approvals, grants, secrets, injection, mutable tags y scope de servicio.
- [ ] **T-097** QA Verifier independiente confirma matriz, SLO y ausencia de
  doble apply; el builder no marca esta tarea.
- [ ] **T-098** Actualizar SPEC_INDEX, arquitectura, status matrix, roadmap,
  runbooks y reporte únicamente al estado realmente demostrado.
- [ ] **T-099** Emitir DecisionPackage con riesgos residuales y propuesta del
  siguiente gate. No abrir release/deploy ni promover producción.

## 4. File scopes congelados

| Packet | Allowed paths | Prohibiciones adicionales |
| --- | --- | --- |
| CP-GOV | ADR-023, threat model, contracts, FSM/Event Catalog, authorization/slice decisions, reviews y DecisionPackages | código/runtime |
| CP-TEST | `tests/fixtures/capabilities/**`, tests `capability-*` listados | product code antes del baseline rojo |
| CP-SCHEMA | `packages/schemas/src/capability-control-plane.schema.ts`, `packages/schemas/src/index.ts` | tipos duplicados en apps |
| CP-CORE | `packages/control-plane/**` | I/O, NestJS, Prisma, BullMQ, Docker, agents |
| CP-DATA | migration plan, `packages/db/prisma/schema.prisma`, ruta futura aprobada y capabilities repository | `db push`, down destructivo, datos productivos |
| CP-API | `apps/api/src/modules/capabilities/**`, `apps/api/src/app.module.ts`, RBAC/seed y API docs listados | shell, adapter Docker, secretos |
| CP-RUNTIME | queue constant, worker files y `scripts/capability-runtime/**` listados | Railway, socket en agente, command string |
| CP-LOCAL-AI | manifest local y Compose Dev Container listados | `latest`, cloud/prod, datos reales |
| CP-UI-OBS | Mission Control paths, métricas y runbook listados | ejecución Docker desde browser |

Todo path adicional requiere actualizar estas tasks, recalcular su digest y
obtener aprobación de scope antes de editarlo.

## 5. Criterio de Done

- [ ] Gates T-001..T-008 tienen evidencia humana/técnica verificable.
- [ ] CP-001..CP-015 pasan y están trazados a tests concretos.
- [ ] Estado + outbox + AuditLog son atómicos para cambios materiales.
- [ ] Cross-tenant, autoaprobación, approval replay y doble apply son cero en
  pruebas negativas/concurrentes.
- [ ] El adapter no acepta prompts, shell libre, paths/servicios no allowlisted
  ni secretos literales.
- [ ] `local-ai-runtime` activa y revierte solo en target local.
- [ ] Mission Control explica estado observado sin autoridad de ejecución.
- [ ] Rollback, kill switch, SLO, alertas y runbook tienen evidencia.
- [ ] Security/Governance y QA independientes aceptan o enumeran bloqueos.
- [ ] El estado documental refleja evidencia local/CI real; no confunde código,
  merge, deploy y producción.
- [ ] Producción permanece fuera de scope hasta un gate posterior explícito.
