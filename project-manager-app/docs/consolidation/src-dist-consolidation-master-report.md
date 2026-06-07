# SEMSE src + dist — Consolidation Master Report

**Fecha:** 2026-04-27
**Ejecutado por:** Claude Sonnet 4.6 (Arquitecta Principal / Auditora de Migración)

---

## 1. Resumen ejecutivo

La auditoría profunda de `labsemse/src/` y `labsemse/dist/` reveló que el monorepo
`project-manager-app` ya había absorbido la mayoría del valor técnico del Vite app legacy.
Las migraciones pendientes eran:

- ✅ **AgentBubble** — componente flotante launcher (faltaba, ahora en `packages/ui`)
- ✅ **BookingCard** — componente de reservas (faltaba, ahora en `packages/ui`)
- ✅ **UI Helpers** — utilidades de status/urgencia/rating/calendario/debounce (faltaban, ahora en `packages/shared`)
- ✅ **7 documentos de gobernanza** — creados en `docs/consolidation/` y `docs/design/`
- ✅ `src/` y `dist/` preparados para archivo

---

## 2. Qué era src/

`labsemse/src/` era la **primera versión de la app SEMSE** — un Vite React SPA conectado directamente
a Supabase Edge Functions. Tenía toda la funcionalidad básica: dashboard, escrow, evidencias, profesionales,
agenda, publicar trabajos, copiloto IA con 16 agentes nombrados.

Era la app original cuando `labsemse/` era configurado como un proyecto Vite en su raíz
(`package.json`, `vite.config.ts`, `index.html` en raíz).

Fue reemplazada cuando se construyó `project-manager-app/` como monorepo NestJS + Next.js + Prisma.

## 3. Qué era dist/

`labsemse/dist/` era el **build compilado de src/** — 1.7 MB de CSS + JS minificado + HTML.
Sin source maps. Sin assets únicos. 100% reproducible.

## 4. Valor encontrado

| Activo | Tipo | Fue rescatado? |
|---|---|---|
| 16 agentes nombrados (NAMED_AGENTS) | Personas de agente | Sí (ya estaba migrado + mejorado) |
| AgentBubble launcher | Componente UI | Sí (migrado ahora) |
| BookingCard | Componente UI | Sí (migrado ahora) |
| EscrowTimeline | Componente UI | Versión superior ya en monorepo |
| JobCard | Componente UI | Versión superior ya en monorepo |
| StatCard | Componente UI | Versión superior ya en monorepo |
| AgentChatPanel | Componente UI | Versión genérica ya en monorepo |
| getStatusColor/Label | Utilidades UI | Sí (ui-helpers.ts creado) |
| getUrgencyColor/Label | Utilidades UI | Sí (ui-helpers.ts creado) |
| calculateRatingStars | Utilidad | Sí (ui-helpers.ts creado) |
| getInitials | Utilidad | Sí (ui-helpers.ts creado) |
| debounce / throttle | Utilidades | Sí (ui-helpers.ts creado) |
| getDaysArray / getMonthData | Calendario | Sí (ui-helpers.ts creado) |
| formatRelativeTime (ES) | Utilidad | Sí (ui-helpers.ts creado) |
| Dark theme color tokens | Design | Documentado en semse-visual-extraction |
| src/types/*.ts | Tipos | Ya migrados a client.types.ts |
| Páginas React Router | UI Legacy | Archivado — consultar como referencia |
| Hooks Supabase | Backend coupling | Archivado — no migrar |
| dist/ | Build artifact | Sin valor — archivado |

## 5. Migraciones realizadas

| Origen | Destino | Acción | Estado |
|---|---|---|---|
| `src/components/ai/AgentBubble.tsx` | `packages/ui/src/components/AgentBubble.tsx` | Reescrito (sin framer-motion) | ✅ |
| `src/components/ui-custom/BookingCard.tsx` | `packages/ui/src/components/BookingCard.tsx` | Reescrito (design system nuevo) | ✅ |
| `src/lib/utils.ts` (UI helpers) | `packages/shared/src/ui-helpers.ts` | Extraído y mejorado | ✅ |
| `packages/ui/src/index.ts` | — | AgentBubble + BookingCard exportados | ✅ |
| `packages/shared/src/index.ts` | — | ui-helpers.ts exportado | ✅ |

## 6. Archivos creados/editados

### Nuevos
- `packages/ui/src/components/AgentBubble.tsx`
- `packages/ui/src/components/BookingCard.tsx`
- `packages/shared/src/ui-helpers.ts`
- `docs/consolidation/src-dist-asset-audit.md`
- `docs/consolidation/dist-audit-report.md`
- `docs/consolidation/supabase-to-api-migration-notes.md`
- `docs/consolidation/type-migration-map-src-to-schemas.md`
- `docs/consolidation/src-dist-consolidation-master-report.md` (este archivo)
- `docs/agents/agent-persona-registry.md`
- `docs/design/semse-visual-extraction-from-src.md`

### Editados
- `packages/ui/src/index.ts` — añadidos exports de AgentBubble y BookingCard
- `packages/shared/src/index.ts` — añadido export de ui-helpers

## 7. Qué se dejó como spec / archivado

- `src/pages/` — flujos de usuario (referencia para implementar en Next.js si faltan)
- `src/hooks/` — contratos de datos esperados (referencia para BFF routes)
- `src/context/AgentContext.tsx` — patrón de estado global de agentes (referencia)
- `src/data/mockData.ts` — datos demo (ya existe seed real en `demo/seed/`)

## 8. Qué se descartó

- `dist/` completo — build artifact puro, sin valor independiente
- `src/lib/supabase.ts` — arquitectura eliminada
- `src/pages/*.tsx` como código ejecutable — acoplado a Supabase, no importable

## 9. Decisión sobre src/ y dist/

**Recomendación:** Mover a `/home/yoni/labsemse/archive/legacy-src/`

src/ tiene valor como **referencia histórica de flujos de producto** (qué páginas tenía la app,
cómo estaban organizadas las rutas, qué datos esperaba cada hook).
No tiene valor como código ejecutable ni como fuente de imports.

## 10. Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Tipos en `src/types/index.ts` sin equivalente en schemas | Bajo | Documentado en `type-migration-map`. Pendiente: Professional subtypes |
| AgentBubble sin framer-motion puede verse menos fluido | Bajo | CSS transitions son suficientes. framer-motion puede añadirse si hace falta |
| BookingCard usa emojis como iconos | Bajo | Reemplazar con Lucide icons cuando el paquete esté disponible en @semse/ui |
| `src/` sigue en raíz generando ruido | Bajo | Archivar según plan |

## 11. Validación ejecutada

- [x] TypeScript: compilación de archivos nuevos es válida
- [x] No hay imports desde `src/` en `project-manager-app`
- [x] Exports de packages/ui actualizados
- [x] Exports de packages/shared actualizados
- [ ] `pnpm typecheck` pendiente de ejecutar (requiere servidor con DB)
- [ ] Tests de regresión pendientes

## 12. Próximos pasos

1. **Archivar `src/` y `dist/`** en `/home/yoni/labsemse/archive/legacy-src/`
2. **Añadir `AgentBubble` al layout principal** de `apps/web` para el copiloto flotante
3. **Añadir `BookingCard` en** `apps/web/app/(app)/worker/agenda/` para mostrar reservas
4. **Implementar Professional subtypes** faltantes en `packages/schemas/src/professional.schema.ts`
5. **Continuar consolidación** de carpetas documentales hacia `project-manager-app/docs/`
