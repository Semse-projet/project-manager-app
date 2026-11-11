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
- [x] [T-007B] Smoke sobre checkout real: 4 `OVERRIDE_APPLIED`, 2 `UNVERIFIED`, 0 `STALE_LOCKFILE`; CI #40264754613 SUCCESS.
- [x] [T-008] Reconciliar las 6 discrepancias: 4 pins `overrides` (explicitar `OVERRIDE_APPLIED`) y 2 peers sin resolver; documentar en `docs/reportes/2026-10-25_library-hub-f1-lockfile-reconciliation.md`; sin tocar dependencias.
- [x] [T-008B] Resultado real del parser comprobado en CI; compatibilidad de 3 pins fuera de rango remitida al PR de control aislado #1052 (sin tocar dependencias).
- [x] [T-009] `spec:index:check`, `spec:validate:strict` y todos los jobs del CI #40264754613 PASS en el SHA del código final; metadata de entrega ahora actualizada.
- [x] [T-010A] CI terminal para código F1 aprobado (run #40264754613, SHA `0e4f1815`).
- [ ] [T-010B] Revisión humana independiente del PR; pendiente, sin merge.
- [x] [T-011] Actualizar SDD: código COMPLETE, CI PASS, **UNMERGED**, **NOT_DEPLOYED**, **INACTIVE**, con evidencia vinculada; no implica aprobación humana final.

**Excluido:** SBOM transitorio oficial, vulnerabilidades/licencias automáticas, adapters runtime, nuevos servicios, deploy.
