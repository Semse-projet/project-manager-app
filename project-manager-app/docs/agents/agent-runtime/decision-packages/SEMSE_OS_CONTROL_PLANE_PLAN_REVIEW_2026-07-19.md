# DecisionPackage — Revisión del plan SEMSE OS Control Plane

**Spec:** `platform.semse-os-control-plane`
**Spec status:** `APPROVED` para planificación únicamente
**Spec digest:** `sha256:54e8506324049e9defc2b0ca8118656520b4e0f4a7b09d2ff79ec32dc3460431`
**Plan status:** `APPROVED` (`tasks-only`)
**Plan review digest aprobado:** `sha256:644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7`
**Plan promovido:** `sha256:5eaf03d11dc5de1dc6e83a4e5afd4aafed003c9cb1a798fffb989b27d8eb5eab`
**Decisión humana registrada:** `approve` para generar `tasks.md`
**Tasks generadas:** `sha256:62eeb221dcf408e61df085d73aaf26428bf44d29275e3f83cb1f50fb5c4d3714`

## Resultado propuesto

La aprobación permitió generar `semse-os-control-plane.tasks.md`; no autoriza
ejecutar esas tareas. La implementación requiere una autorización separada
después de cerrar reviews, scopes, Prisma, comandos, rollback y matriz de pruebas.

## Decisiones que el reviewer debe confirmar

1. Nuevo paquete puro `@semse/control-plane` compartido por API/worker.
2. Módulo NestJS `capabilities` como autoridad transaccional.
3. BullMQ recibe solo `operationId`.
4. Executor Compose local separado del API y de agentes.
5. Prohibición de reutilizar `DeveloperRuntimeShellService` para infraestructura.
6. Primer slice `local-ai-runtime` sobre Ollama local.
7. Kill switch OFF por defecto y ausencia total de producción.
8. Modelo propio `CapabilityOperationApproval` con requester distinto del
   approver y dos actores humanos para riesgo critical.
9. Identidad `CAPABILITY_EXECUTOR` separada de `OPS_ADMIN`.
10. Imagen Ollama fijada por versión/digest aprobado; nunca `latest`.

## Gates pendientes

- ADR-023 Architecture;
- threat model Security;
- FSM/eventos Domain Architecture;
- permisos/dual control Governance;
- Docker local para config/build/up/health;
- aprobación humana del plan digest.

Revisión cruzada y riesgos residuales:
`docs/architecture/reviews/SEMSE_OS_CONTROL_PLANE_PLAN_REVIEW_2026-07-19.md`.

## Comandos de verificación documental

```text
node scripts/spec-index.mjs
node scripts/spec-validate.mjs --strict
node --test tests/unit/spec-lib.test.mjs tests/unit/local-container-contract.test.mjs
node scripts/spec-coverage.mjs
node scripts/check-dockerfile-workspace-packages.mjs
```
