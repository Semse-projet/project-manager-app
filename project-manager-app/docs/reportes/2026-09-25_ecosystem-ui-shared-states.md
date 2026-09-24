# Reporte — Ecosistema UI: estados compartidos (Fase 1 de mejoras de pantallas)

- **Fecha:** 2026-09-25
- **Rama:** `claude/ecosystem-ui-shared-states`
- **Pedido original:** "diseñar las mejoras de todas las pantallas que tenemos en el ecosistema" (web ~230 páginas, mobile ~65 pantallas, portales secundarios Angular/assistant-portal).

## Por qué esta fase y no "todas las pantallas"

Rediseñar 230+ pantallas web y 65 pantallas mobile en una sesión no es posible sin bajar la calidad o romper flujos. Se confirmó con el usuario (`AskUserQuestion`) empezar por la **capa compartida** (`packages/ui`, `apps/web/app/globals.css`) porque cualquier mejora ahí se propaga a todas las pantallas web que la consuman, en vez de tocar página por página. El orden de las próximas fases, ya acordado con el usuario: **Fase 2 = Web WORKER + Mobile WORKER**.

## Diagnóstico (evidencia real, no genérico)

Auditando `apps/web/app/(app)/worker/dashboard/page.tsx` (pantalla ancla, 230 páginas comparten el mismo patrón) se encontraron **tres implementaciones distintas de "estado vacío"** conviviendo en el ecosistema:
1. Clases CSS `.empty-state`/`.empty-icon`/`.empty-title`/`.empty-desc` en `globals.css` (no usadas en esta página).
2. Una función `EmptyPanel` definida localmente en este archivo (no reutilizable).
3. Divs ad-hoc en línea para el estado de error y para un segundo estado vacío distinto del de `EmptyPanel`.

Y **6 tarjetas duplicando el mismo hover** vía `onMouseOver`/`onMouseOut` mutando `style` por DOM en JS, en vez de usar `.card-lift` (clase que ya existe y se usa en otras 9 páginas). Esa mutación por JS: no dispara con teclado (sin foco), no respeta `prefers-reduced-motion` (que además no existía en ningún lado del CSS global), y duplica ~10 líneas × 6.

## Cambios

- **`packages/ui`**: dos componentes nuevos, reutilizables por cualquier pantalla web del ecosistema —
  - `EmptyState` (generaliza el `EmptyPanel` local: título, descripción, ícono o imagen, acción opcional).
  - `ErrorState` (mismo lenguaje visual que ya usaban los errores ad-hoc, pero como componente).
  - Exportados desde `packages/ui/src/index.ts`.
- **`apps/web/app/globals.css`**:
  - `.card-lift` ahora también aplica en `:focus-visible`, no solo `:hover` (arregla la falta de feedback por teclado en sus 9+6 usos existentes, no solo los nuevos).
  - Nuevo bloque `@media (prefers-reduced-motion: reduce)` global — protege toda transición/animación del sitio, no solo la nueva.
- **`apps/web/app/(app)/worker/dashboard/page.tsx`** (pantalla ancla de la Fase 2 acordada, usada como prueba de concepto de la Fase 1):
  - Se eliminó el `EmptyPanel` local; ambos estados vacíos y el estado de error ahora usan `EmptyState`/`ErrorState` de `@semse/ui`.
  - Las 6 tarjetas con hover por JS ahora usan `className="card-lift"`; se eliminó el `onMouseOver`/`onMouseOut` duplicado.
  - Import de `next/image` eliminado (ya no se usa directamente en este archivo).
  - Resultado: -52 líneas / +42 líneas netas, mismo comportamiento visual, menos código duplicado, accesible por teclado, respeta reducción de movimiento.

## Validación

- `pnpm --filter @semse/web exec tsc --noEmit`: sin errores.
- `pnpm --filter @semse/web lint`: 0 errores, 36 warnings preexistentes (ninguno en los archivos tocados).
- Revisión visual en navegador: no ejecutada en este entorno (sin acceso a un navegador para captura); el cambio es CSS/estructura equivalente al comportamiento anterior, sin nuevas dependencias.
- `packages/ui` no tiene script de build/lint propio (se consume como TS fuente); su tipado se validó indirectamente vía el `tsc` de `apps/web`, que lo importa.

## Limitaciones

- No se tocó mobile, Angular ni assistant-portal en esta fase (fuera de alcance de la Fase 1 acordada).
- Las otras 229 páginas web que podrían beneficiarse de `EmptyState`/`ErrorState`/`.card-lift` no fueron migradas — quedan para las fases siguientes página por página.
- No se verificó visualmente en navegador (capturas de escritorio/móvil, foco visible, reduced-motion) por falta de entorno gráfico en esta sesión.

## Próximo paso

Fase 2 acordada con el usuario: **Web WORKER + Mobile WORKER** — migrar el resto de las ~20 páginas de `apps/web/app/(app)/worker/*` a los componentes compartidos, y extender el mismo diagnóstico (estados, duplicación, accesibilidad) a `apps/mobile/src/screens/worker/*`.
