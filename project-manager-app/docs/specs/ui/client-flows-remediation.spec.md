---
id: "ui.client-flows-remediation"
title: "Client UI Flows — Remediation (auditoría 2026-07-20)"
domain: "ui"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
date: "2026-07-20"
author: "Claude Sonnet — sesión de auditoría en vivo (código + producción)"
spec_index: "docs/SPEC_INDEX.md"
supersedes: "docs/specs/ui/client-flows.spec.md"
related_files:
  - apps/web/app/(app)/client
  - apps/web/app/(app)/client/dashboard/page.tsx
  - apps/web/app/(app)/client/jobs/page.tsx
  - apps/web/app/(app)/client/jobs/[jobId]/page.tsx
  - apps/web/app/(app)/client/jobs/new/page.tsx
  - apps/web/app/(app)/client/leads/page.tsx
  - apps/web/app/(app)/client/marketplace/page.tsx
  - apps/web/app/(app)/client/protools/page.tsx
  - apps/web/app/dashboard/dashboard-client.tsx
  - apps/api/src/modules/bids/bids.repository.ts
  - apps/api/src/modules/payments
  - apps/api/src/modules/auth/auth.service.ts
related_tests: []
related_endpoints:
  - v1/jobs
  - v1/bids
  - v1/milestones
  - v1/payments
  - v1/auth/token
  - v1/auth/login
related_events:
  - milestone.approved
  - payment.released
related_agents:
  - prometeo
last_verified: "2026-07-20"
---

# Spec: Client UI Flows — Remediation

> **Por qué existe este documento.** `docs/specs/ui/client-flows.spec.md` (status `VERIFIED`, `last_verified: 2026-06-09`) especifica rutas que **ya no son las que usa el cliente real** (`/jobs/new`, `/jobs/:jobId`, `/jobs/:jobId/payments`) — esas rutas siguen existiendo en el código como una segunda implementación huérfana, sin ningún enlace de navegación (ver hallazgo de UX de esta misma auditoría). El flujo real, vinculado desde el sidebar y usado en producción, vive bajo `/client/*`. Ese flujo real **no tiene spec propio** — nunca se le corrigió el contrato después de la migración de rutas. Este documento cierra esa brecha: especifica el contrato real de `/client/*` y documenta, con evidencia en vivo contra producción, dónde el código actual no cumple ni su propio contrato implícito.
>
> Auditado con: 9 revisiones de código en paralelo (backend transversal) + navegación en vivo contra `semse-web-production.up.railway.app` con una cuenta cliente real. Reporte narrativo completo: artefacto "SEMSE — Auditoría de UI/UX y backend" (Claude Artifacts). Backlog accionable: `docs/AUDIT_REMEDIATION_PLAN.md` sección 1 (más sección 0, transversal).

## Problem Statement

El rol CLIENT vive bajo `/client/*` (no `/jobs/*`, que es código huérfano de una implementación anterior). Ese flujo real tiene tres clases de problema verificadas contra código y contra producción real:

1. **Un bug de comparación de strings hace que el centro de control del cliente mienta.** El enum `JobStatus` de Prisma es mayúsculas; ocho archivos de frontend (cuatro de ellos en este módulo) comparan contra literales en minúsculas sin normalizar, así que ningún job realmente aceptado se cuenta como "activo" en ningún KPI ni filtro.
2. **Acciones que mueven dinero real disparan sin confirmación ni monto visible.** Fondear escrow y liberar pago llaman a la API directo en el `onClick`.
3. **El rol "Cliente" mezcla dos personas de producto distintas** (dueño que contrata vs. contratista con su propio CRM de leads) dentro del mismo nav, con copy que se contradice entre pantallas.

## Scope

- In scope: `apps/web/app/(app)/client/**`, el wizard de publicación (`/client/jobs/new`), el BFF (`apps/web/app/api/semse/**`) en la medida que sirve a estas pantallas, y los endpoints de `apps/api` que consumen (jobs, bids, milestones, payments, escrow, protools/estimate).
- Out of scope: el módulo Worker/PRO (ver `pro-flows-remediation.spec.md`) y el módulo Admin (ver `admin-flows-remediation.spec.md`), salvo donde comparten causa raíz (marcado explícitamente abajo).

## Non-Goals

- Este spec no decide si "Cliente" debe seguir siendo un rol híbrido (dueño + contratista) o dividirse en dos — eso es una decisión de producto que este documento solo señala, no resuelve (ver Gap G-CLI-08).
- No repara el motor de pagos en sí (double-payment, webhook no-op) — eso vive en `docs/AUDIT_REMEDIATION_PLAN.md` sección 0 (transversal, no específico de UI de cliente).

