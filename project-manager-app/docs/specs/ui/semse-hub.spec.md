---
id: "ui.semse-hub"
title: "SEMSE Hub — portal público de módulos del ecosistema"
domain: "ui"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "low"
related_files:
  - apps/web/app/(public)/page.tsx
  - apps/web/app/(public)/hub/page.tsx
  - apps/web/app/(public)/modules/[id]/page.tsx
  - apps/web/components/landing/ecosystem-modules.tsx
  - apps/web/components/landing/landing-routes.ts
  - apps/web/components/landing/landing-nav.tsx
  - apps/web/components/landing/landing-footer.tsx
related_tests:
  - tests/e2e-semse/hub.spec.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: ""
---

# Spec: SEMSE Hub — portal público de módulos del ecosistema

## Problem Statement

Los verticales de SEMSE (Agro, BuildOps, ProTools, Knowledge, Communications) solo son descubribles desde `/admin`. Un agricultor tendría que entrar al panel de administración para enterarse de que SEMSE Agro existe. El admin administra; no es la puerta de entrada del producto.

## Scope

- In scope:
  - Ruta pública `/hub`: grid de los 9 módulos de la taxonomía (Core, Connect, Payments, Trust, AI, Agro, BuildOps, Knowledge, Integrations) con capacidades reales y estado (live / demo próximamente).
  - Catálogo tipado único de módulos (extender `ecosystemModules` en `landing-routes.ts`) consumido por Hub, landing y páginas de detalle. Una sola fuente de verdad.
  - Extender `(public)/modules/[id]` para cubrir los 9 módulos con: qué resuelve, capacidades existentes, CTA por rol (`/login?from=<ruta destino>`), y enlace a demo cuando exista (F4).
  - Enlaces a `/hub` desde landing nav y footer.
- Out of scope:
  - Modo demo (spec `ui.demo-sandbox`).
  - Activación de módulos por organización (visión "app store" completa — fase futura).
  - Cambios en la estructura de `/admin` o en módulos API.

## Non-Goals

- Este spec no renombra código interno ni mueve módulos API.
- No crea backend nuevo: el Hub es contenido estático tipado + navegación.

## UI Contract

```yaml
screens:
  - /hub                       # grid de 9 módulos
  - /modules/[id]              # detalle por módulo (9 ids de taxonomía)
states:
  - ready                      # contenido estático: sin loading/error de red
required_behavior:
  - El catálogo de módulos vive en UN archivo tipado; Hub, landing y detalle lo importan.
  - Cada tarjeta muestra: nombre, propósito en una línea, 3-5 capacidades REALES (features live, no aspiracionales), estado.
  - CTA por rol en detalle: cliente → intake o registro; profesional → /login?from=/worker/...; empresa/admin → /login?from=/admin.
  - Módulo con id desconocido en /modules/[id] → notFound() (404), no página vacía.
  - Responsive + light/dark, mismos patrones que la landing existente.
  - i18n: strings en español (locale por defecto del proyecto), consistente con la landing.
```

## Security / RBAC

- Rutas 100% públicas y de solo lectura. Sin datos de usuarios, sin llamadas API autenticadas.
- Los CTAs nunca saltan el flujo de autenticación: siempre via `/login?from=`.

## Tests Required

- [ ] `/hub` renderiza los 9 módulos de la taxonomía (e2e, patrón `tests/e2e-semse/public-landing.spec.ts`)
- [ ] `/modules/<cada id>` responde 200 y muestra título del módulo
- [ ] id desconocido → 404
- [ ] CTAs de detalle apuntan a `/login?from=` con destino correcto por rol
- [ ] nav y footer de landing enlazan a `/hub`

## Implementation Map

### Hallazgos de auditoría F2.1 (2026-07-08)

- Ya existía `(public)/modules/[id]` con 7 detalles interactivos (protools, buildops, evidence, escrow, marketplace, prometeo, trust) — se conservan y se agregan los ids de taxonomía: `core`, `connect`, `payments`, `ai`, `agro`, `knowledge`, `integrations` (trust y buildops ya existían con contenido equivalente).
- `ecosystemModules` en `landing-routes.ts` tenía 7 módulos legacy; el nuevo catálogo `hubModules` (9 módulos de taxonomía) convive con él sin romper la sección existente de la landing.
- Verticales solo alcanzables vía `/admin` antes de este spec: Agro, Knowledge, Communications, analizadores AI. `/hub` los expone públicamente como contenido descriptivo + CTA.
- Bug preexistente corregido: id desconocido en `/modules/[id]` mostraba ProTools como fallback; ahora hace `notFound()`.

### Web

- `apps/web/components/landing/landing-routes.ts` — extender `ecosystemModules` a los 9 módulos (id, nombre, tagline, capacidades[], estado, ctas[])
- `apps/web/app/(public)/hub/page.tsx` — nuevo
- `apps/web/app/(public)/modules/[id]/page.tsx` — extender a catálogo completo
- `apps/web/components/landing/landing-nav.tsx`, `landing-footer.tsx` — enlace a Hub

### Tests

- `tests/e2e-semse/hub.spec.ts` — nuevo

## Acceptance Criteria

- [ ] Spec enlazado desde `docs/SPEC_INDEX.md`
- [ ] `related_files` y `related_tests` actualizados al implementar
- [ ] `pnpm spec:validate` pasa
- [ ] Un usuario anónimo puede descubrir Agro, BuildOps y Connect sin tocar `/admin`

## Rollback Considerations

- How to disable: quitar enlaces de nav/footer; las rutas `/hub` y `/modules/*` son aditivas y no afectan flujos existentes.
- Data rollback: N/A (sin datos).
- Operational owner: semse-core
