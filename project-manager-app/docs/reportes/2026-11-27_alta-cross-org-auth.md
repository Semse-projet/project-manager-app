# 2026-11-27 — Hallazgos Alta de autorización y sesión

Remediación de los hallazgos Alta de las auditorías de IDOR cross-org y de la auditoría general. No se fusionó ni se desplegó.

## Checklist

- Misiones Prometeo: usan `ProjectAccessService.assertPlanAccess` / `assertProjectAccess`.
- `GET /v1/users`: solo miembros de la org de la sesión; `riskLevel` y `flags` solo para OPS_ADMIN.
- `GET /v1/intelligence/archives`: org cliente, org profesional del archivo, o proyectos accesibles. OPS ve el tenant.
- `GET /v1/payments/diagnostics`: hitos de proyectos accesibles; OPS ve el tenant. Señales críticas acotadas al hito o al proyecto.
- Field-ops units/worklogs: acceso al proyecto. Vendors con `orgId`. Aprobar compliance solo CLIENT de esa org u OPS.
- `UPLOADS_SIGNED_GET_MODE` default `enforce`. En producción la API no arranca sin `UPLOADS_SIGNING_SECRET` ≥16 salvo `off` explícito.
- `next` 15.5.29 en `apps/web`, lockfile actualizado.
- Secreto de sesión web sin fallback público; mínimo 32 caracteres. Demo `*@demo.semse` solo con `NODE_ENV=development|test` y `SEMSE_ALLOW_DEV_SESSION=true`.

## No hecho

- Facts de field-ops siguen siendo del tenant. No tienen org; atarlos a un worklog opcional es una decisión de producto.
- `GET` de uploads con sesión sigue aceptando cualquier org del mismo tenant si la clave empieza por `tenants/{tenantId}/`. La clave no guarda org.

## Evidencia

- `pnpm build:api` OK.
- `pnpm --filter @semse/api lint` y `pnpm --filter @semse/web lint`: 0 errores (warnings previos).
- `tsc --noEmit` en `@semse/web` OK. El build de la API cubre su typecheck.
- Suite unitaria de la API: 4162 tests, 0 fallos.
- `tests/unit/web-session-secret.test.ts` y `tests/unit/demo-login.test.ts` OK.

## Deploy

- API en producción: `UPLOADS_SIGNING_SECRET` ≥16 antes de desplegar, o `UPLOADS_SIGNED_GET_MODE=off` (inseguro) para rollback.
- Web: `AUTH_SECRET` o `SEMSE_WEB_SESSION_SECRET` ≥32. No activar `SEMSE_ALLOW_DEV_SESSION` ni `NEXT_PUBLIC_SEMSE_ALLOW_DEV_SESSION` fuera de local.
- Migración `20261127180000_vendor_org_scope`: `Vendor.orgId` nullable. Filas viejas solo las ve OPS hasta asignarles org.
