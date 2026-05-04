# src/ + dist/ — Asset Audit Matrix

**Fecha:** 2026-04-27
**Fuente legacy:** `/home/yoni/labsemse/src/` y `/home/yoni/labsemse/dist/`
**Destino canónico:** `project-manager-app/`

---

## Matriz de activos

| Archivo origen | Tipo | Valor encontrado | Riesgo | Decisión | Destino canónico | Estado | Notas |
|---|---|---|---|---|---|---|---|
| `src/lib/ai.ts` | Agent registry | 16 agentes con personalidades, colores, mensajes iniciales | Bajo | MIGRADO (ya existía versión mejorada) | `packages/agents/src/index.ts` | ✅ Completado | El monorepo ya tenía `NAMED_AGENTS` mejorado con `contextTriggers`. La versión del monorepo es canónica. |
| `src/lib/utils.ts` | Utilities | `getStatusColor`, `getStatusLabel`, `getUrgencyColor`, `calculateRatingStars`, `getInitials`, `debounce`, `throttle`, `getDaysArray`, `getMonthData`, `formatRelativeTime` | Bajo | MIGRADO | `packages/shared/src/ui-helpers.ts` | ✅ Creado | Utilities no duplicadas; versiones en inglés ya existían en `index.ts`. |
| `src/components/ui-custom/EscrowTimeline.tsx` | UI Component | Timeline de milestones con status config | Bajo | SUPERADO | `packages/ui/src/components/EscrowTimeline.tsx` | ✅ Ya existía (versión superior) | Monorepo tiene versión con UPPERCASE status, 3-col breakdown, accesibilidad. |
| `src/components/ui-custom/JobCard.tsx` | UI Component | Card de job con dual-schema budget resolution | Bajo | SUPERADO | `packages/ui/src/components/JobCard.tsx` | ✅ Ya existía (versión superior) | Monorepo usa `@semse/schemas Job` type, HtmlInCanvasPanel. |
| `src/components/ui-custom/StatCard.tsx` | UI Component | KPI card con trend | Bajo | SUPERADO | `packages/ui/src/components/StatCard.tsx` | ✅ Ya existía (versión superior) | Monorepo tiene `color` enum, loading skeleton, delta label. |
| `src/components/ui-custom/BookingCard.tsx` | UI Component | Card de reserva con acciones | Bajo | MIGRADO | `packages/ui/src/components/BookingCard.tsx` | ✅ Creado | Adaptado a design system del monorepo. Sin dependencias legacy. |
| `src/components/ai/AgentBubble.tsx` | UI Component | Floating launcher del chat de agentes | Bajo | MIGRADO | `packages/ui/src/components/AgentBubble.tsx` | ✅ Creado | Reescrito sin framer-motion (no está en deps de `@semse/ui`). CSS transitions puras. |
| `src/components/ai/AgentChat.tsx` | UI Component | Panel de chat | Bajo | SUPERADO | `packages/ui/src/components/AgentChatPanel.tsx` | ✅ Ya existía | Monorepo tiene versión headless genérica. |
| `src/index.css` | Design tokens | Dark theme premium: purple primary, orange accent `#ff6a00` | Bajo | EXTRAÍDO EN DOC | `apps/web/app/globals.css` (ya tiene dialecto superior) | ✅ Documentado | Ver `semse-visual-extraction-from-src.md` |
| `src/tailwind.config.js` | Config | Color vars via CSS custom properties | Bajo | SUPERADO | `apps/web/app/globals.css` (`@theme` Tailwind v4) | ✅ Documentado | Monorepo usa `@theme` más avanzado. |
| `src/types/index.ts` | Types | 30+ tipos de dominio: User, Job, Escrow, Booking, etc. | Medio | MIGRADO (ya existía) | `packages/schemas/src/client.types.ts` | ✅ Ya existía | El archivo mismo indicaba "MIGRACIÓN EN CURSO". El schema canónico es más completo. |
| `src/pages/*.tsx` | Pages | Dashboard, Escrow, Evidencias, Profesionales, Agenda, etc. | Alto | ARCHIVADO | `apps/web/app/(app)/` tiene equivalentes en Next.js | ✅ Archivado | Acoplado a Supabase directo. No migrar código, solo consultar como referencia de flujos. |
| `src/lib/supabase.ts` | Backend coupling | Conexión directa a Supabase | Alto | DESCARTADO | N/A | ✅ Descartado | Supabase reemplazado por NestJS + Prisma. Ver `supabase-to-api-migration-notes.md`. |
| `src/hooks/*.ts` | Hooks | useJobs, useEscrows, useEvidenceRecords, etc. | Alto | ARCHIVADO | BFF routes en `apps/web/` tienen equivalentes | ✅ Archivado | Acoplados a Supabase. Consultar solo para entender qué parámetros/respuestas se esperaban. |
| `src/context/AgentContext.tsx` | Context | Estado global del chat de agentes | Medio | ARCHIVADO | `apps/web/` maneja estado local en copilot page | ✅ Archivado | Patrón útil de referencia pero no copiar el acoplamiento a Supabase. |
| `src/data/mockData.ts` | Mock data | Datos demo hardcodeados | Bajo | ARCHIVADO | `project-manager-app/demo/seed/` tiene seeder real | ✅ Archivado | El demo seed real es más completo. |
| `dist/assets/index-*.css` | Build artifact | CSS compilado | Nulo | DESCARTADO | N/A | ✅ Archivado | Reproducible desde `src/`. No tiene información nueva. |
| `dist/assets/index-*.js` | Build artifact | JS bundle minificado | Nulo | DESCARTADO | N/A | ✅ Archivado | Sin source maps. No aporta información que no esté en `src/`. |
| `dist/index.html` | Build artifact | HTML de entrada | Nulo | DESCARTADO | N/A | ✅ Archivado | Boilerplate Vite. Sin valor. |

---

## Leyenda de decisiones

- **MIGRADO** — código extraído y puesto en destino canónico
- **SUPERADO** — versión del monorepo es superior; `src/` se archiva sin migrar
- **DESCARTADO** — sin valor rescatable; se elimina
- **ARCHIVADO** — se conserva como referencia histórica pero no se importa
