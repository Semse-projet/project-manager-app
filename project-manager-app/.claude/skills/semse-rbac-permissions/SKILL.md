---
name: semse-rbac-permissions
description: The real role→permission map in packages/auth/src/rbac.ts, how @RequirePermissions gates API endpoints, the dev header-auth shortcut, and the RC3 bug pattern (missing permission blocks a whole feature). Use before adding a new endpoint, gating a feature by role, or debugging a 403/permission error for PRO/WORKER/CLIENT.
---

# SEMSE RBAC — roles, permissions, and the RC3 bug pattern

## Source of truth

`packages/auth/src/rbac.ts` — nowhere else. Two exports matter:

- `rolePermissions: Record<string, string[]>` — the real roles are `CLIENT`, `PRO`, `WORKER`, `EVENT_CONSUMER`, `OPS_ADMIN`, `DEMO_AGRO` (the last one is an intentionally narrow sandbox role — its own comment in the file warns "depende de que este set nunca crezca hacia jobs/payments/matching," don't add to it casually).
- `roleAliases: Record<string, string>` — maps a **display/legacy name to the canonical role it resolves to**, not the other way around: `ADMIN → OPS_ADMIN`, `FIELD_WORKER → WORKER`, `PROFESSIONAL → PRO`. If you see one of the alias names in a header, JWT claim, or test fixture, resolve it through this map before comparing against `rolePermissions` keys.

`RBAC_DEFAULT_POLICY = "deny_by_default"` — a role with no matching permission entry (and no alias) gets nothing. There is no implicit admin-can-do-everything fallback.

## Gating an endpoint

`apps/api/src/common/permissions.decorator.ts` exports `RequirePermissions(...permissions: string[])`. Apply it per-route:

```ts
@Post("message")
@RequirePermissions("agents:run:create")
async message(@Req() req: FastifyRequest, @Body() body: unknown) { ... }
```

The permission string itself is free text matched against the arrays in `rolePermissions` — there's no enum or generated type, so a typo silently blocks everyone rather than failing a type check. Before adding a new permission string, grep `rolePermissions` for something close to it; this codebase already has ~150 permission strings and a near-duplicate is more likely than a genuinely new need.

## The dev header-auth shortcut

When `AUTH_SECRET` is unset, the API accepts identity straight from headers instead of a Bearer token: `x-tenant-id`, `x-org-id`, `x-user-id`, `x-roles`. This is how local `curl` verification works without minting a real JWT (see `resolveLocalDevRuntimeConfig()` in `apps/web/app/api/semse/_server.ts` for the BFF-side equivalent — it falls back to `SEMSE_TENANT_ID`/`SEMSE_ORG_ID`/`SEMSE_USER_ID`/`SEMSE_ROLES` env vars, defaulting to `OPS_ADMIN`, when `NODE_ENV !== "production"`). **Never rely on this path meaning anything about production auth** — it is explicitly a local/dev convenience, and header spoofing without it is exactly finding `0.1` in the audit backlog (confirmed exploitable without `AUTH_SECRET` set).

## RC3 — the recurring bug shape

The single most common root cause across the whole `docs/AUDIT_REMEDIATION_PLAN.md` RBAC-adjacent findings: **a permission that should exist for `PRO`/`WORKER` is either missing entirely or only granted to `OPS_ADMIN`**, silently blocking an entire feature for the roles that actually need it (agent chat needed `agents:run:create` for `WORKER`; travel needed a `jobs:create`-equivalent; `users:verify` was wrongly admin-only when PRO needed a *request*-verification affordance, not the admin action itself).

**Before assuming a fix should grant a new permission, always check `rolePermissions` for the real current array of the affected role first** — the bug is sometimes "permission exists but for the wrong role," not "permission doesn't exist yet."

## Notas para futuros agentes / hallazgos abiertos

- No hay un export centralizado de permission-string constants (algo como `PERMISSIONS.AGENTS_RUN_CREATE`) — todo es string literal repetido entre el decorator y `rbac.ts`. Un typo no rompe el build, solo bloquea el feature en silencio. Si el volumen de permisos sigue creciendo, valdría la pena proponerlo como mejora — no se hizo acá porque toca decenas de call-sites y no había un bug puntual pidiéndolo.
- `DEMO_AGRO` es el único rol con un comentario de advertencia explícito en el código sobre no ampliarlo — vale la pena tratarlo como una señal real, no solo un comentario viejo.
- Esta skill no cubre el flujo de emisión/verificación de JWT en sí (`auth.service.ts`) ni la política de revocación de sesión (hallazgo `0.3`, explícitamente diferido — ver nota de decisión de usuario en `AUDIT_REMEDIATION_PLAN.md` línea ~54: reimplementar verificación de sesión en BD causó timeouts de 15s en Railway y fue revertido a propósito). Si alguien toca `auth.service.ts` para revocación, leer esa nota primero.
