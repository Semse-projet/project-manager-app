# Corrección de KIT-F3-01: cuatro streams SSE sin metadata RBAC

**Fecha:** 2026-10-21 · **Rama:** `claude/fix-sse-rbac-streams` (desde `main` @ `06dfd7b`) · **Aprobación:** propuesta de permisos aprobada por el responsable en la sesión (opción "Aplicar la propuesta") · **CI de GitHub:** bloqueado a nivel de cuenta; toda la evidencia es local.

## Resumen

`sse/mission-control`, `sse/delegations`, `sse/context` y `sse/plans/:planId` no declaraban metadata RBAC. El guard deny-by-default respondía 403 "RBAC metadata required" a todos los roles, OPS_ADMIN incluido, y sus pantallas no recibían nada en vivo: `/admin/mission-control`, `/admin/coordinator`, `/admin/semse-x` y el copiloto del cliente. El test de frontera RBAC no lo detectaba porque su lista de decoradores HTTP no incluía `Sse`.

| Stream | Permiso | Por qué |
|---|---|---|
| `mission-control` | `ops:dashboard:read` (OPS_ADMIN) | igual que `GET /v1/ops/mission-control/exceptions` |
| `delegations` | `ops:coordinator:read` (OPS_ADMIN) | igual que `GET /v1/agents/delegations` |
| `context` | `ops:dashboard:read` (OPS_ADMIN) | los eventos `context:${tenantId}:…` son de todo el tenant; el único consumidor es `/admin/semse-x` |
| `plans/:planId` | `agents:run:create` **+ `ProjectAccessService.assertPlanAccess`** | igual que `GET /v1/agents/plans/:planId`. Con sólo el permiso, un cliente de otra organización que conociera un `planId` habría recibido el plan y sus actualizaciones (IDOR) |

Sin acceso al plan, el stream se queda en keepalive (ni `plan-update` ni suscripción a `plan:${planId}`), el mismo patrón que ya usaban los demás streams ante una comprobación fallida. `ProjectAccessService` se exporta desde `AgentsModule` para inyectarlo en `SseController`.

## Checklist final

- ✅ `rbac-explicit-boundary.test.ts` audita también los handlers `@Sse`. Antes del arreglo fallaba exactamente con estos 4 (reproducido); ahora pasa.
- ✅ Test nuevo `apps/api/test/sse-stream-rbac.test.ts`:
  - permisos de cada stream;
  - el guard abre los streams OPS para OPS_ADMIN y los cierra para CLIENT, PRO y WORKER;
  - con un intruso de otra organización, `planStream` ejecuta la comprobación de acceso y no emite nada ni se suscribe;
  - el dueño recibe `plan-update` y el canal.
- ✅ Verificado en vivo contra la API.
- ✅ Sin cambios de esquema, de eventos ni de dependencias.

## Evidencia

| Comando / prueba (desde `project-manager-app/`) | Resultado |
|---|---|
| `node --experimental-strip-types --test apps/api/test/rbac-explicit-boundary.test.ts`, **antes** del arreglo | falla con `planStream`, `delegationsStream`, `contextStream` y `missionControlStream` |
| `node --experimental-strip-types --test apps/api/test/{sse-stream-rbac,rbac-explicit-boundary,sse-tenant-context,buildops-sse-org-scope,mission-control-2}.test.ts` | 52 pass, 0 fail |
| `pnpm --filter @semse/api test:unit` | 3629 tests: 3583 pass, 38 skipped, 8 fail. Los 8 son `SAT-007` (`satellite-webhooks-service.test.ts`) por "url failed SSRF validation": la validación necesita DNS real, que el sandbox no tiene, y ese archivo no cambia |
| `pnpm --filter @semse/api lint` / `tsc --noEmit -p tsconfig.json` | 0 errores (2 avisos que ya existían en `milestones.repository.ts` y `payments.repository.ts`) / sin errores |
| curl a la API local con tokens reales | OPS_ADMIN: **200** en los 4 streams (antes 403). Cliente: **403** "Insufficient permissions" en `mission-control`, `delegations` y `context`; en `plans` con un plan inexistente, 200 sólo con keepalive |

## Siguientes pasos

1. CI verde cuando se restablezca GitHub Actions, revisión de seguridad y merge.
2. En #1022: marcar KIT-F3-01 como corregido y quitar la entrada de `KNOWN_BFF_FAILURES` cuando se fusionen este PR y #1023.
3. Filtrar los eventos `context:${tenantId}:…` por organización antes de abrir ese stream a roles que no sean OPS.
