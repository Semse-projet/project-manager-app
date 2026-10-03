---
id: "ui.design-system-remediation"
title: "Sistema de diseño — consolidación segura y verificable"
domain: "ui"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "high"
date: "2026-07-23"
author: "Codex; actualizada el 2026-10-03 con el estado real de cada ítem"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - packages/ui/src/index.ts
  - apps/web/components/ui/index.ts
  - apps/web/app/(app)/layout.tsx
  - apps/web/app/(app)/client/finance/page.tsx
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-03"
---

# Spec: Sistema de diseño — consolidación

## 1. Alcance

Cubre `1.15`, `1.16`, `1.17` y `1.19`. Estos ítems salen de la spec ejecutable
de Cliente porque son migraciones arquitectónicas multi-superficie, no fixes
aislados de una pantalla.

## 2. Estado

`REVIEW`: antes de implementar, el owner debe elegir la librería canónica,
aprobar tokens y acordar una matriz de QA visual desktop/mobile.

## 2b. Estado real de cada ítem (2026-10-03)

Desde que se redactó esta spec el owner autorizó avanzar en varios ítems, y el
plan registra su cierre. Esta tabla resume esas entradas; el detalle y la
evidencia están en `docs/AUDIT_REMEDIATION_PLAN.md`.

| Ítem | Estado | Resumen |
|---|---|---|
| `1.15` | Parcialmente resuelto (2026-07-27) | `@semse/ui` y `apps/web/components/ui` no compiten por el mismo contenido (compuestos de dominio frente a primitivas), así que no se fusionaron; se eliminaron los spinners propios en favor de `animate-spin`. |
| `1.16` | Corregido, parcial (hasta 2026-09-16) | Los tres colores nombrados en el hallazgo ya usan tokens (PR #463) y se revisaron archivo por archivo los duplicados reales; buena parte de los hex restantes son el patrón correcto `var(--token, #respaldo)`. El conteo original de 3.306 estaba desactualizado. |
| `1.17` | Cerrado (2026-08-03) | Se unificó la taxonomía de navegación de admin entre móvil y escritorio y se fusionaron los renderers JSX restantes de `Sidebar` y `AppShell`; `isNewNavSection` vive en `lib/navigation-shell.ts`. |
| `1.19` | Corregido (2026-09-16) | Se resolvió con un enfoque de menor riesgo que migrar los 46 archivos de `NotificationBanner`. |

Lo que **no** quedó documentado como decisión formal: el ADR de ownership de
componentes y la matriz de QA visual de la sección 6. Las migraciones se
hicieron de forma incremental con spot-checks, y en el caso de `1.17` con
verificación visual en vivo; no hay baseline de snapshots automatizado.

## 3. Decisiones requeridas

1. Componentes canónicos: `@semse/ui`, `apps/web/components/ui` o capas con
   ownership explícito.
2. Fuente única de tokens de color y política para excepciones semánticas.
3. Shell único con variantes responsive, sin duplicar navegación/roles.
4. Sistema único de notificaciones y estrategia de migración.

## 4. Invariantes

- La migración es incremental por componente/superficie, no un reemplazo masivo.
- No se hace find/replace ciego de colores.
- Cada lote tiene baseline visual, viewport desktop/mobile y prueba de teclado.
- La navegación conserva RBAC, ruta activa, breadcrumbs y accesibilidad.
- Toasts/banners preservan severidad, persistencia y mensajes de error.
- No se eliminan exports hasta demostrar cero consumidores.

## 5. Fases propuestas

- F0: inventario y decisión ADR.
- F1: tokens y primitives sin cambiar shells.
- F2: notificaciones.
- F3: shell/navegación responsive.
- F4: eliminación de duplicados y exports legacy.

## 6. Tests/gates

- Typecheck y lint por lote.
- Story/visual snapshots para estados loading/empty/error/ready.
- Navegación por teclado y contraste.
- QA visual a 390, 768, 1024 y 1440 px.
- Cero regresiones de permisos/rutas.

## 7. Gate de aprobación

Cambiar a `APPROVED` después del ADR de ownership y de que el owner acepte la
matriz de QA. Hasta entonces no autoriza migraciones masivas.
