# Reporte — 0.47: streams SSE sin metadata RBAC y stream de agentes público

**Fecha:** 2026-10-23 · **Hallazgo:** [`AUDIT_REMEDIATION_PLAN.md` 0.47](../AUDIT_REMEDIATION_PLAN.md) · **Rama:** `fix/sse-rbac-metadata-and-project-scope` · **PR:** pendiente

Estado por capa, sin inferir una de otra:

| SPEC | CODE | TEST local | CI | MERGE | DEPLOY | ACTIVATION | UAT |
|---|---|---|---|---|---|---|---|
| N/A (remediación de backlog) | COMPLETE | PASS dirigido (12 fallos de entorno preexistentes en la suite) | PENDIENTE | NO | NO | NO | NO |

## Contexto

Re-verificación del reporte de auditoría de UI/UX y backend del 2026-07-20 contra `main` (`06dfd7b`). Los puntos que ese reporte marcaba como prioritarios (0a/0b, 1, 1b, 1c → ítems 0.1, 0.2, 0.4–0.7, 0.18, 0.21) **ya estaban corregidos en código**; se comprobó cada uno leyendo el código actual, no solo el estado del plan. Al revisar el controller SSE apareció 0.47.

## Hallazgo

1. `planStream`, `delegationsStream`, `contextStream` y `missionControlStream` no tenían `@Public()` ni `@RequirePermissions`. El `RbacGuard` global (deny-by-default) los rechazaba con `403 "RBAC metadata required"` para cualquier rol. Confirmado ejecutando el guard real sobre los handlers compilados: OPS_ADMIN también recibía 403. Los proxies BFF lo enmascaraban como "runtime disabled".
2. `agentsStream` seguía `@Public()` y emitía el bus `agents:system` de todos los tenants (`projectId`, eventos, mensajes de error crudos).
3. Los streams 1 solo comprobaban tenant: añadirles el permiso sin más habría reabierto el acceso entre organizaciones del mismo tenant (0.37).

## Cambios

- `apps/api/src/infrastructure/sse/sse.controller.ts` — permiso por stream igual al de su gemelo REST; `ProjectAccessService` antes de abrir cualquier canal push; filtro de `projectId`/`userId` en `contextStream`; `agentsStream` → `ops:dashboard:read`.
- `apps/api/src/modules/agents/agents.module.ts` — exporta `ProjectAccessService`.
- 6 proxies BFF de streams autenticados (`sse/agents`, `sse/buildops`, `finance/stream`, `agents/plans/[planId]/stream`, `agents/delegations/stream`, `cortex/context/stream`) — `getServerConfig` → `getAuthenticatedServerConfig`.
- Tests: nuevo `apps/api/test/sse-rbac-and-project-scope.test.ts`; actualizado `sse-tenant-context.test.ts` (ya no afirma que `agentsStream` es público).

## Verificación

- Tests SSE (4 archivos): 48/48 PASS.
- Control negativo: el test nuevo contra el código anterior → 10/12 FAIL (los 2 que pasan cubren comportamiento que se conserva).
- Suite unitaria API: 3591 pass / 12 fail / 38 skipped. Los 12 fallos son idénticos en `main` sin estos cambios: el entorno del agente no puede descargar el motor de Prisma (`binaries.prisma.sh` 403) ni resolver DNS de las URLs de prueba de webhooks (validación SSRF).
- `tsc --noEmit` limpio en `apps/api` y `apps/web`; `pnpm lint` 0 errores (warnings preexistentes).
- `pnpm typecheck` del workspace no se pudo correr completo porque re-ejecuta `prisma generate` (misma limitación de red); se usó `tsc` por paquete.

## No verificado / pendiente

- **En vivo:** `/admin/agents` y Mission Control como OPS_ADMIN; plan del copiloto como PRO participante y como PRO de otra org; `GET /v1/sse/agents` sin token debe dar 401/403.
- **Exposición previa (b):** sin logging suficiente para saber si alguien consumió `/v1/sse/agents` sin autenticar.
- **Comportamiento visible:** los streams de planes, contexto, delegaciones y Mission Control empiezan a emitir datos donde antes no emitían nada; las pantallas que los consumen pueden mostrar actualizaciones en vivo por primera vez.
