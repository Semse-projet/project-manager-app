---
id: "ui.demo-sandbox"
title: "Modo demo/sandbox sin registro — Agro primero"
domain: "ui"
status: "APPROVED"
owner: "semse-core"
risk: "high"
related_files:
  - apps/web/app/agro
  - apps/api/src/modules/agro
related_tests: []
related_endpoints: []
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

## Aislamiento (decisión de diseño — REQUIERE validación antes de codificar)

```yaml
org_sandbox:
  - flag `isDemo` en Organization (migración Prisma) o org con id reservado documentado
  - REGLA DURA: entidades de org demo EXCLUIDAS de: matching, reputación, consciousness,
    analytics, notificaciones externas (WhatsApp/email), colas de agentes
session:
  - POST /v1/demo/session → token efímero (TTL ≤ 60 min), scope: org demo, rol DEMO_VIEWER
  - rate limit por IP; sin captura de PII; auditable como `demo.session.created`
reset:
  - job de worker (o TTL en datos) que restaura el seed determinista cada N horas
riesgos_a_validar_en_F4.1:
  - costo de queries públicos sin auth (abuso) → rate limit + cache
  - fuga de datos demo hacia métricas (Consciousness/Observer) → verificar filtros con test
  - decisiones de producto abiertas (TTL exacto, cuota, si escrituras demo se permiten en v1)
    → si hay dudas, PAUSAR loop y preguntar al usuario (regla 8b del programa)
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

- Prisma models: flag `isDemo` en Organization (o convención de org reservada — decidir en F4.1)
- Migrations: 1 (si se usa flag)
- Backfill: N/A; seed determinista nuevo en `packages/db` seed scripts

## Security / RBAC

- Rol `DEMO_VIEWER` (o token scope) con acceso EXCLUSIVO a la org demo; deny-by-default hereda de `rbac-explicit-boundary`.
- Tenant boundary: toda query demo filtra por org demo; test obligatorio de no-fuga.
- Audit: creación de sesión y resets.

## Tests Required

- [ ] Sesión demo accede a datos demo y NO a ninguna otra org (no-fuga)
- [ ] Entidades demo excluidas de matching y métricas (Observer/Consciousness)
- [ ] TTL expira y la UI muestra estado `expired`
- [ ] Rate limit responde 429
- [ ] Reset restaura el seed determinista

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
