# AGENTS.md — entrada de instrucciones para agentes SEMSE

Este repositorio contiene el monorepo activo en `project-manager-app/` y también archivos operativos en la raíz externa (por ejemplo `.github/workflows/`).

**Antes de modificar cualquier ruta del checkout**, leer `project-manager-app/AGENTS.md`, `project-manager-app/.specify/memory/constitution.md` y el contrato/skill que corresponda al trabajo. Esas fuentes son canónicas; este archivo es un **puntero de descubrimiento**, no una constitución nueva ni una duplicación de reglas.

Para PRs, GitHub Actions, facturación o automatizaciones:
- Leer `project-manager-app/.claude/skills/semse-github-operations-cost-guard/SKILL.md` y `project-manager-app/.claude/skills/semse-ci-pr-workflow/SKILL.md` cuando apliquen; el control propuesto de costos es `SHOULD` y está sujeto a la decisión `DEC-CI-001` pendiente de aprobación humana.
- No disparar reintentos de workflows a ciegas ni aumentar presupuestos/pagos sin autorización; confirmar causas de `startup_failure` y distinguir `UNVERIFIED` de un fallo demostrado de tests.
- Conservar los checks, la seguridad, la validación de los PRs y el CI de `main`. En eventos `pull_request` el checkout puede probar una integración temporal de HEAD+base; registrar SHA/refs correctos. No confundir CI de PR con Railway Deploy y procedencia post-merge.
- Verificar ramas, diffs y revisiones concurrentes antes de editar. No sobrescribir trabajo de otros agentes, fusionar sin revisión requerida ni tocar producción por esta instrucción.

Esta instrucción solo cubre agentes que **realmente cargan** archivos del checkout. No demuestra lectura por agentes externos ni distribuye cambios a otros repositorios.
