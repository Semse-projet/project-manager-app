# WorkItem: CP-TASKS-REVIEW-002 — Revisión del task graph

**Objetivo:** revisar `platform.semse-os-control-plane.tasks.md` y decidir si se
autoriza exclusivamente Fase 0 documental (T-001..T-007).
**Nivel de riesgo:** L3
**Estado:** COMPLETE_WITH_ENV_BLOCKER
**Owner humano:** Architecture/Security/Governance/Product/Ops owners
**Agentes sugeridos:** Domain Architect, Security Reviewer, Governance Auditor,
QA Verifier y DevOps/SRE
**Tasks digest:**
`sha256:62eeb221dcf408e61df085d73aaf26428bf44d29275e3f83cb1f50fb5c4d3714`
**Tasks digest posterior a F0:**
`sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`

## Inputs

- spec promovido:
  `sha256:54e8506324049e9defc2b0ca8118656520b4e0f4a7b09d2ff79ec32dc3460431`;
- plan revisado aprobado:
  `sha256:644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7`;
- plan promovido `tasks-only`:
  `sha256:5eaf03d11dc5de1dc6e83a4e5afd4aafed003c9cb1a798fffb989b27d8eb5eab`;
- task graph: `docs/specs/platform/semse-os-control-plane.tasks.md`.

## Herramientas y paths permitidos

- lectura y búsqueda del repositorio;
- edición de ADR-023, threat model, contratos, FSM/Event Catalog y documentos de
  decisión estrictamente para T-001..T-007;
- validadores `node scripts/spec-*.mjs` y tests estáticos ya versionados;
- inspección read-only del host Docker.

## Prohibido bajo este WorkItem

- T-008 en adelante;
- código en `apps/`, `packages/`, `scripts/` o UI;
- Prisma/migrations, creación de rama o instalación de dependencias;
- iniciar/alterar contenedores;
- Railway, CI/CD, deploy, producción, secretos, pagos o Evidence;
- generar TaskPackets de implementación antes de T-008.

## Criterios de aceptación

- [x] 90 task IDs únicos y ordenados por dependencias.
- [x] Solo T-000 está completada; T-006 documenta el bloqueo Docker.
- [x] F1 empieza con tests y CP-001..CP-015 quedan trazados.
- [x] File/tool scopes, roles Builder/Verifier y prohibiciones están explícitos.
- [x] Docker solo bloquea el slice local, no schemas/core/API.
- [x] `implementation_authorized: false` y `production_authorized: false`.
- [x] Owner autorizó T-001..T-005/T-007 e inspección read-only T-006.

## Salida esperada

Decisiones independientes registradas en
`docs/architecture/reviews/SEMSE_OS_CONTROL_PLANE_F0_REVIEW_2026-07-19.md`.
T-001..T-005 y T-007 quedaron aceptadas; T-006 permanece bloqueada por ausencia
de Docker/WSL. Cerrar los contratos F0 no autoriza implementación: T-008 requiere
otra decisión humana sobre el digest vigente de las tasks.
