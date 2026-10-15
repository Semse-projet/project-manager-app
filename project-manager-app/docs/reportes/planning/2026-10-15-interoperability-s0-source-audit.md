# S0 — Auditoría focalizada de código y contrato MCP read-only (2026-10-15)

**Objeto:** evidenciar reutilización antes de escribir `SEMSE MCP Server`.
**Estado:** SOURCE_INSPECTED / RUNTIME_UNVERIFIED. Documentación, no cambio funcional. Ref: `platform.semse-prometeo-interoperability` (PR #939, REVIEW).

## 1. Ruta de lectura de proyecto: existente, no nueva

- `apps/api/src/modules/projects/projects.controller.ts`: `@Controller("v1/projects")`, `@Get(":projectId")`, `@RequirePermissions("projects:read")`; deriva contexto con `resolveRequestContext(req)` y delega en `ProjectsService.detail`.
- `apps/api/src/modules/projects/projects.service.ts`: `detail` delega en `ProjectsRepository.findById`; no implementa segundo Business Kernel.
- `apps/api/src/modules/projects/projects.repository.ts`: `findById` consulta `tenantId` + `projectId` y excluye Job borrado mediante `job.deletedAt: null`; usa `assertProjectReadable` y un ownership derivado de `project.job.clientOrgId` / `project.assignedProOrgId`.
- `apps/api/src/modules/projects/projects.policy.ts` + `apps/api/src/common/resource-scope.ts`: org cliente o PRO asignada pueden leer; OPS_ADMIN solo dentro del tenant. Un rol/permiso global NO concede acceso automáticamente a otra organización.

## 2. Contrato de respuesta realmente implementado

`ProjectsRepository.toRecord` transforma `Project` a:
```ts
{ id: string; tenantId: string; jobId: string; assignedProOrgId: string; status: string }
```

**Consecuencia:** `ProjectRecord` visible en esta ruta NO incluye `name`, `title` ni `summary`. La tool `semse.project.get_summary.v1` descrita inicialmente en la spec paraguas es un nombre/forma *propuesta*, no comprobada. Para MVP la proyección mínima debe ser `projectId, jobId, status` y quizá `sourceRef, correlationId` desde contexto seguro, **sin exponer** tenant, org, PII o campos financieros. Si se desea título, se requiere child spec que resuelva el Job por servicio autorizado y pruebe su ownership, no incluir un título vacío/inventado.

## 3. Identidad y observaciones P0

- `apps/api/src/common/request-context.ts`: en producción sin `AUTH_SECRET` responde ServiceUnavailable (no habilita trust de headers); con secreto valida bearer, mientras `authContext` previamente adjunto puede tomar precedencia. Verificar procedencia/guard de `authContext` y token/session actual antes de exponer MCP públicamente.
- `apps/api/src/common/rbac.guard.ts` verifica metadatos de permisos y rol; el ownership se resuelve adicionalmente en Repository/Policy. Un gateway no puede sustituir esto por una API key de servicio compartida ni aceptar `x-tenant-id`, `x-org-id` y roles arbitrarios procedentes del cliente.
- `apps/api/src/infrastructure/persistence/actor-context.service.ts` hace upsert de entidades tenant/org/user en el camino `ensureActorContext`. **Riesgo de efectos secundarios en una llamada GET y necesidad de evaluar el vínculo membership:** no dar por sentado que es una lectura pura o prueba de membresía. Confirmar la autoridad de claims/cambios y prohibir al MCP crear identidad implícitamente.
- `projects.policy.ts` produce Forbidden para un proyecto visible por tenant pero ajeno por org, mientras `findStoredProjectOrThrow` produce NotFound para tenant incorrecto/objeto borrado. La proyección MCP debe evitar filtrar identificadores o existencia; concretar contrato de errores sin alterar silenciosamente el API existente.

## 4. Consecuencia técnica para S1

1. **NO crear** nueva ruta de negocio `GET /projects/summary` si el endpoint existente basta.
2. Cliente MCP `projectId` string con validación de longitud/formato real (IDs pueden no ser UUID); identidad se determina en el backend a partir de un login/token no falsificable.
3. `projects:read` + alcance de recurso y membership vigente + Policy gobiernan cada request. No se heredan privilegios de conexión y no se lee otra org dentro del mismo tenant.
4. Proyección de salida allowlisted y versión estable, sin campos financieros. Cambios de schema/permissions exigen nueva revisión de fingerprint.
5. Registrar invocación con actor, tenant, org, project, correlation y estado sanitizado; las auditorías de lectura pueden usar telemetría retenida según política, no necesariamente un AuditLog de alta cardinalidad.
6. Modo read-only estricto; ninguna operación de `POST/PATCH/DELETE` expuesta. Flags OFF y pruebas dos tenants/dos orgs antes de canary.

## 5. Estado de verificación

**Confirmado por lectura de código de `main` al 15-oct:** rutas, contrato actual y reglas indicadas.
**NO confirmado:** pertenencia efectiva de usuario autenticado para cada origen MCP, auditoría/runtime en Railway, configuración tokens, CI del futuro adaptador, pipeline de publicación MCP o compatibilidad de hosts.

## 6. Próximo corte

Preparar child spec `platform.semse-mcp-project-read` estado REVIEW; reconciliar con arquitectura ADR-025 (la decisión C aplaza *consumo externo de MCP por Prometeo*, no autoriza automáticamente un MCP Server). Validar security review de tokens/OAuth/session binding. Sin autorización SDD y pruebas no se implementa.
