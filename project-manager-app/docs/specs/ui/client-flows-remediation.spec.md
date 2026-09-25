---
id: "ui.client-flows-remediation"
title: "Client UI Flows — Remediation (auditoría 2026-07-20)"
domain: "ui"
version: "1.1"
status: "APPROVED"
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
last_verified: "2026-08-14"
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

> **Reconciliado 2026-08-14.** Este spec quedó congelado en el estado de la auditoría original (2026-07-20) mientras `docs/AUDIT_REMEDIATION_PLAN.md` §1 (y algunos ítems de §0, transversales) siguió recibiendo fixes y verificación en vivo hasta 2026-08-03 sin que nadie volviera a este archivo — el mismo patrón de documentación desincronizada ya documentado repetidas veces en `admin-flows-remediation.spec.md`. Cada gap de abajo fue re-mapeado a su ítem correspondiente del plan (código + git log; live donde el plan ya lo registra) en vez de re-auditarse desde cero.

### G-CLI-00 — RESUELTO — Causa raíz: `JobStatus` en mayúsculas comparado contra literales en minúsculas
**= plan 1.4.** Corregido (Crew A, 2026-07-21), mismo fix centralizado que **G-PRO-00**/**G-ADM-00** (un solo bug, tres specs lo referenciaban). **Verificado en vivo (2026-07-31/08-01):** login como `client@demo.semse`, `/client/dashboard` mostró "Trabajos activos: 1", "Completados: 1", "Presupuestos activos: $2,800" — no cero, con la lista de jobs reales mostrando sus estados en español.

### G-CLI-01 — RESUELTO — Fondear escrow / liberar pago sin confirmación ni monto visible
**= plan 1.1 + 1.2.** Corregido (2026-07-23). `handleFundEscrow` (`client/jobs/[jobId]/page.tsx`) ahora abre el `EscrowFundModal` ya cableado en `client/payments` en vez de llamar la API directo; `handleRelease` abre un `ConfirmDialog` nuevo (componente genérico reutilizable, `apps/web/components/ui/confirm-dialog.tsx`) con el monto exacto del hito antes de liberar. La superficie duplicada (`apps/web/app/jobs/[jobId]/escrow/page.tsx`) recibió el mismo `EscrowFundModal` para fondeo; `EscrowTimeline.tsx` (liberación, endpoint/monto distintos — `EscrowFundModal` no aplica ahí) recibió un paso de confirmación inline equivalente dentro de `MilestoneRow` en vez de un modal nuevo.

### G-CLI-02 — RESUELTO — "Resolver disputa" fijo a `pro_favor`, sin confirmación
**= plan 1.3.** Corregido (2026-07-23) — investigado hasta el límite real: `disputes.policy.ts` (`assertDisputeResolvable`) solo permite a un actor CLIENT resolver con `resolutionType: "pro_favor"`; reembolsos/splits/escalamiento exigen `OPS_ADMIN` y son rechazados para cualquier otro actor. No había margen para un selector de resultado real. `handleResolveDispute` ya no dispara al primer clic — abre un `ConfirmDialog` que explicita el único resultado disponible y su consecuencia (libera los fondos en escrow) antes de llamar a la API.

### G-CLI-03 — RESUELTO — Wizard de publicación pierde el 100% del progreso al refrescar
**= plan 1.14.** Corregido — borrador persistido en `localStorage` (`semse-job-wizard-draft`, debounce 500ms), banner de recuperación al detectar un borrador guardado. **Verificado en vivo (2026-08-01):** categoría "Plomería" seleccionada, refresh real, el borrador persistió y el banner verde de recuperación apareció con "Plomería" pre-seleccionada.

### G-CLI-04 — RESUELTO — Función caída: "Calcular estimado" de ProTools daba 404
**= plan 0.31** (transversal, no específico de Cliente pero la única UI consumidora es `client/protools/page.tsx`). Corregido (2026-07-22) — causa real: el backend siempre funcionó; el 404 era del BFF de Next.js (`agents/protools/route.ts` no matcheaba el segmento `/estimate` que el frontend pedía). Se movió el handler a `agents/protools/estimate/route.ts`. Se agregó chequeo de `content-type` antes de parsear JSON en el frontend para no volver a mostrar un error crudo de parseo ante una respuesta no-JSON.

### G-CLI-05 — RESUELTO (parcial, con una pieza de UX dejada como decisión de producto abierta) — El sugeridor de presupuesto con IA ignoraba categoría/área y devolvía rangos absurdos
**= plan 0.29** (transversal). Corregido (2026-07-22), conservador a propósito por ser un estimador con impacto de negocio real: (1) el fallback de "pocos datos similares" ya no mezcla categorías no relacionadas — filtra por `category` primero, y si no hay ninguna coincidencia devuelve el estado explícito "sin base confiable" en vez de inventar un número (esto es exactamente lo que habría evitado el caso real de $80 → $2,074–$4,839); (2) `LocationCostService` (ya existía, no estaba conectado) ahora se aplica al rango final; (3) `areaSqft` se incorpora como señal cualitativa honesta (no hay columna de área en `Job` para una base numérica real). **Explícitamente NO tocado:** el auto-apply de la sugerencia a los sliders sin confirmación del usuario, que el hallazgo original también mencionaba — es una decisión de flujo/UX (¿debería auto-rellenar o solo sugerir?) separada de que el número esté mal, dejada abierta a propósito en vez de resolverse por adivinanza.

### G-CLI-06 — YA RESUELTO — Catálogo de 24 agentes de IA
**= plan 1.11.** Confirmado por código (2026-07-27) que el hallazgo describía una versión anterior del componente, ya superada — no requirió cambios: las 24 tarjetas son clicables y expanden un panel de detalle real; los 16 "Conversacionales" enrutan cada uno a su agente real correspondiente (no un Prometeo hardcodeado, 6 abren chat directo y 10 muestran "Canalizado vía X" con el agente correcto); los 8 "Especializados" son backend-only por diseño. El texto visible de cada botón ya constituye su nombre accesible.

### G-CLI-07 — RESUELTO (parcial, con una pieza diferida a propósito) — "Prometeo Copilot" exponía un error interno crudo
**= plan 1.11c.** Corregido — parcial (2026-07-27): el error crudo `Authentication required for SEMSE API route` se corrigió en el punto compartido (`unwrap()` en `lib/bff/prometeo.ts`, usado por los 16 agentes/Prometeo de este módulo, no solo este widget) — ahora muestra un mensaje en español, accionable, de sesión expirada. **El botón de acción rápida "stub" (`Preguntar a Prometeo`) NO se corrigió, a propósito:** investigado hasta la causa raíz — ninguna de las 6 acciones "inline" del backend (`PrometeoCopilotService.executeAction()`) consulta datos reales todavía; hacerlo real es una feature de 6 integraciones distintas, no un fix de una línea. Queda señalado para una sesión futura con alcance de producto claro.

### G-CLI-08 — RESUELTO — El rol "Cliente" mezcla dos personas de producto sin avisar
**= plan 1.5.** La decisión de producto que este spec pedía como bloqueante para `APPROVED` ya se tomó y se implementó (2026-07-27): **mantener un solo rol Cliente, agregar un selector/agrupación de contexto explícito en vez de dividir en dos roles.** Además del agrupamiento de nav ("Como comprador" / "Como contratista"), se corrigió el bug concreto que motivó parte del hallazgo — `MarketplaceService.listOpenJobs()`/`getStats()` no filtraban por organización, así que un cliente veía (y podía ofertar sobre) sus propios jobs publicados en el marketplace; ahora excluyen la org propia del actor, resuelta server-side. **Verificado en vivo (2026-07-31/08-01):** los dos grupos de nav aparecen exactamente como se diseñaron. Pendiente de verificación en vivo específica: que un job propio ya no aparece en el marketplace propio (no se probó en la misma sesión que tenía ambas condiciones).

### G-CLI-09 — RESUELTO — Navegación huérfana y marca dividida
Los 4 sub-hallazgos, todos resueltos por separado:
- `/dashboard` huérfano → **plan 1.6**, corregido (2026-07-27): redirect por rol en `middleware.ts`; verificado en vivo (2026-08-01) que redirige a `/client/dashboard`/`/worker/dashboard` según el rol de sesión real.
- Marca dividida "SEMSE Project" vs "SEMSE OS" → **plan 1.21**, corregido (2026-07-27) con decisión de producto explícita ("SEMSE Project" gana en toda la superficie) — reemplazado en pantallas de auth, UI autenticada, PDFs generados, y los system prompts de Prometeo/Cronos que le decían al modelo que era "SEMSE OS" (para que el propio chat no reintrodujera la dualidad). Un residuo no cubierto por el pase original (`ops.controller.ts`, texto interno nunca visible a usuarios) se corrigió aparte el 2026-07-30 (PR #475).
- Tema claro/oscuro no sobrevive un refresh → **plan 1.9**, corregido — persistencia vía `localStorage` + `data-theme`. Verificado en vivo (2026-08-01): cambio a "Claro" + `page.reload()` real, el tema se mantuvo.
- FAB tapa el monto de una propuesta en mobile → **plan 1.10**, corregido — `pb-24 md:pb-0` en el contenedor raíz de `client/jobs/[jobId]/page.tsx`.

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

- [x] `client/dashboard` — job con status `ACCEPTED` cuenta en "Trabajos activos" (regresión directa de G-CLI-00) — verificado en vivo 2026-07-31/08-01 ("Trabajos activos: 1", no cero)
- [x] `client/jobs` filtro "Activos" incluye jobs `IN_PROGRESS`/`RESERVED`/`REVIEW` — mismo fix centralizado que el ítem anterior (`client/jobs/page.tsx:113`, parte de la causa raíz 0.0/1.4); la confirmación en vivo específica quedó sobre `/client/dashboard`, no se repitió el click-through del tab "Activos" por separado
- [x] Fondear escrow requiere confirmación explícita con monto antes de llamar a la API (3 superficies de G-CLI-01) — corregido 2026-07-23 (plan 1.1/1.2), pendiente de verificación en vivo dirigida a las 3 superficies (no registrada explícitamente en el plan)
- [x] Wizard de publicación sobrevive un refresh en cualquier paso sin perder datos — verificado en vivo 2026-08-01 (categoría persistida + banner de recuperación tras refresh real)
- [x] `POST /api/semse/agents/protools/estimate` responde 200 con un payload válido, no 404 — corregido 2026-07-22 (plan 0.31), pendiente verificación en vivo

## Implementation Map

### Web
- `apps/web/app/(app)/client/**`
- `packages/ui/src/components/EscrowTimeline.tsx`
- `apps/web/app/components/payments/EscrowFundModal.tsx`

### API
- `apps/api/src/modules/bids/bids.repository.ts`
- Ruta faltante para `agents/protools/estimate`
- `apps/api/src/modules/intelligence/budget-intelligence.service.ts`

## Acceptance Criteria

- [x] Este spec reemplaza a `docs/specs/ui/client-flows.spec.md` en `SPEC_INDEX.md` — el anterior ya estaba `DEPRECATED` desde antes de esta reconciliación
- [x] Owner confirma explícitamente G-CLI-08 (decisión de producto) antes de que este spec pase a `APPROVED` — confirmado 2026-07-27 (plan 1.5): un solo rol Cliente, selector/agrupación de contexto en vez de dividir en dos roles
- [x] `pnpm spec:validate:strict` pasa
- [x] Cada gap G-CLI-* tiene su tarea correspondiente en `docs/AUDIT_REMEDIATION_PLAN.md` sección 1 (o sección 0 para G-CLI-04/05, transversales), marcada `[x]` — ver mapeo completo en cada gap arriba

## Rollback Considerations

- Ninguno de los fixes propuestos aquí cambia contratos de API existentes de forma incompatible — son correcciones de lectura (G-CLI-00) o de flujo de confirmación en el cliente (G-CLI-01/02), no requieren rollback de datos.
