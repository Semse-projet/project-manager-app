# @semse/mobile

Expo (React Native, TypeScript, SDK 57) worker app. Its one job today: **background
geolocation for the Time Tracker's proximity check-in** — when a worker gets near a
Job or FreeProject site, the app prompts (or auto-starts) the Labor Engine timer,
even while backgrounded or the app is fully closed on Android. This is the mobile
half of the feature shipped on web in `apps/web/app/(app)/worker/tracker/useProximityCheckIn.ts`
(see also `apps/api/src/integrations/geo-distance.ts` and `google-maps.ts`).

Not a full port of the web tracker — no jobs list, no manual-entry form, no reports.
Just: log in, see/toggle the active timer, toggle proximity tracking, and set the
`ask` / `auto` / `off` preference (shared with web via `UserProfile.proximityCheckInMode`).

## Setup

```bash
cp .env.example .env   # then set EXPO_PUBLIC_SEMSE_API_BASE_URL to a reachable apps/api URL
pnpm install            # from the repo root — this is a pnpm workspace member
pnpm dev:mobile          # or: pnpm --filter @semse/mobile start
pnpm check:mobile        # typecheck (tsc --noEmit)
pnpm --filter @semse/mobile test   # jest — geo/proximity logic only, no native rendering
```

`EXPO_PUBLIC_SEMSE_API_BASE_URL` must be reachable from the **device/simulator**, not
just your machine — `localhost` only works in an iOS simulator talking to a Mac host;
everywhere else (Android emulator, physical device, Expo Go) use your LAN IP or a
tunnel (`expo start --tunnel`).

**This app was built in a sandbox with no Xcode/Android SDK/simulator available** —
`pnpm --filter @semse/mobile check` (`tsc --noEmit`) passes, but nothing here has
been run on an actual simulator or device. Treat the first real run as this app's
first end-to-end test, not a formality.

## Authentication

Talks directly to `apps/api` — there is no BFF layer here (that's a `apps/web`-only
pattern for browser cookie sessions). `POST /v1/auth/login` returns an access +
refresh token pair (`apps/api/src/modules/auth/auth.controller.ts`); `src/api/client.ts`
stores them in `expo-secure-store` and attaches `Authorization: Bearer <token>` to
every request, refreshing once via `POST /v1/auth/refresh` on a 401 before giving up.

## Background location architecture

```
index.ts                          — imports backgroundLocationTask.ts before
                                     registerRootComponent (TaskManager.defineTask
                                     must run at module scope, not inside a component)
src/geo/backgroundLocationTask.ts — the registered task; runs even when the OS
                                     relaunches the app headless for a location update
src/geo/backgroundLocation.ts     — start/stop tracking + permission requests
src/geo/proximityService.ts       — evaluate one location against cached sites;
                                     ask → local notification, auto → POST timer/start
src/geo/siteCache.ts              — AsyncStorage cache of {sites, proximityMode} —
                                     the background task has no React tree to read
                                     state from, so the foreground app persists this
                                     periodically (refreshSites.ts, called on screen focus)
src/geo/cooldownStore.ts          — per-site cooldown (20 min), also persisted since
                                     the task can run in a fresh JS context each time
```

**Known platform limits, not bugs**: iOS does not guarantee background location
delivery to a *force-quit* app the way Android's foreground-service model does —
Apple's OS decides when to wake the app for a significant location change. This is
inherent to iOS, not something fixable in this codebase. Android needs the
persistent foreground-service notification (configured in `app.json` /
`backgroundLocation.ts`) to keep tracking reliably; that notification is not optional.

## Structure

```
src/api/          — client.ts (fetch+token wrapper), auth.ts, labor.ts, profile.ts
src/context/       — AuthContext (session state)
src/geo/           — see above
src/notifications/ — local notification presentation + the "Iniciar" action handler
src/navigation/    — RootNavigator (Login → Timer/Settings stack)
src/screens/       — LoginScreen, TimerScreen, SettingsScreen
```
