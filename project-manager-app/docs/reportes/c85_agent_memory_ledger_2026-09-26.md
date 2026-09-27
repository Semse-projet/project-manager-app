# Ledger C85 — Agent Memory Governance

**Fecha:** 2026-09-26
**Rama:** `feat/c85-agent-memory`
**Worktree:** `Desktop/c85-agent-memory-wt` (worktree separado de `Desktop/project-manager-app`, que tenía trabajo local ajeno sin commitear en otra rama y no debía tocarse)

## Capability ID / name

C85 — Agent Memory (governance layer sobre memoria de agentes ya existente)

## Baseline SHA

`origin/main` @ `4513d817f64c9a5500a167d6e691140b8acb6061` (2026-09-26, "docs(spec): approve prometeo.jev-human-review-queue + plan/tasks (#687)")

El traspaso original de C85 citaba un baseline `9ac2924…` y una rama local
`codex/c85-agent-memory` (commits `8f3cb0ad`, `4f585bbc`, `97e42e28`). Se buscó
esa rama y esos commits en todos los checkouts accesibles en esta máquina
(`Desktop/project-manager-app` + sus 4 worktrees reales, `Documents/project-manager-app`,
`Documents/semse-reconciliacion-review`) — **no existen en ningún lado**. Por
instrucción explícita ("no reconstruir a ciegas"), C85 no se recuperó: se
implementó desde cero contra el `main` actual, tratado como un trabajo nuevo,
no como una restauración de aquel código perdido.

## Estado inicial

`AgentMemory` y `WorkspaceMemoryEntry` existían y funcionaban (creación,
búsqueda FTS, inyección de contexto, decay, dedup) pero sin ningún campo de
gobernanza: sin sensibilidad, sin procedencia, sin distinción entre hecho
verificado e inferencia, sin forma de corregir/invalidar/marcar conflictos
sin destruir historia, y sin disclaimer explícito de que la memoria no es
verdad canónica. `docs/CANONICAL_STATE_REGISTRY.md` no tenía fila de C85
(no auditado todavía).

## Evidencia encontrada

- `apps/api/src/modules/knowledge/agent-memory.service.ts` / `.repository.ts`,
  `workspace-memory.repository.ts`, `packages/knowledge/src/workspace/model.ts`.
- Consumido por `plan-mode.service.ts` (sólo escritura) y
  `project-copilot.harness.ts` (lectura vía `injectRelevantContext`, inyectada
  como contexto de prompt — nunca usada para autorizar una acción
  directamente; la ejecución de acciones pasa por gates separados en
  `packages/agents`).
- 15 dominios adicionales (`payments`, `milestones`, `jobs`, `disputes`,
  `autonomy`, `agents`, `users`, `projects`, …) ya llamaban
  `WorkspaceMemoryRepository.append()` directamente — cualquier cambio de
  contrato ahí tenía blast radius real, confirmado antes de tocar el tipo.
- Rama `devin/1784471884-prometeo-memory-persistence` existe en remoto —
  revisada por nombre, no relacionada con C85 (persistencia de estado de
  sesión de Prometeo, dominio distinto).

## Gaps identificados

Sin scopes de sensibilidad, sin provenance, sin distinción epistémica
(remembered_context/inference/verified_fact), sin corrección/invalidación/
supersesión no destructivas, sin detección de conflictos, sin retención, sin
auditoría de mutaciones de gobernanza, sin disclaimer "memoria ≠ verdad
canónica" en el contexto inyectado a los prompts.

## Cambios realizados

- **Schema (`packages/db/prisma/schema.prisma`):** 15 columnas + 3 índices
  nuevos en `AgentMemory` y en `WorkspaceMemoryEntry` (sensitivity,
  epistemicStatus, confidence, provenance, subjectType/subjectId, status,
  supersedesId, supersededById, correctedFromId, conflictsWith,
  invalidatedAt/By/Reason, retentionUntil). Aditivo puro.
- **Repositorios:** `correct()`, `invalidate()`, `supersede()`,
  `flagConflict()`, `getLineage()`, `findById()` en
  `AgentMemoryRepository` y `WorkspaceMemoryRepository`, todos
  tenant-scoped vía `updateMany({ where: { id, tenantId } })` +
  `NotFoundException` si no matchea. Filtrado por defecto de
  `status: "active"` y techo de `sensitivity` en toda ruta de lectura
  existente.
- **Servicio (`AgentMemoryService`):** `correctMemory`/`invalidateMemory`/
  `supersedeMemory`/`flagMemoryConflict`/`getMemoryLineage`, cada una
  auditada best-effort vía `AuditService` (constructor param opcional para
  no romper los tests existentes ni requerir cambios en `KnowledgeModule`).
  Disclaimer explícito (`MEMORY_DISCLAIMER`) en todo bloque de contexto
  formateado; indicador inline cuando `conflictsWith` no está vacío.
