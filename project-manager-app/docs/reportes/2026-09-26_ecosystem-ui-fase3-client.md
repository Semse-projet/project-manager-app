# Reporte — Ecosistema UI: Fase 3 (Web CLIENT + Mobile CLIENT)

- **Fecha:** 2026-09-26
- **Rama:** `claude/ecosystem-ui-client-phase3`
- **Continúa:** Fases 1, 2, 2b (PR #672, #673, #674, todas mergeadas) — WORKER quedó cerrado; esta fase cubre CLIENT.

## Alcance

Mismo criterio que las fases anteriores: consolidar estados vacío/error ad-hoc a `EmptyState`/`ErrorState` (`packages/ui` en web, nuevos componentes nativos en mobile), y hover hecho a mano en JS a clases CSS con `:focus-visible`. Se auditaron las 25 páginas de `apps/web/app/(app)/client/*` y las 4 pantallas de `apps/mobile/src/screens/client/*`.

## Mobile CLIENT

- **`JobDetailScreen`**: estado "job no encontrado" (pantalla completa) → `<ErrorState>`; banner de error inline; sus 3 estados vacíos (propuestas/milestones/evidencia) → `<EmptyState>`.
- **`JobsListScreen`**: mismo patrón que su equivalente WORKER — error y `ListEmptyComponent` migrados.
- **`RatingFormScreen`**: estado "no se pudo identificar al profesional" y banner de error → `<ErrorState>`. Su `<Text style={styles.hint}>{jobTitle}</Text>` (subtítulo) no se tocó — no es un estado vacío.
- **`ClientSettingsScreen`**: revisado, no tiene el patrón (solo un botón de logout con color de tema).

## Web CLIENT

**16 páginas** con banner de error ad-hoc migradas a `<ErrorState>`: `jobs`, `jobs/[jobId]` (2 bloques distintos), `jobs/new`, `projects`, `projects/[projectId]/copilot` (2 bloques distintos), `marketplace`, `professionals`, `protools`, `finance`, `disputes`, `reviews`, `milestones`, `payments`, `dashboard`, `documents`, `bids`.

**3 páginas** con hover por JS migradas a CSS:
- `jobs` y `dashboard`: mismo caso que WORKER, usan la clase `.row-hover` ya creada.
- `jobs/[jobId]`: 4 botones-toggle con hover a `border-color` **y** `box-shadow` de color distinto cada uno. Se agregó **`.row-hover-glow`** (hermana de `.row-hover`, acepta `--row-hover-shadow` además de `--row-hover-color`) porque `.row-hover` no cubría el glow de sombra.

**2 duplicados locales de `EmptyState` consolidados** (mismo hallazgo que en `worker/review` en la Fase 2b):
- `client/dashboard`: función local `EmptyState()` (¡con el mismo nombre que el componente de `packages/ui`, generando sombra de nombre!) → renombrada a `ClientDashboardEmptyJobs` y reescrita sobre el componente compartido, conservando imagen, texto y CTA "Publicar trabajo".
- `client/reviews`: panel local ícono+texto → `<EmptyState icon={Inbox} />`.

**Explícitamente no tocado** (evaluado, no es el mismo patrón):
- `jobs/[jobId]` y `payments`: badges/links de "En disputa" (color de estado, no error de página).
- `projects/[projectId]/copilot`: paleta categórica de `plan.status`, el mapa tri-estado de `actionFeedback`, el panel de "Bloqueos visibles" (contenido de dominio, no un error de fetch) y las razones de acciones bloqueadas (contenido, no error).
- `marketplace`: panel de resultado de envío ("Error al enviar" + botón Reintentar) — es un estado de resultado de una acción puntual con su propio botón, no el error de carga de página que este criterio cubre.
- `payments`: el estado vacío "Sin transacciones" tiene `data-testid="client-payments-empty"` usado por tests — no se tocó para no arriesgar esa aserción.

## Validación

- Mobile: `pnpm --filter @semse/mobile run check` (tsc) sin errores; `pnpm --filter @semse/mobile test` — 46/46 suites, 220/220 tests en verde.
- Web: `pnpm --filter @semse/web exec tsc --noEmit` sin errores; `pnpm --filter @semse/web lint` 0 errores, 36 warnings preexistentes (ninguno nuevo).
- Sin verificación visual en navegador/simulador (sin entorno gráfico en esta sesión).

## Cierre

Con esta fase, **Web CLIENT y Mobile CLIENT quedan cerrados** para el criterio de estados vacío/error consolidados, igual que WORKER. Faltan del ecosistema: **ADMIN** (63 páginas web, la superficie más grande), portales secundarios (Angular, assistant-portal) y las superficies públicas/marketing.

## Próximo paso

El usuario debe elegir: **ADMIN** es la continuación natural por tamaño, o priorizar las páginas públicas/marketing si el foco es de cara al usuario final.
