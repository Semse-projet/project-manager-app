---
type: checklist
feature: "Programa de convergencia de producción F3-F9"
spec: "docs/specs/platform/production-convergence-program.spec.md"
version: "2.0"
date: "2026-07-31"
---

# Checklist: Programa de convergencia de producción F3-F9

- [x] Producción y Git comparados por SHA
- [x] Drift F3 identificado sin mutación
- [x] WIP separado de `main`
- [x] Plantillas y estados SDD unificados
- [~] Cada child entregado cabe en un PR reversible
- [x] Ningún child iniciado avanzó sin spec aprobado
- [~] Migraciones y flags tienen inventario/evidencia por child entregado
- [x] Activación F3 se verificó separada del deploy/health
- [x] F3 cerró rebuild, consumo automático, duplicado y replay en canary
- [x] `VERIFIED + CANARY` está acotado a `tenant_default`, no a rollout global
- [~] Matriz/roadmap/index actualizados para cada gate entregado
