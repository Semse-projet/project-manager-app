---
id: "ui.demo-sandbox"
title: "Modo demo/sandbox sin registro — Agro primero"
domain: "ui"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
related_files:
  - apps/api/src/modules/demo/demo.module.ts
  - apps/api/src/modules/demo/demo.controller.ts
  - apps/api/src/modules/demo/demo.service.ts
  - apps/api/src/modules/demo/demo-seed.ts
  - apps/web/app/api/semse/demo/session/route.ts
  - apps/web/app/demo/agro/page.tsx
  - apps/web/app/agro/layout.tsx
  - apps/web/components/demo/demo-banner.tsx
  - apps/web/components/landing/hub-modules-grid.tsx
  - packages/auth/src/rbac.ts
related_tests:
  - apps/api/test/demo.service.test.ts
related_endpoints:
  - "v1/demo"
related_events: []
related_agents: []
last_verified: ""
---

# Spec: Modo demo/sandbox sin registro (Agro primero)

## Problem Statement

Un visitante no puede experimentar el valor de un vertical antes de registrarse; hoy el flujo es Landing → Login → Dashboard. Queremos Landing → Explorar → **Probar con datos ficticios** → Crear cuenta. Primer vertical: SEMSE Agro (autocontenido y visual).

## Scope

- In scope (v1, solo Agro):
  - Organización sandbox `demo` con datos seed deterministas (animales, cultivos, inventario, tareas, costos).
  - Sesión demo anónima efímera: token de solo-demo con TTL corto, rate-limited, sin PII.
  - Vista Agro en modo demo con banner persistente "Datos de demostración" y CTA a registro que conserva la intención (`/register?from=agro`).
  - Escrituras permitidas SOLO sobre entidades del sandbox (agregar una vaca ficticia, registrar cultivo) con reset periódico.
- Out of scope:
  - Demo de Connect/BuildOps (fases futuras; reutilizarán esta infraestructura).
  - Persistencia entre sesiones demo, cuentas demo nominales, cualquier pago o escrow real.

## Non-Goals

- No se crean flujos paralelos de Agro: la demo reutiliza las pantallas reales de `apps/web/app/agro` con el contexto sandbox.
- No convierte datos demo en datos reales al registrarse (v1: el usuario empieza limpio; la intención se conserva vía `?from=`).

## Aislamiento — DISEÑO VALIDADO (F4.1, 2026-07-08)

Decisiones del usuario: **lectura + escritura sobre sandbox** (la visión completa), **TTL 30 minutos**.

Validación contra el schema real: `AgroFarm` se aisla por `ownerId` (nullable, sin tenant/org),
y todos los endpoints agro exigen permisos `agro:read`/`agro:write` con scoping por `ctx.userId`
(`resolveRequestContext`). Por lo tanto **NO se necesita flag `isDemo` en Organization ni migración**:
el aislamiento natural del dominio es suficiente con un usuario demo dedicado.

```yaml
identidad_demo:
  - usuario seed reservado: email demo-agro@semse.internal (constante DEMO_AGRO_EMAIL)
  - rol con permission set EXACTO {agro:read, agro:write} — nada más
  - exclusión de matching/reputación/consciousness/pagos POR CONSTRUCCIÓN:
    el usuario demo no puede tocar jobs/bids/payments (deny-by-default RBAC,
    hereda rbac-explicit-boundary); agro no alimenta matching ni reputación
granja_sandbox:
  - 1 AgroFarm seed determinista propiedad del usuario demo:
    animales, grupos, unidades, inventario, tareas, costos realistas
  - escrituras del visitante permitidas SOLO ahí (scoping ownerId existente)
session:
  - POST /v1/demo/session (público, rate-limited por IP):
    crea AuthSession del usuario demo con accessExpiresAt = +30min
    y refreshExpiresAt = +30min (sin renovación); mismo shape de tokens
    que el login normal para reutilizar el BFF web-session sin cambios
  - audit_log: demo.session.created
reset:
  - al crear sesión demo: si el último reset > 6h, borrar AgroFarm demo
    (onDelete: Cascade limpia todo el árbol) y re-sembrar seed determinista
  - sin job de worker en v1 (reset lazy en sesión); worker cron es mejora v2
kill_switch:
  - DEMO_MODE_ENABLED (env): apagado → 404 en el endpoint y CTAs ocultos
```

