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
- [x] [T-007A2] Añadir y ejecutar en GitHub Actions smoke real del módulo y CLI (SHA `961c7036`, CI #40262055473: SUCCESS).
- [x] [T-007] Registrar smoke del checkout real previo a soporte de overrides: 21 JS, 2 Python, 285 declaraciones, 214 nombres; CI #40262055473, sin evidencia runtime de Railway.
- [ ] [T-007B] Repetir y acreditar el smoke del HEAD corregido (esperados 4 `OVERRIDE_APPLIED`, 2 `UNVERIFIED`, sin falsos stale).
- [x] [T-008] Reconciliar las 6 discrepancias: 4 pins `overrides` (explicitar `OVERRIDE_APPLIED`) y 2 peers sin resolver; documentar en `docs/reportes/2026-10-25_library-hub-f1-lockfile-reconciliation.md`; sin tocar dependencias.
- [ ] [T-008B] Comprobar resultado real del nuevo parser en CI y dejar revisión de compatibilidad de 3 pins potencialmente fuera de rango en backlog.
- [ ] [T-009] Ejecutar `pnpm spec:index:check` y `pnpm spec:validate:strict` al final.
- [ ] [T-010] CI terminal con nuevo smoke de checkout y review independiente; PR no fusionado.
- [ ] [T-011] Actualizar estado SDD/evidencia tras la ejecución real, sin activar producción.

**Excluido:** SBOM transitorio oficial, vulnerabilidades/licencias automáticas, adapters runtime, nuevos servicios, deploy.
