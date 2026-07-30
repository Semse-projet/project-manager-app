---
type: tasks
feature: "Programa de convergencia de producción F3-F9"
domain: "platform"
plan: "docs/specs/platform/production-convergence-program.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "main"
date: "2026-07-30"
---

# Tareas: Programa de convergencia de producción F3-F9

## Gobierno

- [x] [T-001] Sincronizar Git, Railway, servicios y SHA desplegado
- [x] [T-002] Auditar migración/tabla F3 sin abrir PostgreSQL públicamente
- [x] [T-003] Recuperar SQL/WIP desde Git sin aplicarlo completo
- [x] [T-004] Alinear constitución, gobernanza y templates SDD 2.0
- [x] [T-005] Separar code/CI/merge/deploy/activation en tooling
- [x] [T-006] Regenerar índice y matriz

## Child slices

- [~] [T-100] F3 — canary durable activo; cierre event/replay pendiente
- [ ] [T-200] F4 — crear spec después del gate F3
- [ ] [T-300] F5 — crear spec después del gate F4
- [ ] [T-400] F6 — crear spec después del gate F5
- [ ] [T-500] F7 — crear spec después del gate F6
- [ ] [T-600] F8 — crear specs por vertical después del gate F7
- [ ] [T-700] F9 — hardening y cierre operacional

## Regla de avance

No marcar un child completo por tener código o deployment. Exigir metadata SDD
2.0, evidencia y criterio de salida del roadmap.
