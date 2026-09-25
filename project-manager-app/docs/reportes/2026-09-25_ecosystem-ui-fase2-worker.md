# Reporte — Ecosistema UI: Fase 2 (Web WORKER + Mobile WORKER)

- **Fecha:** 2026-09-25
- **Rama:** `claude/ecosystem-ui-shared-states` (continúa la Fase 1, PR #672 ya mergeada)
- **Fase anterior:** capa compartida (`EmptyState`/`ErrorState` en `packages/ui`, `.card-lift` con `:focus-visible`, `prefers-reduced-motion` global) — mergeada en `main`.

## Alcance de esta fase

Migrar el resto de **Web WORKER** (`apps/web/app/(app)/worker/*`) y **Mobile WORKER** (`apps/mobile/src/screens/worker/*`) al mismo lenguaje de estados vacío/error diagnosticado en la Fase 1, con el mismo criterio: solo tocar lo que es genuinamente el mismo patrón (estado de error de página/sección, "no hay datos"), no tocar paletas decorativas categóricas ni pantallas legacy.

## Web WORKER

Se auditaron las 20 páginas de `worker/*` buscando el mismo patrón ad-hoc de la Fase 1 (`background: rgba(239,68,68,...)` para errores, `onMouseOver`/`onMouseOut` mutando `style` por JS). Resultado:

- **7 páginas** con un bloque de error de página ad-hoc → migradas a `<ErrorState message={...} />`: `jobs`, `jobs/[jobId]`, `opportunities`, `rates`, `disputes`, `settings`, `payments`, y además `tracker` (2116 líneas — se tocó solo el bloque de error puntual, nada más de ese archivo).
- **2 páginas** con hover por JS (`jobs`, `jobs/[jobId]`) → migradas a clases CSS. `jobs` usaba transform+shadow tipo tarjeta → pero era un hover de fila de lista (border-color), no de tarjeta, así que en vez de forzar `.card-lift` se creó una clase hermana **`.row-hover`** en `globals.css` (mismo principio: `:hover` + `:focus-visible`, sin JS). Acepta un color de acento por CSS custom property (`--row-hover-color`) porque `jobs/[jobId]` resalta a `var(--brand)` en vez de `var(--ok)`.

**Explícitamente no tocado** (evaluado y descartado con razón):
- `field-ops` — legacy, en camino de reemplazo por el Labor Engine (`semse-labor-engine-boundary`); no se invierte ahí.
- `sense-vision`'s `EmptyResult` — es el resultado de un scan de reconocimiento, no un "no hay datos" genérico; no es el mismo componente.
- `evidence`, `profile`, `review`, `travel`, `payments` (filas de tabla) — sus usos de rojo son paletas de estado categóricas (disputado/rechazado/etc.), no el estado de error de página; forzarlas a `ErrorState` habría sido incorrecto.
- `tracker`'s `syncBannerStyle` (4 tonos info/success/warning/danger) — helper ya centralizado en el archivo, no un duplicado ad-hoc; se dejó igual.

## Mobile WORKER

Mobile no tiene ningún componente compartido de estado vacío/error (solo `ErrorBoundary`, que es para crashes, no para "el fetch falló"). El patrón encontrado, idéntico en **9 pantallas**, era texto plano sin ícono ni estructura: `error ? <Text style={styles.error}>{error}</Text> : null` y `<Text style={styles.hint}>...</Text>` como `ListEmptyComponent`.

- **Nuevos componentes nativos** en `apps/mobile/src/components/`: `EmptyState.tsx` y `ErrorState.tsx` — mismo rol que sus pares web, pero con primitivos de React Native (`View`/`Text`/`Ionicons`) y el theme de `apps/mobile/src/theme/theme.ts`, porque `packages/ui` (web) usa Tailwind/DOM y no es utilizable desde React Native.
- **9 pantallas migradas**: `JobsListScreen`, `DisputesScreen`, `MaterialsScreen`, `IncidentsScreen`, `RatesScreen` (solo su error; su otro uso de `styles.hint` es un texto informativo de referencia salarial, no un estado vacío — se dejó igual), `PaymentsScreen`, `BidsScreen`, `AgendaScreen`, `TravelScreen`.

## Validación

- Web: `pnpm --filter @semse/web exec tsc --noEmit` sin errores; `pnpm --filter @semse/web lint` 0 errores, 36 warnings preexistentes (ninguno nuevo).
- Mobile: `pnpm --filter @semse/mobile run check` (tsc) sin errores; `pnpm --filter @semse/mobile test` — **46/46 test suites, 220/220 tests en verde**, incluyendo los 9 archivos de test de las pantallas tocadas.
- Sin verificación visual en navegador/simulador (sin entorno gráfico en esta sesión).

## Limitaciones

- No se migraron `field-ops` (legacy) ni las paletas de estado categóricas de `evidence`/`profile`/`review`/`payments`/`travel` — decisión deliberada, no un olvido.
- `JobDetailScreen`, `DisputeDetailScreen`, `WorkerReviewFormScreen`, `ReviewScreen` (mobile) y el resto de pantallas de detalle no fueron auditadas en esta pasada — quedan para una fase de detalle si se decide continuar.
- No se verificó visualmente (capturas de pantalla, dispositivo real/simulador) por falta de entorno gráfico.

## Próximo paso

Con Web+Mobile WORKER cerrados, el orden natural (por tamaño y reutilización ya construida) sería **Web CLIENT + Mobile CLIENT**, o si se prefiere, terminar `WORKER` con las pantallas de detalle que quedaron fuera de esta pasada. Se necesita indicación del usuario para elegir.
