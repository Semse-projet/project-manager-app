---
id: "ui.landing-personas"
title: "Landing dinámica por persona — ¿Qué quieres hacer hoy?"
domain: "ui"
status: "APPROVED"
owner: "semse-core"
risk: "low"
related_files:
  - apps/web/app/(public)/page.tsx
  - apps/web/components/landing/landing-routes.ts
  - apps/web/components/landing/operational-routes-grid.tsx
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: ""
---

# Spec: Landing dinámica por persona

## Problem Statement

La landing actual comunica el flujo de intake de construcción, pero un agricultor, una empresa o un profesional no descubren que SEMSE resuelve su problema. La landing debe responder "¿qué puedes hacer dentro del ecosistema SEMSE?" según quién pregunta, sin exigir registro.

## Scope

- In scope:
  - Sección "¿Qué quieres hacer hoy?" en la landing pública con selector de persona: **Agricultor / Contratista o Profesional / Cliente / Empresa**.
  - Al cambiar de persona, las tarjetas de capacidades se re-renderizan client-side (sin recarga), alimentadas del mismo catálogo tipado del Hub (`landing-routes.ts`).
  - Cada tarjeta enlaza a: detalle de módulo en el Hub, al intake wizard (clientes), o a `/login?from=` (profesionales).
  - Persona elegida persiste en `localStorage`; el Hub la lee para resaltar módulos relevantes.
- Out of scope:
  - Cambios al flujo de intake existente (gobernado por `ui.public-landing-operational-entry` e `intake-flow`, que siguen vigentes).
  - Personalización server-side o por cuenta.
  - Modo demo (spec `ui.demo-sandbox`).

## Non-Goals

- No reemplaza el hero ni el brief de intake actuales; la sección se añade debajo del hero.
- No introduce estado de servidor ni cookies: solo `localStorage`.

## UI Contract

```yaml
screens:
  - / (landing pública, nueva sección persona-selector)
states:
  - ready          # default: sin persona seleccionada → mostrar las 4 opciones + tarjetas genéricas
  - persona-active # persona elegida → tarjetas filtradas del catálogo
required_behavior:
  - Selector accesible por teclado (tabs/botones), sin recarga de página al cambiar.
  - Tarjetas por persona provienen del catálogo único del Hub etiquetado con `personas: []` por módulo/capacidad. Cero contenido duplicado hardcodeado en la landing.
  - "Agricultor" muestra capacidades de Agro + Connect (contratar veterinario) + Payments.
  - "Contratista/Profesional" muestra BuildOps + ProTools + Connect (encontrar trabajos) + Trust.
  - "Cliente" muestra intake wizard + Connect + Escrow.
  - "Empresa" muestra Core (equipos/roles) + Connect + AI + Analytics/Knowledge.
  - Persona persistida en localStorage clave `semse.persona`; el Hub resalta módulos de esa persona al visitarlo.
  - Deep link: /?persona=agro selecciona la persona al cargar.
  - Responsive + light/dark, mismos componentes de animación existentes (scroll-reveal, etc.).
```

## Security / RBAC

- 100% público, sin datos personales. `localStorage` solo guarda un enum de persona.

## i18n Requirements

- Strings en español, consistentes con la landing actual.

## Tests Required

- [ ] Cambiar de persona cambia las tarjetas visibles (e2e)
- [ ] `/?persona=agro` preselecciona Agricultor
- [ ] Persona persiste tras recargar (localStorage)
- [ ] Tarjetas enlazan a rutas válidas (hub/módulo/intake/login)
- [ ] Sin persona seleccionada la landing se ve completa (estado default no roto)

## Implementation Map

### Web

- `apps/web/components/landing/landing-routes.ts` — añadir `personas` al tipo del catálogo
- `apps/web/components/landing/persona-selector.tsx` — nuevo (client component)
- `apps/web/app/(public)/page.tsx` — montar sección
- `apps/web/app/(public)/hub/page.tsx` — leer `semse.persona` y resaltar

### Tests

- `tests/e2e-semse/landing-personas.spec.ts` — nuevo

## Acceptance Criteria

- [ ] Spec enlazado desde `docs/SPEC_INDEX.md`
- [ ] `pnpm spec:validate` pasa
- [ ] Un agricultor anónimo descubre SEMSE Agro desde la landing en ≤2 clics sin login

## Rollback Considerations

- How to disable: desmontar la sección de `page.tsx`; componente aditivo sin efectos en flujos existentes.
- Data rollback: N/A.
- Operational owner: semse-core