- **Controller (`KnowledgeController`):** 7 endpoints nuevos —
  `GET agent-memory`, `GET agent-memory/search`, `GET agent-memory/:id/lineage`
  (`knowledge:read`), `POST agent-memory/:id/{correct,invalidate,supersede,conflicts}`
  (`knowledge:manage`).
- **Docs:** `docs/specs/knowledge/agent-memory-governance.{spec,plan,tasks}.md`,
  `docs/SPEC_INDEX.md` regenerado, esta fila de ledger, fila en
  `docs/CANONICAL_STATE_REGISTRY.md`.

## Tests ejecutados / resultados

- `pnpm --filter @semse/api build` — limpio, sin errores.
- `pnpm build:packages` — limpio (incluye `@semse/knowledge` con los tipos nuevos).
- `pnpm typecheck` (api + web + worker + mobile, workspace completo) — limpio, sin errores.
- `node --experimental-strip-types --test apps/api/test/agent-memory.service.test.ts` — **34/34 PASS** (27 preexistentes intactos + 7 nuevos de gobernanza).
- `node --experimental-strip-types --test apps/api/test/agent-memory-governance-integration.test.ts` (contra Postgres real, local) — **7/7 PASS**, incluye ataque cross-tenant simulado contra `correct`/`invalidate`/`supersede`/`flagConflict` (los 4 rechazados correctamente, registro del tenant legítimo verificado intacto después).
- `node --experimental-strip-types --test apps/api/test/knowledge.controller.test.ts` — **4/4 PASS** (1 preexistente + 3 nuevos).
- `npx eslint` dirigido sobre los 4 archivos de `apps/api/src` modificados — limpio, 0 findings.
- `pnpm spec:validate:strict` — **142 specs, 0 errores, 0 warnings**.
- `pnpm spec:index` — regenerado, 142 specs indexados.
- `pnpm --filter @semse/db exec prisma validate` — schema válido.
- `pnpm verify:modules` / `audit:prisma-usage` / `check:toolchain` / `check:dockerfiles` (los 4 chequeos estáticos de `verify:workspace`) — corridos individualmente, los 4 limpios.
- `pnpm --filter @semse/api test:unit` (**suite completa del API, no sólo los archivos de C85**) — **2504 tests, 2503 PASS, 0 FAIL, 1 SKIPPED** (312.9s). Mejor resultado que el reportado por el traspaso de C85 previo (2451 PASS / 8 FAIL / 37 SKIP) — los 8 FAIL de SAT-007 que aquel reportó por DNS del entorno no reaparecieron aquí.
- `pnpm verify:workspace` completo (`verify:modules` + `audit:prisma-usage` + `check:toolchain` + `check:dockerfiles` + `railway:preflight` [`validate:workspace` + rebuild completo de packages/apps incl. `apps/web` + `typecheck:all`] + `pnpm --filter @semse/api test:unit`) — **terminó limpio, exit code 0** (~24 min, confirmado después de abrir el PR). Gate local completo verde.

## Migraciones

`packages/db/prisma/migrations/20260926130946_c85_agent_memory_governance/migration.sql`
— generada por `prisma migrate dev` (no escrita a mano), sólo `ADD COLUMN`/
`CREATE INDEX`, **aplicada y verificada contra Postgres 16 local**
(`infra/docker/compose.semse-mvp.yml`, junto con las 8 migraciones previas
que tampoco estaban aplicadas en esa base nueva — las 9 aplicaron limpio, sin
conflictos ni resolución manual). **No aplicada a Railway/producción.**

## Riesgos / deuda restante

- `sensitivity` existe pero ningún caller real (Plan Mode, project-copilot)
  pasa todavía un `maxSensitivity` derivado del RBAC del usuario — el techo
  por defecto (`"internal"`) preserva el comportamiento actual, pero no hay
  enforcement nuevo. Bloquear antes de permitir contenido `confidential` en
  el sistema.
- `correct()` concurrente sobre el mismo original no está serializado —
  riesgo bajo (memoria duplicada, no pérdida de datos), documentado, no
  resuelto.
- Sin BFF ni UI — sólo API. Sin actualización de
  `docs/architecture/SEMSE_API_SURFACE_V1.md` con los 7 endpoints nuevos.
- Job de retención (`retentionUntil`) no escrito — el campo existe, nada lo
  consume todavía.
- Migración no aplicada a Railway.

## Commit / PR

Commit local `5b319d9d` (rama `feat/c85-agent-memory`, sobre
`origin/main@4513d817`) más los cambios de esta sesión (controller,
specs, canonical registry, este ledger) pendientes de un segundo commit.
**PR: no abierto todavía** — pendiente de push.

## Deployment Railway

No aplica — no desplegado.

## Verificación producción

No aplica — no desplegado, no verificado.

## Estado final

**C85 — parcial, no VERIFIED.** Código, migración y tests reales y verdes en
local; nada mergeado, nada en CI, nada en producción. No iniciar C86 hasta
completar: push, PR, CI verde, merge, `pnpm db:migrate` contra Railway,
smoke autenticado multi-tenant, y sólo entonces subir `status` del spec a
`VERIFIED` con `production_evidence` real.
