---
type: architecture-review
feature: "SEMSE OS Capability Control Plane"
domain: "platform"
date: "2026-07-19"
status: "APPROVED"
plan_status: "APPROVED"
reviewed_plan_digest: "sha256:644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7"
promoted_plan_digest: "sha256:5eaf03d11dc5de1dc6e83a4e5afd4aafed003c9cb1a798fffb989b27d8eb5eab"
approval_scope: "tasks-only"
---

# Revisión cruzada del plan SEMSE OS Control Plane

## Alcance

Revisión documental del plan técnico contra arquitectura, seguridad, governance
y QA. No se ejecutó ni autorizó implementación, migración, instalación, deploy o
producción.

## Resultado por gate

| Gate | Dictamen técnico | Evidencia | Condición pendiente |
| --- | --- | --- | --- |
| Architecture | CONDITIONAL PASS | núcleo puro compartido; API conserva transacción; worker consume solo `operationId`; executor local separado | aceptación humana de ADR-023 |
| Security | REVISE, incorporado al plan | adapter cerrado con `spawn` y allowlists; sin Docker socket en agentes; grant temporal; identidad `CAPABILITY_EXECUTOR` | aceptación humana del threat model y prueba dinámica local |
| Governance | REVISE, incorporado al plan | permisos explícitos; modelo `CapabilityOperationApproval`; requester distinto de approver; dos actores para riesgo critical | aceptar permisos y dual control |
| QA | CONDITIONAL PASS | secuencia test-first, pruebas negativas IDOR/injection/replay, fault injection y rollback | Docker Desktop disponible para pruebas Compose reales |

Ningún dictamen sustituye la decisión de los owners humanos indicados por el
arnés SDD.

## Hallazgos y resolución documental

### GOV-001 — Los approvals existentes no prueban doble control

`AgentApproval` y `DeveloperRuntimeApprovalStore` están ligados a otros runtimes
y no representan de forma inequívoca plan, revisión, target, expiración y dos
decisores independientes. El plan ahora propone
`CapabilityOperationApproval`, prohíbe la autoaprobación y exige dos actores
humanos para operaciones `critical`.

**Estado:** resuelto en diseño; pendiente de aprobación y futura implementación.

### SEC-001 — Administrador y executor no deben compartir autoridad

El plan separa `OPS_ADMIN` de `CAPABILITY_EXECUTOR`. El executor solo obtiene
`capabilities:execute`, no puede aprobar, usa credenciales cortas y queda ligado
al tenant/target. El endpoint interno deberá comprobar rol y permiso.

**Estado:** resuelto en diseño; pendiente de threat-model review.

### SEC-002 — El shell abierto de Developer Runtime no es adapter de infraestructura

`DeveloperRuntimeShellService` acepta comandos arbitrarios y no cumple el
contrato cerrado necesario. El plan prohíbe reutilizarlo y limita el adapter a
operaciones registradas, executable + args, cwd/Compose/service allowlisted,
timeout, redacción y receipts.

**Estado:** resuelto en diseño; debe cubrirse con tests negativos antes de I/O.

### QA-001 — La validación Compose dinámica sigue bloqueada

El contrato estático fija `ollama/ollama:0.32.1` y rechaza `latest`. Docker
Desktop no está instalado/disponible en esta estación, por lo que `docker compose
config`, build, up, readiness y rollback todavía no constituyen evidencia.

**Estado:** abierto y no bloquea la revisión documental; sí bloquea el canary local.

## Decisión registrada

El owner humano aprobó el plan revisado con digest
`644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7`
únicamente para generar `tasks.md`. El plan fue promovido con alcance
`tasks-only`; Architecture, Security, Domain Architecture, Governance,
Product/Ops y Docker local conservan sus gates. La aprobación no autoriza
ejecutar tareas, código, Prisma, instalaciones, deploy ni producción.