## Gaps encontrados (reemplaza la sección "Flujos" del spec anterior, que describía rutas huérfanas)

### G-CLI-00 — CRÍTICO — Causa raíz: `JobStatus` en mayúsculas comparado contra literales en minúsculas
**Archivos:** `client/dashboard/page.tsx:119`, `client/jobs/page.tsx:22-24,113`, `client/jobs/[jobId]/page.tsx`, `apps/web/app/dashboard/dashboard-client.tsx`.
**Contrato roto:** el enum real (`packages/db/prisma/schema.prisma:11-23`) es `ACCEPTED`/`IN_PROGRESS`/etc. El filtro `["in_progress","reserved","accepted","review"].includes(j.status)` nunca hace match contra un valor real. **Trabajos activos** siempre reporta 0; la pestaña "Activos" siempre está vacía; los badges de estado caen al color/label por defecto.
**Impacto:** el cliente no puede ver, desde ningún KPI, qué trabajos tiene realmente en curso. Mismo patrón que **G-PRO-00** y **G-ADM-00** — un solo bug, tres specs lo referencian.
**Fix esperado:** comparar/mapear contra los valores reales del enum `JobStatus` (mayúsculas) en los 4 archivos de este módulo. Preferir importar un tipo/const compartido desde `packages/schemas` en vez de mantener 8 copias locales del mismo mapa.

### G-CLI-01 — CRÍTICO — Fondear escrow / liberar pago sin confirmación ni monto visible
**Archivos:** `client/jobs/[jobId]/page.tsx` (`handleFundEscrow:288-301`, `handleRelease:333-350`, botones `728-745,923-930`); duplicado en `apps/web/app/jobs/[jobId]/escrow/page.tsx:75-94` y `packages/ui/src/components/EscrowTimeline.tsx:256-264`.
**Contrato roto:** ninguna de las tres superficies pasa por `EscrowFundModal` (que sí implementa monto + confirmación correctamente, y ya está cableado en `client/payments`).
**Fix esperado:** cablear `EscrowFundModal` (o un modal equivalente) en las 3 superficies antes de llamar a la API.

### G-CLI-02 — CRÍTICO — "Resolver disputa" fijo a `pro_favor`, sin confirmación
**Archivo:** `apps/web/app/jobs/[jobId]/page.tsx:276-293` (`handleResolveDispute`).
**Nota:** este archivo vive en la ruta huérfana `/jobs/[jobId]`, no en `/client/*` — verificar explícitamente que esté bloqueada para tráfico real antes de decidir si se repara o se elimina (relacionado con G-CLI-09).

### G-CLI-03 — ALTO — Wizard de publicación pierde el 100% del progreso al refrescar
**Archivo:** `client/jobs/new/page.tsx`.
**Confirmado en vivo:** se llenaron los 2 primeros pasos, se refrescó, el wizard volvió a Paso 1 sin ningún rastro.
**Fix esperado:** persistir el estado del wizard en `localStorage`/`sessionStorage` por paso, o advertir antes de perder el progreso.

### G-CLI-04 — CRÍTICO — Función caída: "Calcular estimado" de ProTools da 404
**Confirmado en vivo:** `POST /api/semse/agents/protools/estimate` → 404 real, reproducible. El frontend muestra `Unexpected token '<', "<!DOCTYPE "...` crudo en vez de un mensaje entendible.
**Fix esperado:** localizar/crear la ruta backend faltante; agregar manejo de error para respuestas no-JSON en el frontend.

### G-CLI-05 — ALTO — El sugeridor de presupuesto con IA ignora categoría/área y devuelve rangos absurdos
**Confirmado en vivo:** para un job de "reparación de fugas" con referencia base de $80, el botón "Sugerir presupuesto con IA" devolvió $2,074–$4,839 y lo auto-aplicó a los sliders sin confirmación, admitiendo en su propio texto "sin trabajos directamente similares — estimado del promedio general del sistema".
**Backend:** `apps/api/.../budget-intelligence.service.ts:39-45,65-101,122-140` — no usa área/sqft ni ubicación numéricamente; el fallback de pocos datos mezcla categorías no relacionadas.

### G-CLI-06 — ALTO — Catálogo de 24 agentes de IA: solo 6 son alcanzables, y no lo dice
**Confirmado en vivo:** clic en la mayoría de las tarjetas de `/agents` no hace nada (botones sin `aria-label`); el FAB flotante siempre abre a Prometeo sin importar cuál tarjeta se clickeó.

### G-CLI-07 — ALTO — "Prometeo Copilot" (segundo widget flotante) expone un error interno crudo
**Confirmado en vivo:** el chip de acción rápida es un stub (`Acción "Preguntar a Prometeo" ejecutada.`); el chat libre responde literalmente `Authentication required for SEMSE API route`.

