# C51 — WorkspaceMemoryAccessPolicy (memoria compartida del workspace)

Fecha: 2026-10-01 · Rama: `claude/c51-workspace-memory` · Estado C51: **PARTIAL** hasta el smoke autenticado multi-tenant/multi-org.

## Decisión del dueño aplicada
Spec: `docs/specs/platform/resource-scope.spec.md` §3.1. `WorkspaceMemory` es memoria compartida del workspace/recurso; boundary = tenant + `ProjectScope`; `orgId` es provenance, no ACL; `sensitivity` no sustituye ownership; la memoria nunca autoriza una acción.

## Hallazgos corregidos
1. `GET /v1/knowledge/workspace-memory` y `/search` aceptaban un `workspaceId` y filtraban solo por tenant: cualquier usuario con `knowledge:read` podía leer la memoria de cualquier proyecto/job/disputa de su tenant adivinando el id. Ahora la política corre antes del repositorio (404 otro tenant/inexistente, 403 fuera de las orgs participantes).
2. `query()` filtraba por `orgId` y `search()` no: dos memorias parciales dentro del mismo proyecto (y `injectRelevantContext` mezclaba ambos). `query()` ya no filtra por `orgId`; los llamadores internos (ops, copilot, agent-memory) dejaron de pasarlo.
3. `queryAcrossTenant()` no verificaba nada: ahora exige `OPS_ADMIN` del mismo tenant y falla cerrado (único llamador: cola de verificación, que ya exigía `users:verify`).
4. Mismo hueco en `agent-memory` (list/search por `projectId`, lineage por id): ahora usan la misma política.

## Alcance de la política
`project:<id>` y `job:<id>`/`dispute:<id>` ⇒ `ProjectScope` (cliente, profesional asignado u OPS_ADMIN); `worker:<userId>:*` ⇒ el propio usuario u OPS_ADMIN; forma desconocida ⇒ solo OPS_ADMIN (deny-by-default). Sin cambios de esquema, migración, flags ni CI.

## Pruebas
`apps/api/test/workspace-memory-access.test.ts` (13): otro tenant 404 (incluido OPS_ADMIN), otra org 403, cliente lee memoria producida por la org profesional y viceversa, org vacía nunca concede, adivinar/malformar el `workspaceId` no basta, controller no llama al servicio si se deniega, `orgId` no viaja como filtro, `queryAcrossTenant` solo OPS_ADMIN del tenant, agent-memory con la misma regla.
Suite API 2741 tests, 0 fallos, 38 omitidos; `typecheck` limpio; lint 0 errores (2 warnings previos); `spec:validate:strict` 0 errores.

## Pendiente (no se afirma aquí)
Despliegue y smoke autenticado multi-tenant/multi-org; hasta entonces C51 sigue PARTIAL. Residual: `injectRelevantContext`/copilot reciben `projectId` de su llamador y no re-autorizan el proyecto aquí; se cubre en la etapa 3 (resolver único + guarda).
