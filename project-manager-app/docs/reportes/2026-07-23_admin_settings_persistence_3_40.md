# Admin Settings Persistence — Ítem 3.40

**Fecha:** 2026-07-23  
**Rama:** `devin/1784900000-admin-settings-persistence`  
**Items del AUDIT_REMEDIATION_PLAN.md:** 3.40 (CRÍTICO — UX honesta)

## Resumen

Se corrigió la persistencia de `/admin/settings`: antes todos los controles eran puro `useState` local, incluyendo el toggle de MFA que prometía "Requiere TOTP al iniciar sesión como administrador" sin guardar nada. Ahora los ajustes se almacenan en `TenantSettings` por tenant, se exponen a través de `GET/PUT /v1/admin/settings` y se consume vía BFF; la UI carga valores reales, guarda con debounce y muestra errores. Los toggles cuyo efecto depende de configuración del servidor (MFA, session log, OpenAI/GitHub) ahora incluyen texto honesto al respecto.

## Cambios

- `packages/db/prisma/schema.prisma` — nuevo modelo `TenantSettings` (1:1 con `Tenant`, `settingsJson` JSON).
- `packages/db/prisma/migrations/20260723000000_tenant_settings/migration.sql` — migración manual (sin `DATABASE_URL` real en este entorno se validó con `prisma validate` y `prisma generate`).
- `packages/schemas/src/admin-settings.schema.ts` — Zod schema con defaults para `language`, `timezone`, `notifications`, `security`, `integrations`.
- `apps/api/src/modules/admin/admin.controller.ts` — endpoints `GET /v1/admin/settings` (`ops:dashboard:read`) y `PUT /v1/admin/settings` (`ops:dashboard:write`).
- `apps/api/src/modules/admin/admin.service.ts` — `getSettings` / `updateSettings` con `upsert`, validación Zod y escritura en `AuditLog` (`tenant.settings.updated`).
- `apps/api/src/modules/admin/admin.module.ts` — nuevo módulo, importado en `apps/api/src/app.module.ts`.
- `apps/web/app/api/semse/admin/settings/route.ts` — BFF `GET` y `PUT` hacia el API.
- `apps/web/app/semse-api.ts` — `fetchAdminSettings` y `updateAdminSettings`.
- `apps/web/app/(app)/admin/settings/page.tsx` — carga real, guardado con debounce, indicadores de carga/guardado/errores, y textos honestos para toggles cuyo enforcement depende del servidor.
- `docs/AUDIT_REMEDIATION_PLAN.md` — ítem 3.40 marcado `[x]`.
- `docs/specs/ui/admin-flows-remediation.spec.md` — checklist actualizado.

## Validación local

- `pnpm lint` — 0 errores (warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Verificación en vivo con credencial `OPS_ADMIN` (guardar/Recargar y confirmar que el `TenantSettings` se crea y lee correctamente).
- Conectar el campo `mfaRequired` al flujo real de autenticación cuando el equipo de producto decida implementar TOTP enforcement.