### G-CLI-08 — ALTO — El rol "Cliente" mezcla dos personas de producto sin avisar
**Confirmado en vivo:** `/client/leads` es un CRM de prospectos (lenguaje de contratista); `/client/marketplace` ("Buscar trabajo") muestra al cliente su propio job publicado con un botón "Aplicar" como si él mismo pudiera postularse. `/client/bids` ("Mis propuestas") le dice al cliente "Explora el marketplace y aplica a trabajos disponibles".
**Decisión pendiente de producto:** ¿es "Cliente" intencionalmente un rol híbrido, o son dos personas que deberían separarse?

### G-CLI-09 — MEDIO — Navegación huérfana y marca dividida
- `/dashboard` (huérfano) carga en cero y expone un banner de migración interna ("Mission Control") a cualquier cliente.
- Landing dice "SEMSE Project" (tema claro); app autenticada dice "SEMSE OS" (tema oscuro) — dos identidades de marca.
- Tema claro/oscuro no sobrevive un refresh.
- FAB de asistente tapa el monto de una propuesta en mobile.

## UI Contract (estados esperados, no documentados en el spec anterior)

```yaml
screens:
  - /client/dashboard
  - /client/jobs
  - /client/jobs/[jobId]
  - /client/jobs/new (wizard, 4 pasos)
  - /client/milestones
  - /client/payments
  - /client/protools
  - /client/leads
  - /client/marketplace
  - /client/bids
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - "Trabajos activos" y la pestaña "Activos" deben reflejar jobs con status ACCEPTED/IN_PROGRESS/RESERVED/REVIEW reales (bloqueado hoy por G-CLI-00)
  - Ninguna acción que mueva dinero o cierre una disputa ejecuta sin un paso de confirmación explícito con el monto/resultado visible
  - El wizard de publicación no pierde datos ante un refresh accidental
```

## Security / RBAC

- Tenant boundary: no se encontraron fugas cross-tenant específicas de este módulo (las fugas cross-tenant confirmadas — evidencia de milestones, change-orders, SSE — están documentadas en `docs/AUDIT_REMEDIATION_PLAN.md` sección 0, son transversales, no exclusivas del rol CLIENT).
- Relacionado directo con este rol: el bypass de login vía spoofing de headers en `/api/semse/auth/login` (sección 0.1 del plan) afecta la puerta de entrada a este módulo — cualquier rol puede autoemitirse acceso, no solo CLIENT.

## Tests Required

- [ ] `client/dashboard` — job con status `ACCEPTED` cuenta en "Trabajos activos" (regresión directa de G-CLI-00)
- [ ] `client/jobs` filtro "Activos" incluye jobs `IN_PROGRESS`/`RESERVED`/`REVIEW`
- [ ] Fondear escrow requiere confirmación explícita con monto antes de llamar a la API (3 superficies de G-CLI-01)
- [ ] Wizard de publicación sobrevive un refresh en cualquier paso sin perder datos
- [ ] `POST /api/semse/agents/protools/estimate` responde 200 con un payload válido, no 404

## Implementation Map

### Web
- `apps/web/app/(app)/client/**`
- `apps/web/app/dashboard/dashboard-client.tsx`
- `packages/ui/src/components/EscrowTimeline.tsx`
- `apps/web/app/components/payments/EscrowFundModal.tsx`

### API
- `apps/api/src/modules/bids/bids.repository.ts`
- Ruta faltante para `agents/protools/estimate`
- `apps/api/src/modules/intelligence/budget-intelligence.service.ts`

## Acceptance Criteria

- [ ] Este spec reemplaza a `docs/specs/ui/client-flows.spec.md` en `SPEC_INDEX.md` (el anterior pasa a `DEPRECATED`, referencia histórica de la implementación huérfana en `/jobs/*`)
- [ ] Owner confirma explícitamente G-CLI-08 (decisión de producto) antes de que este spec pase a `APPROVED` — sin eso, no hay `plan.md` que pueda proponer un fix de código para ese gap concreto (los demás gaps sí pueden avanzar a plan independientemente)
- [ ] `pnpm spec:validate:strict` pasa
- [ ] Cada gap G-CLI-* tiene su tarea correspondiente en `docs/AUDIT_REMEDIATION_PLAN.md` sección 1, marcada `[x]` solo cuando el test asociado pasa

## Rollback Considerations

- Ninguno de los fixes propuestos aquí cambia contratos de API existentes de forma incompatible — son correcciones de lectura (G-CLI-00) o de flujo de confirmación en el cliente (G-CLI-01/02), no requieren rollback de datos.
