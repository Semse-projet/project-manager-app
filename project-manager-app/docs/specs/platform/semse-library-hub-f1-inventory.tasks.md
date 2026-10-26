---
type: tasks
feature: "semse-library-hub-f1-inventory"
domain: "platform"
plan: "docs/specs/platform/semse-library-hub-f1-inventory.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/semse-library-hub-f1-static-scanner-20261025"
date: "2026-10-25"
---

# Tareas F1

- [x] [T-001] Aprobación del propietario sólo para escáner estático read-only.
- [x] [T-002] Tests de contrato y casos adversariales, antes de escribir implementación.
- [x] [T-003] Lector JSON manifiestos, workspace y pnpm importers v9 con estado UNKNOWN.
- [x] [T-004] Parser conservador Python; URL sanitizada y requirements sin resolver.
- [x] [T-005] CLI stdout JSON, sin añadir deps ni modificar instalación.
- [x] [T-006] Revisión de sintaxis y fixture aislado (no equivale a tests Node reales).
- [x] [T-007A] Ejecutar 15/15 pruebas reales con Node 22 sobre archivos idénticos por SHA Git, cobertura 98.90% líneas / 85.54% ramas / 100% funciones del lector y CLI determinista sobre fixture sintético; registrar evidencia en `docs/reportes/2026-10-25_library-hub-f1-local-test-evidence.md`.
- [ ] [T-007] Repetir pruebas en el checkout completo con el runtime y herramientas de SEMSE; no confundir con la prueba aislada.
- [ ] [T-008] Reconciliar versiones con lockfile completo y false negatives detectados.
- [ ] [T-009] Ejecutar `pnpm spec:index:check` y `pnpm spec:validate:strict` al final.
- [ ] [T-010] CI terminal y review independiente; PR no fusionado.
- [ ] [T-011] Actualizar estado SDD/evidencia tras la ejecución real, sin activar producción.

**Excluido:** SBOM transitorio oficial, vulnerabilidades/licencias automáticas, adapters runtime, nuevos servicios, deploy.