## API Contract

### `POST /v1/demo/session`

```yaml
auth: none (público, rate-limited)
roles: []
privacyCritical: false
input_schema: { vertical: "agro" }
output_schema: { token: string, expiresAt: ISO8601, orgId: string }
errors:
  429: rate limit por IP
  400: vertical no soportado
effects:
  audit_log: demo.session.created
```

## UI Contract

```yaml
screens:
  - /hub → tarjeta Agro con "Probar demo"
  - /demo/agro (o /agro con contexto demo)
states: [loading, ready, expired, error]
required_behavior:
  - Banner fijo "Estás viendo datos de demostración" + CTA registro en toda vista demo
  - Al expirar el token: estado `expired` con CTA a reiniciar demo o registrarse
  - Nunca mezclar navegación demo con rutas autenticadas reales
```

## Data Model Impact

- Prisma models: **ninguno nuevo** (diseño F4.1: usuario demo + granja por ownerId)
- Migrations: **ninguna**
- Backfill: N/A; seed determinista de usuario+granja demo en el módulo demo (idempotente en runtime, no en seed.ts, para funcionar también en prod)

## Security / RBAC

- Rol `DEMO_VIEWER` (o token scope) con acceso EXCLUSIVO a la org demo; deny-by-default hereda de `rbac-explicit-boundary`.
- Tenant boundary: toda query demo filtra por org demo; test obligatorio de no-fuga.
- Audit: creación de sesión y resets.

## Tests Required

- [x] Sesión demo emite rol DEMO_AGRO con TTL 1800s — no-fuga por RBAC deny-by-default + scoping ownerId (unit: demo.service.test.ts)
- [x] Exclusión de matching/métricas POR CONSTRUCCIÓN: el permission set {agro:read, agro:write} no alcanza jobs/matching/payments (documentado en rbac.ts; cubierto por rbac-explicit-boundary)
- [x] Kill switch: DEMO_MODE_ENABLED apagado → 404 (unit)
- [x] Rate limit 429: @Throttle 5/min en el endpoint + manejo de estado `rate-limited` en /demo/agro
- [x] Reset restaura el seed determinista: granja fresca se reutiliza, granja >6h se borra y re-siembra (unit)
- [ ] e2e navegador del flujo completo (requiere API con DEMO_MODE_ENABLED en el entorno e2e) — pendiente para VERIFIED

## Implementation Map

### API

- `apps/api/src/modules/demo/` — nuevo módulo (session, guard, rate limit)
- `apps/api/src/modules/agro/` — sin cambios de dominio; solo respeta tenant boundary

### Web

- `apps/web/app/(public)/hub/page.tsx` — CTA demo
- `apps/web/app/demo/agro/` (o wrapper de contexto sobre `apps/web/app/agro`)

### Packages

- `packages/db` — migración flag + seed demo determinista

### Tests

- `tests/` — unit módulo demo + e2e flujo demo

## Acceptance Criteria

- [ ] `pnpm spec:validate` pasa; spec enlazado en `docs/SPEC_INDEX.md`
- [ ] Visitante anónimo prueba Agro con datos ficticios sin crear cuenta
- [ ] Cero impacto medible en matching/reputación/métricas por datos demo (test)

## Rollback Considerations

- How to disable: feature flag de entorno `DEMO_MODE_ENABLED=false` desactiva endpoint y CTAs.
- Data rollback: borrar org demo y su seed; ninguna otra tabla afectada.
- Operational owner: semse-core
