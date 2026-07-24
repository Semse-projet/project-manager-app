---
id: "ui.design-system-remediation"
title: "Sistema de diseño — consolidación segura y verificable"
domain: "ui"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "high"
date: "2026-07-23"
author: "Codex"
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
last_verified: "2026-07-23"
---

# Spec: Sistema de diseño — consolidación

## 1. Alcance

Cubre `1.15`, `1.16`, `1.17` y `1.19`. Estos ítems salen de la spec ejecutable
de Cliente porque son migraciones arquitectónicas multi-superficie, no fixes
aislados de una pantalla.

## 2. Estado

`REVIEW`: antes de implementar, el owner debe elegir la librería canónica,
aprobar tokens y acordar una matriz de QA visual desktop/mobile.

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
