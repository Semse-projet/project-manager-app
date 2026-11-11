---
type: tasks
feature: "library-hub-override-compatibility"
domain: "platform"
plan: "docs/specs/platform/library-hub-override-compatibility.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "chore/library-hub-dependency-compat-20261025"
date: "2026-10-25"
---

# Tareas
- [x] [T-001] Investigar pin Express 4 y declaraciones `esbuild`/`postcss`/`vite` reales.
- [x] [T-002] Elaborar SDD de verificación separada y reversión.
- [x] [T-003] Crear workflow path-filtered y `workflow_dispatch` sin Railway.
- [ ] [T-004] Ejecutar `check:assistant-portal` real con CI.
- [ ] [T-005] Ejecutar `build:assistant-portal` real con CI.
- [ ] [T-006] Revisar contra el CI general y registrar duración.
- [ ] [T-007] Revisión técnica independiente sobre pins fuera de rango y escaneo de CVE al seleccionar reemplazo.
- [ ] [T-008] Último gate: índice y SDD estrictos, CI y pruebas. PR sigue DRAFT sin merge.
