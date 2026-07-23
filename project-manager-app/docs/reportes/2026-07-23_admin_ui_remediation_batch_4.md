# Reporte: Remediación UI Admin — Batch 4 (QualityGuard action affordance, 3.4)

**Fecha:** 2026-07-23
**Sesión:** https://app.devin.ai/sessions/ba935c8a8ed74204b9749846a3602aa6
**Rama:** `devin/1784815344-admin-remediation-qualityguard`
**PR:** nuevo PR contra `main`
**Solicitante:** @Samuelcastella

## Qué se hizo

Se atendió el hallazgo **3.4** del plan de remediación (`docs/AUDIT_REMEDIATION_PLAN.md`, Sección 3): en `/admin/labor-engine` las alertas QualityGuard eran de solo lectura, sin ninguna acción contextual. Se implementaron botones de acción y los endpoints admin necesarios para pausar/detener timers olvidados, sin tocar dinero, auth ni cross-tenant data.

## Hallazgos corregidos

| Ítem | Archivo(s) | Fix |
|---|---|---|
| **3.4** MEDIO | `apps/web/app/(app)/admin/labor-engine/page.tsx` | Cada alerta QualityGuard muestra un link "Ver perfil" a `/admin/users/{workerId}`. Para alertas `stale_timer` con `entryId` se muestran botones "Pausar" y "Detener" con `window.confirm`. Los errores se muestran en un banner rojo (`actionError`) y el overview se recarga tras una acción exitosa. |
| **3.4** MEDIO | `apps/api/src/modules/labor-engine/labor-engine.repository.ts` | Se añadieron `adminPauseTimeEntry` y `adminStopTimeEntry` (búsqueda por `id` + `tenantId`, sin filtrar por `createdBy`) y se extrajo la lógica común a métodos internos privados para evitar duplicación. |
| **3.4** MEDIO | `apps/api/src/modules/labor-engine/labor-engine.service.ts` | Se añadieron `adminPauseTimer` y `adminStopTimer`. |
| **3.4** MEDIO | `apps/api/src/modules/labor-engine/labor-engine.controller.ts` | Se añadieron `POST/PATCH v1/labor/admin/timer/:id/pause` y `v1/labor/admin/timer/:id/stop`, ambos protegidos con `@RequirePermissions("ops:dashboard:write")`. |
| **3.4** MEDIO | `apps/web/app/api/semse/labor/admin/timer/[id]/pause/route.ts`, `stop/route.ts` | BFF routes que reenvían las llamadas admin al backend con autenticación de sesión. |

## Validación

- `pnpm lint` — 0 errores, 54 warnings preexistentes.
- `pnpm typecheck` — pasa.
- `pnpm build:api` — pasa.
- `pnpm test:unit` — 944 pass / 0 fail.
- `pnpm spec:validate:strict` — 0 errores, 0 warnings.

## Notas y próximos pasos

- Quedan pendientes los ítems de mayor tamaño o que requieren sign-off: 3.5 (IDs/paginación), 3.6 (ModuleShell), 3.40 (`/admin/settings` sin persistencia) y los de dinero/auth/cross-tenant (3.7, 3.8, 3.9, 3.10–3.15, etc.).
- Verificación en vivo con credencial `OPS_ADMIN` para confirmar que los botones pausan/detienen timers reales.
- No se modificó `packages/db/prisma/schema.prisma`.
- No se expusieron secretos ni credenciales.
