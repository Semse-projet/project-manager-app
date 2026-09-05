# WorkItem: CP-REVIEW-001 — Revisión del Capability Control Plane

**Objetivo:** revisar el spec `platform.semse-os-control-plane` y habilitar
únicamente la creación de plan técnico.
**Nivel de riesgo:** L3
**Owner humano:** Architecture/Security/Governance owners
**Agentes sugeridos:** Domain Architect, Security Reviewer, Governance Auditor,
QA Verifier, DevOps/SRE
**Servicios:** docs, specs, agents, forge, local-runtime
**Spec digest:** `sha256:dc1edb5973bf6b51b3ff6708ec21d9cae7cf314d5f42dab4b0b893afb630f6b0`

## Contexto requerido

- `.specify/memory/constitution.md`
- `docs/SOURCE_OF_TRUTH.md`
- `docs/specs/platform/semse-os-control-plane.*`
- `docs/architecture/ADR-023-semse-os-capability-control-plane.md`
- `docs/security/SEMSE_OS_CONTROL_PLANE_THREAT_MODEL.md`
- `docs/specs/platform/event-backbone.spec.md`

## Herramientas permitidas

- repo read/search;
- edición de documentos de revisión;
- tests y validadores locales;
- investigación de documentación primaria;
- Docker local cuando esté disponible.

## Herramientas prohibidas

- mutaciones de producción;
- secretos o variables Railway;
- migraciones Prisma;
- pagos;
- deploy, merge o publicación;
- implementación de Control Plane antes de aprobación.

## Criterios de aceptación

- [ ] Domain Architecture confirma que no duplica Forge/Agents/Event Backbone.
- [ ] Security acepta threat model o enumera cambios bloqueantes.
- [ ] Governance acepta niveles de riesgo, approvals y dual control.
- [ ] QA acepta verification matrix y rollback local.
- [ ] DevOps acepta Compose como primer adapter y Kubernetes fuera del MVP.
- [x] Owner humano aprobó el digest revisado para crear el plan técnico.

## Decisión humana

`approve` para planificación únicamente. No autoriza tasks, implementación,
migraciones, deploy ni producción.

## Evidencia obligatoria

- comentarios por disciplina;
- decisión y responsables;
- riesgos residuales;
- cambios de contrato solicitados;
- digest del spec revisado.

La evaluación documental por disciplina, hallazgos y riesgos residuales vive en
`docs/architecture/reviews/SEMSE_OS_CONTROL_PLANE_PLAN_REVIEW_2026-07-19.md`.
Los checks permanecen abiertos hasta la aceptación de cada owner; la existencia
del informe no equivale a aprobación.
