# Admin RBAC — Permisos dedicados para Prometeo RAG y Coordinator (3.14 y 3.15)

**Fecha:** 2026-07-23  
**Rama:** `devin/1784900000-admin-rbac-permissions`  
**Items del AUDIT_REMEDIATION_PLAN.md:** 3.14 y 3.15 (ALTO — seguridad/permisos)

## Resumen

Se cerraron dos brechas de control de acceso en Admin:

- **3.14:** `POST /v1/prometeo/ingest`, `/ingest-file` y `DELETE /v1/prometeo/documents/:id` usaban `agents:run:create`, un permiso que comparten CLIENT/PRO/WORKER/OPS_ADMIN, permitiendo a cualquier rol autenticado mutar la base documental RAG. Ahora requieren `knowledge:manage`.
- **3.15:** `GET /v1/agents/delegations`, `/delegations/:id` y `/coordinator/snapshot` usaban `agents:run:create`, de modo que un CLIENT/PRO/WORKER podía llamar la API directa y obtener el feed tenant-wide del Coordinator. Ahora requieren `ops:coordinator:read`.

Ambos permisos son OPS_ADMIN-only en `packages/auth/src/rbac.ts`.

## Cambios

- `packages/auth/src/rbac.ts` — agrega `knowledge:manage` y `ops:coordinator:read` al rol `OPS_ADMIN`.
- `apps/api/src/modules/prometeo/prometeo.controller.ts` — `POST /ingest`, `POST /ingest-file` y `DELETE /documents/:id` ahora usan `@RequirePermissions("knowledge:manage")`.
- `apps/api/src/modules/agents/agents.controller.ts` — `GET /delegations`, `GET /delegations/:id` y `GET /coordinator/snapshot` ahora usan `@RequirePermissions("ops:coordinator:read")`.
- `docs/AUDIT_REMEDIATION_PLAN.md` — items 3.14 y 3.15 marcados `[x]`.
- `docs/specs/ui/admin-flows-remediation.spec.md` — checklist actualizado.

## Notas

- Las operaciones de lectura de Prometeo (`search`, `rag-context`, `rag-query`, `trade-guide`, `listTools`, `invokeTool`, `documents`, `trade-library`, `listAssets`, etc.) siguen con `agents:run:create` para que CLIENT/PRO/WORKER las consuman normalmente.
- No se agregó nuevo middleware en las BFF routes; el gate ahora vive en el API, consistente con el patrón del resto del backend.
- Queda pendiente verificación en vivo con credenciales OPS_ADMIN y un rol no-admin para confirmar 403 en las rutas mutadoras/sensibles.

## Validación local

- `pnpm lint` — 0 errores (warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores
