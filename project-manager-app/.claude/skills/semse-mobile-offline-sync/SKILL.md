---
name: semse-mobile-offline-sync
description: The real offline-first pattern in apps/mobile (Expo/React Native) — it is a SEPARATE implementation from the web's trackerLocalStore, not the same code reused across platforms. Use when touching apps/mobile/src/timer, apps/mobile/src/geo, or debugging an offline-sync bug reported against the mobile app specifically.
---

# SEMSE mobile offline-first pattern

## Correcting a CLAUDE.md ambiguity

`CLAUDE.md`'s architecture principles list "Offline-first for field ops — trackerLocalStore pattern for sync queues" as a single bullet, which reads as if there's one shared offline mechanism across web and mobile. **There isn't.** `trackerLocalStore.ts` (`apps/web/app/(app)/worker/tracker/trackerLocalStore.ts`) is web-only, localStorage-backed, and used by the browser tracker UI. `apps/mobile` has its own, independent implementation — no shared code, no shared storage key, no shared queue format.

## What actually exists on mobile

- `apps/mobile/src/timer/localTimer.ts` — AsyncStorage-backed local timer state (`semse.local.timer.v1` key) plus a bounded history (`semse.local.timer.history.v1`, capped at 20 entries). Functions: `startLocalTimer`, `pauseLocalTimer`, `resumeLocalTimer`, `stopLocalTimer`, `loadLocalTimer`/`saveLocalTimer`, `loadLocalHistory`/`replaceLocalHistoryEntry`. `isReasonableActiveTimer()` guards against a stale/corrupted local timer surviving indefinitely (checks the timer isn't started in the future and hasn't been running longer than `MAX_REASONABLE_ACTIVE_SECONDS` = 7 days) — if you see a bug where a timer "won't clear," this guard (or its absence in a new code path) is the first thing to check.
- `apps/mobile/src/geo/cooldownStore.ts` and `siteCache.ts` — separate local caches for geofencing/check-in cooldowns, unrelated to the timer state above. Don't conflate the two when debugging.

There is currently **no queue-and-replay sync mechanism visible in `apps/mobile/src/timer`** comparable to `trackerLocalStore.ts`'s `enqueueTrackerEvent`/`markTrackerSyncing`/`markTrackerSyncFailed` — mobile's local timer looks like a single-slot "current timer + short history," not a pending-events queue. If a mobile task requires queueing multiple offline mutations for later sync (not just remembering one active timer), that queueing layer doesn't exist yet and would need to be designed, not just found.

## Notas para futuros agentes / hallazgos abiertos

- Esto es una corrección de hecho, no una skill "completa" sobre el patrón de sync — solo se leyó `localTimer.ts` en detalle; `cooldownStore.ts`/`siteCache.ts`/el resto de `apps/mobile/src/geo` y `apps/mobile/src/api` no se auditaron línea por línea en esta sesión. Si el bug está ahí, tratá esta skill como punto de partida, no como mapa completo.
- No se confirmó si existe algún mecanismo de reconciliación cuando el timer local de mobile y el estado del servidor (`v1/labor/timer/active`) divergen — por ejemplo, el usuario inicia un timer offline en el teléfono y el servidor ya tiene uno activo desde web. Si aparece un bug de "dos timers activos" o "el timer del teléfono desapareció al reconectar," esa reconciliación (o su ausencia) es sospechoso #1 y no está documentada en ningún lado todavía.
- Vale la pena, si alguien construye la capa de cola real para mobile, actualizar esta skill y considerar si `trackerLocalStore.ts` (web) tiene algo reusable conceptualmente (no como código — React Native no comparte runtime con el web) para no reinventar los estados de sync (`idle`/`syncing`/`failed`/`synced`) desde cero.
